
const { EventEmitter } = require('events');
const PepperMint = require('pepper-mint');

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

    return remaining <= maxRefreshingIds;
}

class SpendableService extends EventEmitter {

    constructor(store, requestCredentials) {
        super();

        this.store = store;
        this.requestCredentials = requestCredentials;
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

        const mint = this.mint = await PepperMint(creds.username, creds.password, creds.cookie)
        if (neededCreds || !creds.cookie) {
            creds.cookie = `ius_session=${mint.sessionCookies.ius_session}; ` +
                `thx_guid=${mint.sessionCookies.thx_guid};`;
            await this.store.saveCredentials(creds);
        }

        mint.on('refreshing', ev => this.emit('refreshing', ev));
    }

    async refreshAndWait() {
        const {
            unrelatedAccounts,
            maxRefreshingIds
        } = await this.store.loadConfig();

        await this.mint.refreshAndWaitIfNeeded({
            doneRefreshing: doneRefreshing.bind(doneRefreshing,
                unrelatedAccounts, maxRefreshingIds),
        });
    }

    async loadBudgets() {
        this.budgets = await this.mint.getBudgets();

        // load these eagerly since getCategories() has to return
        // instantly
        this.categories = await this.mint.categories();
    }

    async loadTransactions(category, offset=0) {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const transactions = await this.mint.getTransactions({
            category: category.cat,
            offset,
            startDate: firstDay,
            endDate: lastDay,
        });

        // TODO do we need to do anything to it?
        return transactions;
    }

    async calculate() {
        const config = await this.store.loadConfig();
        const {
            definiteCategories,
            goalCategories,
            ignoredRollover,
        } = config;

        const budgets = this.budgets;

        const budgeted = budgets.spending.map(b => b.bgt)
            .reduce((total, a) => {
                return total + a;
            });

        const unbudgetedItems = budgets.unbudgeted.spending.filter(b =>
            b.cat != 0 && b.amt > 0 && !goalCategories[b.category]
        );

        const unbudgetedSpending = unbudgetedItems.map(b => b.amt).reduce((total, a) => {
            return total + a;
        }, 0);

        let inferredSpending = 0;
        const budgetedSpending = budgets.spending.map(b => {
            if (definiteCategories[b.category]) {
                inferredSpending += b.bgt;
                return Math.max(b.amt, b.bgt);
            } else if (b.amt > 0 && !ignoredRollover[b.category]) {
                return b.amt;
            } else {
                return 0;
            }
        }).reduce((total, a) => {
            return total + a;
        }, 0);

        const totalSpent = budgetedSpending + unbudgetedSpending;
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

        const inferredSpendable = budgeted - inferredSpending;
        const inferredSpendablePerDay = inferredSpendable / monthDays;

        const avgSpending = (nonInferredSpending + unbudgetedSpending) / thisDay;
        const spendablePerDay = spendable / remainingDays;


        const inferredSpendingItems = budgets.spending.filter(b => definiteCategories[b.category]);

        const rolledOverItems = budgets.spending.filter(b => !ignoredRollover[b.category] && b.amt < 0);

        const budgetedSpendingItems = budgets.spending.filter(b => !definiteCategories[b.category] && b.amt > 0);

        const unbudgetedItemsDisplay =
            unbudgetedItems.sort((a, b) => a.category.localeCompare(b.category))
                .filter(b => b.cat !== 0 && b.amt > 0);

        return {
            budgeted,
            totalSpent,

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
            rolledOverItems,
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
};
