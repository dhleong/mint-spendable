
const { EventEmitter } = require('events');
const PepperMint = require('pepper-mint');
const { delay } = require('./ui/util');

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

function findExtraIncome(items) {
    if (!items || !items.length) return 0;

    let income = 0;
    for (const item of items) {
        if (item.cat === 0) continue;
        income += item.amt;
    }

    return income;
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
            if (mint.sessionCookies && mint.sessionCookies.length) {
                let cookie = '';
                for (const c of mint.sessionCookies) {
                    if (c.name === 'ius_session' || c.name === 'thx_guid') {
                        cookie += `${c.name}=${c.value};`;
                    }
                }

                if (cookie.length) {
                    creds.cookie = cookie;
                }
            }

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

        try {
            await this.mint.refreshAndWaitIfNeeded({
                doneRefreshing: doneRefreshing.bind(doneRefreshing,
                    unrelatedAccounts, maxRefreshingIds),
            });
        } catch (e) {
            this.emit('status', "Error refreshing accounts\n" + e.body);

            await delay(1000);
        }
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
        const plannedCategories = config.plannedCategories || {};

        const budgets = this.budgets;
        const lastBudgets = this.lastBudgets;

        // first step, neutralize rollover amounts
        neutralizeRollover(budgets);

        const isRelevantUnbudgetedItem = b => (
            b.cat !== 0 && b.spent > 0
            && !goalCategories[b.category]
        );

        let lastMonthSpending = 0;
        let lastMonthRollover = 0;
        if (lastBudgets) {
            neutralizeRollover(lastBudgets);

            // calculate last month's spending/rollover
            const lastMonthBudgeted = sum(lastBudgets.spending, 'bgt');

            const unbudgetedItems = lastBudgets.unbudgeted.spending.filter(
                isRelevantUnbudgetedItem);
            const unplannedItems = unbudgetedItems.filter(b => !plannedCategories[b.category]);
            lastMonthSpending = sum(lastBudgets.spending, 'spent')
                + sum(unplannedItems, 'spent')

            // offset with any extra income
            const extraIncome = findExtraIncome(lastBudgets.unbudgeted.income);

            // NOTE: If we underspent, this will be POSITIVE
            lastMonthRollover = lastMonthBudgeted - lastMonthSpending + extraIncome;
        }

        const unbudgetedIncome = findExtraIncome(budgets.unbudgeted.income);

        const budgeted = sum(budgets.spending, 'bgt');

        const unbudgetedItems = budgets.unbudgeted.spending.filter(
            isRelevantUnbudgetedItem);
        const unplannedItems = unbudgetedItems.filter(b => !plannedCategories[b.category]);

        const unbudgetedSpending = sum(unplannedItems, 'spent');

        let inferredSpending = 0;
        const budgetedSpending = sum(budgets.spending.map(b => {
            if (definiteCategories[b.category]) {
                inferredSpending += b.bgt;
                return Math.max(b.spent, b.bgt);
            } else {
                return b.spent;
            }
        }));

        const totalSpent = budgetedSpending + unbudgetedSpending - lastMonthRollover - unbudgetedIncome;
        const nonInferredSpending = budgetedSpending - inferredSpending;
        const spendable = budgeted - totalSpent;

        // date math
        const now = new Date();
        const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const thisDay = now.getDate();
        let remainingDays = monthDays - thisDay;
        if (now.getHours() < 20) {
            // before 8pm, we add today as a remaining day
            ++remainingDays;
        }

        const inferredSpendable = budgeted - inferredSpending + lastMonthRollover + unbudgetedIncome;
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
            unbudgetedIncome,

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
