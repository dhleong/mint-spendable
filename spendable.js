#!/usr/bin/env node

const CONFIG_FILE = './config.json';

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
    // TODO we could have a specific list of accounts to ignore
    return accounts.length <= maxRefreshingIds;
}

function fmt$(amount) {
    return '$' + amount.toFixed(2);
}

console.log("Signing in...");
(async () => {
    const mint = await PepperMint(config.username, config.password, config.cookie)
    if (!config.cookie) {
        config.cookie = `ius_session=${mint.sessionCookies.ius_session}; ` +
            `thx_guid=${mint.sessionCookies.thx_guid};`;
        const fs = require('fs');
        fs.writeFile(CONFIG_FILE, JSON.stringify(config), e => {
            if (e) console.warn("Unable to save cookies!");
        });
    }

    var firstNotification = true;
    mint.on('refreshing', accounts => {
        const names = accounts.map(it => it.name);
        if (firstNotification) {
            console.log("Refreshing accounts: ", names);
        } else {
            console.log("Still refreshing: ", names);
        }
    });

    console.log("Checking if accounts need to be refreshed...");
    await mint.refreshAndWaitIfNeeded({
        doneRefreshing: doneRefreshing
    });

    console.log("Fetching budgets...");
    const budgets = await mint.getBudgets();

    let budgeted = budgets.spending.map(b => b.bgt)
        .reduce((total, a) => {
            return total + a;
        });

    let unbudgetedItems = budgets.unbudgeted.spending.filter(b =>
        b.cat != 0 && b.amt > 0 && !goalCategories[b.category]
    );

    let unbudgeted = unbudgetedItems.map(b => b.amt).reduce((total, a) => {
        return total + a;
    }, 0);

    let definiteSpending = 0;
    let spent = budgets.spending.map(b => {
        if (definiteCategories[b.category]) {
            definiteSpending += b.bgt;
            return Math.max(b.amt, b.bgt);
        } else if (b.amt > 0 && !ignoredRollover[b.category]) {
            return b.amt;
        } else {
            return 0;
        }
    }).reduce((total, a) => {
        return total + a;
    }, 0);

    let nonInferredSpending = spent - definiteSpending;
    let spendable = budgeted - spent - unbudgeted;
    console.log();
    console.log();
    console.log(`Budgeted ${fmt$(budgeted)}; spent ${fmt$(spent + unbudgeted)}`);
    console.log(`        Actual spending: ${fmt$(nonInferredSpending)}`);
    console.log(`  +   Inferred spending: ${fmt$(definiteSpending)}`);
    if (unbudgeted > 0) {
        console.log(`  + Unbudgeted spending: ${fmt$(unbudgeted)}\n`);
    }

    let now = new Date();
    let monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    console.log(` Inferred spendable: ${fmt$(budgeted - definiteSpending)}`);
    console.log(`            per day: ${fmt$((budgeted - definiteSpending) / monthDays)}`);
    console.log(`Remaining spendable: ${fmt$(spendable)}`);

    let thisDay = now.getDate();
    let remainingDays = monthDays - thisDay;
    let avgSpending = (nonInferredSpending + unbudgeted) / thisDay;

    if (now.getHours() < 20) {
        // before 8pm, we add today as a remaining day
        ++remainingDays;
    }

    console.log(`  Spendable per day: ${fmt$(spendable / remainingDays)}`);
    console.log(`                     (${remainingDays}/${monthDays} days left)`);
    console.log(`   Average spending: ${fmt$(avgSpending)}`);

    console.log("\nInferred spending:");
    budgets.spending.filter(b => definiteCategories[b.category]).forEach(b => {
        console.log(` - ${b.category}: ${fmt$(b.bgt)}`);
    });

    console.log("Rolled over:");
    budgets.spending.filter(b => !ignoredRollover[b.category] && b.amt < 0)
    .forEach(b => {
        console.log(` - ${b.category}: ${fmt$(b.amt)}`);
    });

    console.log("Budgeted spending:");
    budgets.spending.filter(b => !definiteCategories[b.category] && b.amt > 0).forEach(b => {
        console.log(` - ${b.category}: ${fmt$(b.amt)}`);
    });

    if (unbudgetedItems.length) {
        console.log("Unbudgeted spending:");
        unbudgetedItems.sort((a, b) => a.category.localeCompare(b.category));
        unbudgetedItems.forEach(b => {
            if (b.cat != 0 && b.amt > 0) {
                console.log(` - ${b.category}: ${fmt$(b.amt)}`);
            }
        });
    }
})().catch(e => {
    console.log(e);
    console.log(e.stack);
});
