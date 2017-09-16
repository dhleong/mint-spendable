
const CONFIG_FILE = '../config.json';

const { EventEmitter } = require('events');
const PepperMint = require('pepper-mint');
const config = require(CONFIG_FILE);

const definiteCategories = config.definiteCategories.reduce((m, cat) => {
    m[cat] = true;
    return m;
}, {});
/** goal categories are ignored in unbudgeted spending */
const goalCategories = config.goalCategories.reduce((m, cat) => {
    m[cat] = true;
    return m;
}, {});
const ignoredRollover = config.ignoredRolloverCategories.reduce((m, cat) => {
    m[cat] = true;
    return m;
}, {});
const maxRefreshingIds = config.maxRefreshingIds || 0;


function doneRefreshing(accounts) {
    let remaining = accounts.length;
    if (config.unrelatedAccounts) {
        for (const account of accounts) {
            if (config.unrelatedAccounts.indexOf(account.name) !== -1) {
                // unrelated; ignore it
                --remaining;
            }
        }
    }

    return remaining <= maxRefreshingIds;
}

class SpendableService extends EventEmitter {

    async login() {
        const mint = this.mint = await PepperMint(config.username, config.password, config.cookie)
        if (!config.cookie) {
            config.cookie = `ius_session=${mint.sessionCookies.ius_session}; ` +
                `thx_guid=${mint.sessionCookies.thx_guid};`;
            const fs = require('fs');
            fs.writeFile(CONFIG_FILE, JSON.stringify(config), e => {
                if (e) console.warn("Unable to save cookies!");
            });
        }

        mint.on('refreshing', ev => this.emit('refreshing', ev));
    }

    async refreshAndWait() {
        await this.mint.refreshAndWaitIfNeeded({
            doneRefreshing: doneRefreshing
        });
    }

    async loadBudgets() {
        this.budgets = await this.mint.getBudgets();
    }

    async loadTransactions(category, offset=0) {
        const transactions = await this.mint.getTransactions({
            category: category.cat,
            offset,
        });

        // TODO do anything?
        return transactions;
    }

    async calculate() {
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

}

module.exports = {
    SpendableService,
};
