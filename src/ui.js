
const { EventEmitter } = require('events');
const blessed = require('blessed');

const CATEGORY_KINDS = [
    ['inferredSpendingItems', "Inferred Spending", 'bgt'],
    ['rolledOverItems', "Rolled Over", 'amt'],
    ['budgetedSpendingItems', "Budgeted Spending", 'amt'],
    ['unbudgetedItems', "Unbudgeted Spending", 'amt'],
];

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

function cleanHeader(header) {
    return header.replace("{bold}", "")
        .replace("{/bold}", "");
}

function tableIndexToCategory(categoryNameToItems, rows, index) {
    let header;
    let offset = -1;
    for (let i=index; i >= 0; --i) {
        if (rows[i].length === 1) {
            // found the header
            header = cleanHeader(rows[i][0]);
            offset = index - i - 1;
            break;
        }
    }

    if (!header) return;

    const items = categoryNameToItems[header];
    if (!items) {
        throw new Error("No category called" + header);
    }

    return items[offset];
}

class Loader extends blessed.Box {
    constructor(options) {
        super(options);

        this.minHeight = options.minHeight || 2;

        this._.icons = [
            '⠄', '⠆', '⠇', '⠋',
            '⠉',
            '⠈', '⠘', '⠸', '⠴',
            '⠤',
        ];
        this._.iconIndex = 0;

        this._.text = new blessed.Box({
            parent: this,
            align: 'center',
            left: 4,
            right: 4,
            height: 1,
        });
        this._.icon = new blessed.Text({
            parent: this,
            align: 'center',
            top: 2,
            left: 'center',
            height: 1,
            content: this._.icons[0],
        });

        this.on('destroy', () => this.stop());
    }

    load(text) {
        const lines = count(text, '\n');
        this._.icon.top = Math.max(this.minHeight - 1, lines) + 1;
        this._.text.height = lines + 1;
        this.height = lines + 2;

        if (!this.hidden) this.stop();
        this.show();
        this._.text.setContent(text);

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

class SpendableUI extends EventEmitter {

    constructor() {
        super();

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

            this.screen.key(['escape', 'q'], () => {
                return process.exit(0);
            });
        } else {
            this.loader.load(status);
        }
    }

    showBudget(b) {
        // TODO proper UI
        const box = this.box = new blessed.Box({
            top: 'center',
            left: 'center',
            width: '100%',
            height: '100%',
            border: {
                type: 'line',
            },
        });

        let extra = 0;
        let spendingContents =
            `Budgeted ${fmt$(b.budgeted)}; spent {bold}${fmt$(b.totalSpent)}{/bold}\n` +
            `        Actual spending: ${fmt$(b.nonInferredSpending)}\n` +
            `  +   Inferred spending: ${fmt$(b.inferredSpending)}`;
        if (b.unbudgetedSpending > 0) {
            spendingContents += `\n  + Unbudgeted spending: ${fmt$(b.unbudgetedSpending)}`;
            extra = 1;
        }
        blessed.Text({
            parent: box,
            left: 1,
            top: 2,
            height: 3 + extra,
            width: '50%',
            align: 'left',
            content: spendingContents,
            tags: true,
        });

        const spendableContents =
            ` Inferred spendable: ${fmt$(b.inferredSpendable)}\n` +
            `            per day: ${fmt$(b.inferredSpendablePerDay)}\n` +
            `Remaining spendable: ${fmt$(b.spendable)}\n` +

            `  Spendable per day: {bold}${fmt$(b.spendablePerDay)}{/bold}\n` +
            `                     (${b.remainingDays}/${b.monthDays} days left)\n` +
            `   Average spending: ${fmt$(b.avgSpending)}`;

        blessed.Text({
            parent: box,
            right: 1,
            top: 1,
            height: 6,
            width: '50%',
            align: 'left',
            content: spendableContents,
            tags: true,
        });

        // and now... the budget category items lists
        const categoriesBox = blessed.Box({
            parent: box,
            left: 1,
            right: 1,
            top: 8,
            height: '100%-10',
        });

        let rows = [];
        let categoryNameToItems = {};
        for (const [key, name, moneyKey] of CATEGORY_KINDS) {
            const items = b[key];
            if (!Array.isArray(items) || !items.length) continue;

            const category = this._makeCategory(name, items, moneyKey);
            categoryNameToItems[name] = category.items;
            rows = rows.concat(category.rows);
        }

        const categories = blessed.ListTable({
            parent: categoriesBox,
            align: 'left',
            width: '100%',
            height: rows.length,
            rows: rows,
            tags: true,

            mouse: true,
            keys: true,
            vi: true,
        });

        // manually set since otherwise it's ignored
        categories.style.selected = {
            inverse: true
        };
        categories.on('select', (item, index) => {
            const category = tableIndexToCategory(
                categoryNameToItems, rows, index);
            if (category) {
                this._onCategorySelected(category);
            } else {
                // TODO it was a header; deselect it (?)
            }
        });
        categories.focus();

        this.screen.append(box);
        this.screen.render();
    }

    _makeCategory(name, items, moneyKey) {
        const header = `{bold}${name}{/bold}`;
        const listRows = items.map(item =>
            [' ' + item.category, fmt$(item[moneyKey])]
        );
        return {
            items,
            rows: [ [header] ].concat(listRows),
        };
    }

    _onCategorySelected(category) {
        this.emit('show-category-transactions', category);
    }

    printBudget(b) {
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

    // for testing
    tableIndexToCategory,
};
