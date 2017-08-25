#!/usr/bin/env node

const PepperMint = require('pepper-mint');
const config = require('./config.json');

let definiteCategories = config.definiteCategories.reduce((m, cat) => {
    m[cat] = true;
    return m;
}, {});

function fmt$(amount) {
    return '$' + amount.toFixed(2);
}

PepperMint(config.username, config.password, config.cookie)
.then(mint => {
    return mint.getBudgets();
}).then(budgets => {
    let budgeted = budgets.spending.map(b => b.bgt)
        .reduce((total, a) => {
            return total + a;
        });

    let unbudgetedItems = budgets.unbudgeted.spending.filter(b =>
        b.cat != 0 && b.amt > 0
    );

    let unbudgeted = unbudgetedItems.map(b => b.amt).reduce((total, a) => {
        return total + a;
    });

    let definiteSpending = 0;
    let spent = budgets.spending.map(b => {
        if (definiteCategories[b.category]) {
            definiteSpending += b.bgt;
            return Math.max(b.amt, b.bgt);
        } else {
            return b.amt;
        }
    }).reduce((total, a) => {
        return total + a;
    });

    let nonInferredSpending = spent - definiteSpending;
    let spendable = budgeted - spent - unbudgeted;
    console.log();
    console.log(`Budgeted ${fmt$(budgeted)}; spent ${fmt$(spent + unbudgeted)}`);
    console.log(`        Actual spending: ${fmt$(nonInferredSpending)}`);
    console.log(`  +   Inferred spending: ${fmt$(definiteSpending)}`);
    console.log(`  + Unbudgeted spending: ${fmt$(unbudgeted)}\n`);

    console.log(` Inferred spendable: ${fmt$(budgeted - definiteSpending)}`);
    console.log(`Remaining spendable: ${fmt$(spendable)}`);

    let now = new Date();
    let monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let remainingDays = monthDays - now.getDate();

    if (now.getHours() < 20) {
        // before 8pm, we add today as a remaining day
        ++remainingDays;
    }

    console.log(`  Spendable per day: ${fmt$(spendable / remainingDays)}`);
    console.log(`                     (${remainingDays}/${monthDays} days left)\n`);

    console.log("Inferred spending:");
    budgets.spending.filter(b => definiteCategories[b.category]).forEach(b => {
        console.log(` - ${b.category}: ${fmt$(b.bgt)}`);
    });

    console.log("Unbudgeted spending:");
    unbudgetedItems.sort((a, b) => a.category.localeCompare(b.category));
    unbudgetedItems.forEach(b => {
        if (b.cat != 0 && b.amt > 0) {
            console.log(` - ${b.category}: ${fmt$(b.amt)}`);
        }
    });

}).fail(err => {
    console.log("ERRR", err);
    if (err) throw err;
});
