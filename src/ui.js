
const blessed = require('blessed');

function count(text, targetChar) {
    let start = -1;
    let count = 0;
    do {
        start = text.indexOf(targetChar, start + 1);
        if (start !== -1) ++count;
    } while (start !== -1);
    return count;
}

function fmt$(amount) {
    return '$' + amount.toFixed(2);
}

class Loader extends blessed.Box {
    constructor(options) {
        super(options);

        this._.icons = [
            '⠄', '⠆', '⠇', '⠋',
            '⠉',
            '⠈', '⠘', '⠸', '⠴',
            '⠤',
        ];
        this._.iconIndex = 0;

        this._.icon = new blessed.Text({
            parent: this,
            align: 'center',
            top: 2,
            left: 'center',
            height: 1,
            content: this._.icons[0]
        });

        this.on('destroy', () => this.stop());
    }

    load(text) {
        this.height = count(text, '\n') + 2;
        if (!this.hidden) this.stop();
        this.show();
        this.setContent(text);

        if (this._.timer) {
            this.stop();
        }

        this._.timer = setInterval(() => {
            this._.iconIndex = ++this._.iconIndex % this._.icons.length;
            this._.icon.setContent(this._.icons[this._.iconIndex]);
            this.screen.render();
        }, 100);
    }

    stop() {
        this.hide();
        if (this._.timer) {
            clearInterval(this._.timer);
            delete this._.timer;
        }
        this.screen.render();
    }
}

class SpendableUI {

    constructor() {
        const screen = this.screen = blessed.screen({
            smartCSR: true
        });

        screen.title = "Spendable";

        // Quit on Control-C.
        screen.key([/* 'escape', 'q', */ 'C-c'], () => {
            return process.exit(0);
        });

        this.loader = new Loader({
            top: 'center',
            left: 'center',
            align: 'center',
            width: '100%',
            height: 2,
        });
        screen.append(this.loader);

        screen.render();
    }

    setLoading(status) {
        if (!status) {
            this.loader.stop();
        } else {
            this.loader.load(status);
        }
    }

    showBudget(b) {
        this.stop();

        // TODO proper UI
        console.log();
        console.log();
        console.log(`Budgeted ${fmt$(b.budgeted)}; spent ${fmt$(b.totalSpent)}`);
        console.log(`        Actual spending: ${fmt$(b.nonInferredSpending)}`);
        console.log(`  +   Inferred spending: ${fmt$(b.inferredSpending)}`);
        if (b.unbudgetedSpending > 0) {
            console.log(`  + Unbudgeted spending: ${fmt$(b.unbudgetedSpending)}\n`);
        }

        console.log(` Inferred spendable: ${fmt$(b.inferredSpendable)}`);
        console.log(`            per day: ${fmt$(b.inferredSpendablePerDay)}`);
        console.log(`Remaining spendable: ${fmt$(b.spendable)}`);

        console.log(`  Spendable per day: ${fmt$(b.spendablePerDay)}`);
        console.log(`                     (${b.remainingDays}/${b.monthDays} days left)`);
        console.log(`   Average spending: ${fmt$(b.avgSpending)}`);

        console.log("\nInferred spending:");
        b.inferredSpendingItems.forEach(item => {
            console.log(` - ${item.category}: ${fmt$(item.bgt)}`);
        });

        console.log("Rolled over:");
        b.rolledOverItems.forEach(item => {
            console.log(` - ${item.category}: ${fmt$(item.amt)}`);
        });

        console.log("Budgeted spending:");
        b.budgetedSpendingItems.forEach(item => {
            console.log(` - ${item.category}: ${fmt$(item.amt)}`);
        });

        if (b.unbudgetedItems.length) {
            console.log("Unbudgeted spending:");
            b.unbudgetedItems.forEach(item => {
                console.log(` - ${item.category}: ${fmt$(item.amt)}`);
            });
        }
    }

    reportError(e) {
        // TODO ?
        this.stop();

        console.error("======= ERROR ===========================================");
        console.error(e);
        console.error(e.stack);
    }

    stop() {
        this.screen.destroy();
    }
}

module.exports = {
    SpendableUI,
};
