
const { EventEmitter } = require('events');
const PepperMint = require('pepper-mint');

const FORWARDED_EVENTS = [
    'refreshing',
    'browser-login',
];

function doneRefreshing(unrelatedAccounts, maxRefreshingIds, accounts) {
    let remaining = accounts.length;
    if (unrelatedAccounts) {
        for (const account of accounts) {
            if (unrelatedAccounts.indexOf(account.name) !== -1) {
                // unrelated; ignore it
                --remaining;
            }
        }
    }

    return remaining <= (maxRefreshingIds || 0);
}

function neutralizeRollover(budgets) {
    budgets.spending.forEach(b => {
        // .ramt is "rollover amount"
        b.spent = b.amt - b.ramt;
    });
    if (budgets.unbudgeted && budgets.unbudgeted.spending) {
        budgets.unbudgeted.spending.forEach(b => {
            // unbudgeted spending won't have a rollover amount
            b.spent = b.amt;
        });
    }
}

function sum(items, property = undefined) {
    return items.reduce((total, item) => {
        const amount = property
            ? item[property]
            : item;
        return total + amount;
    }, 0);
}

class SpendableService extends EventEmitter {

    constructor(store, requestCredentials) {
        super();

        this.store = store;
        this.requestCredentials = requestCredentials;
    }

    isRelevantAccount(account) {
        if (!this.unrelatedAccounts) return true;
        return this.unrelatedAccounts.indexOf(account.name) === -1;
    }

    async editTransaction(txn) {
        await this.mint.editTransaction(txn);
    }

    async login() {
        let creds = await this.store.loadCredentials();
        let neededCreds = false;
        if (!creds) {
            creds = await this.requestCredentials();
            neededCreds = true;
        }

        const promise = PepperMint(creds.username, creds.password, creds.cookie)
        const mint = this.mint = promise.mint;
        for (const event of FORWARDED_EVENTS) {
            mint.on(event, (...args) => this.emit(event, ...args));
        }

        // now await the promise
        await promise;

        if (neededCreds || !creds.cookie) {
            creds.cookie = `ius_session=${mint.sessionCookies.ius_session}; ` +
                `thx_guid=${mint.sessionCookies.thx_guid};`;
            await this.store.saveCredentials(creds);
        }
    }

    async refreshAndWait() {
        const {
            unrelatedAccounts,
            maxRefreshingIds
        } = await this.store.loadConfig();

        // save for use in isRelevantAccount
        this.unrelatedAccounts = unrelatedAccounts;

        await this.mint.refreshAndWaitIfNeeded({
            doneRefreshing: doneRefreshing.bind(doneRefreshing,
                unrelatedAccounts, maxRefreshingIds),
        });
    }

    async loadBudgets() {
        const bothBudgets = await this.mint.getBudgets({
            months: 2,
        });

        if (bothBudgets.length >= 2) {
            const [ lastMonth, thisMonth ] = bothBudgets.slice(0, 2);
            this.budgets = thisMonth;
            this.lastBudgets = lastMonth;
        } else {
            this.budgets = bothBudgets[0];
            this.lastBudgets = null;
        }

        // load these eagerly since getCategories() has to return
        // instantly
        this.categories = await this.mint.categories();
    }

    async loadTransactions(category, options={}) {
        const opts = {
            offset: 0,
            strict: false,

            ...options,
        };
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const transactions = await this.mint.getTransactions({
            category: category.cat,
            offset: opts.offset,
            startDate: firstDay,
            endDate: lastDay,
        });

        // TODO do we need to do anything to transactions?

        if (opts.strict) {
            // when fetching for a parent category like Food & Dining, we also
            //  get child category transactions; for unbudgeted transactions,
            //  those are broken out as separate budgets, so we might not want that
            return transactions.filter(txn => txn.categoryId === category.cat);
        }

        return transactions;
    }

    async calculate() {
        const config = await this.store.loadConfig();
        const definiteCategories = config.definiteCategories || {};
        const goalCategories = config.goalCategories || {};

        const budgets = this.budgets;
        const lastBudgets = this.lastBudgets;

        // first step, neutralize rollover amounts
        neutralizeRollover(budgets);

        let lastMonthSpending = 0;
        let lastMonthRollover = 0;
        if (lastBudgets) {
            neutralizeRollover(lastBudgets);

            // calculate last month's spending/rollover
            const lastMonthBudgeted = sum(lastBudgets.spending, 'bgt');

            const unbudgetedItems = lastBudgets.unbudgeted.spending.filter(it => it.cat !== 0);
            lastMonthSpending = sum(lastBudgets.spending, 'spent')
                + sum(unbudgetedItems, 'spent');
            lastMonthRollover = lastMonthBudgeted - lastMonthSpending;
        }

        const budgeted = sum(budgets.spending, 'bgt');

        const unbudgetedItems = budgets.unbudgeted.spending.filter(b =>
            b.cat != 0 && b.spent > 0 && !goalCategories[b.category]
        );

        const unbudgetedSpending = sum(unbudgetedItems, 'spent');

        let inferredSpending = 0;
        const budgetedSpending = sum(budgets.spending.map(b => {
            if (definiteCategories[b.category]) {
                inferredSpending += b.bgt;
                return Math.max(b.spent, b.bgt);
            } else {
                return b.spent;
            }
        }));

        const totalSpent = budgetedSpending + unbudgetedSpending;
        const nonInferredSpending = budgetedSpending - inferredSpending;
        const spendable = budgeted - totalSpent + lastMonthRollover;

        // date math
        const now = new Date();
        const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const thisDay = now.getDate();
        let remainingDays = monthDays - thisDay;
        if (now.getHours() < 20) {
            // before 8pm, we add today as a remaining day
            ++remainingDays;
        }

        const inferredSpendable = budgeted - inferredSpending;
        const inferredSpendablePerDay = inferredSpendable / monthDays;

        const avgSpending = (nonInferredSpending + unbudgetedSpending) / thisDay;
        const spendablePerDay = spendable / remainingDays;


        const inferredSpendingItems = budgets.spending.filter(b => definiteCategories[b.category]);

        const budgetedSpendingItems = budgets.spending.filter(b => !definiteCategories[b.category] && b.spent > 0);

        const unbudgetedItemsDisplay =
            unbudgetedItems.sort((a, b) => a.category.localeCompare(b.category))
                .filter(b => b.cat !== 0 && b.spent > 0);

        return {
            budgeted,
            totalSpent,
            lastMonthSpending,
            lastMonthRollover,

            nonInferredSpending,
            inferredSpending,
            unbudgetedSpending,

            inferredSpendable,
            inferredSpendablePerDay,
            spendable,
            avgSpending,
            spendablePerDay,
            remainingDays,
            monthDays,

            inferredSpendingItems,
            budgetedSpendingItems,
            unbudgetedItems: unbudgetedItemsDisplay,
        }
    }

    getCategories() {
        return this.categories;
    }
}

module.exports = {
    SpendableService,

    doneRefreshing,
};
