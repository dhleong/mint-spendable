/**
 * Main-screen UI for Spendable
 */

const { EventEmitter } = require('events');
const blessed = require('neo-blessed');
const { fmt$ } = require('./util');

const CATEGORY_KINDS = [
    ['inferredSpendingItems', "Inferred Spending", 'bgt'],
    ['budgetedSpendingItems', "Budgeted Spending", 'spent'],
    ['unbudgetedItems', "Unbudgeted Spending", 'spent'],
];

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

    // calculate the category kind
    const category = CATEGORY_KINDS.find(cat => cat[1] === header);
    const kind = category[0];

    return [kind, items[offset]];
}

class MultiHeaderListTable extends blessed.ListTable {
    move(offset) {
        let target = this.selected + offset;
        for (;;) {
            if (target >= this.rows.length) {
                if (target === 1) break; // nowhere to go
                target = 1;
                continue;
            }

            if (target <= 0) {
                if (target === this.rows.length - 1) break; // as above
                target = this.rows.length - 1;
                continue;
            }

            if (this.isHeaderRow(target)) {
                // header row; keep going
                target += offset;
            }

            // good to go
            break;
        }

        this.select(target);
        if (this.parent && this.parent.scrollable) {
            // NOTE: subtract 1 from both since we will never be on the first
            // row (it's always a header)
            this.parent.setScrollPerc(100 * ((target - 1) / (this.rows.length - 1)));
        }
    }

    isHeaderRow(index) {
        return this.rows[index].length === 1;
    }
}

class MainUI extends EventEmitter {
    constructor(screen) {
        super();

        this.screen = screen;
    }

    setBudget(b) {
        this.budget = b;

        if (this.box) {
            this.screen.remove(this.box);
        }

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
            ++extra;
        }

        if (b.unbudgetedIncome > 0) {
            spendingContents += `\n  -   Unbudgeted Income: ${fmt$(b.unbudgetedIncome)}`;
            ++extra;
        }

        if (b.lastMonthRollover > 0) {
            spendingContents += `\n  -  Unspent last month: ${fmt$(b.lastMonthRollover)}`;
            ++extra;
        } else if (b.lastMonthRollover < 0) {
            spendingContents += `\n  +   Rollover spending: ${fmt$(-b.lastMonthRollover)}`;
            ++extra;
        }

        blessed.Text({
            parent: box,
            left: 1,
            top: 2 - Math.max(0, extra - 2),
            height: 3 + extra,
            width: '50%',
            align: 'left',
            content: spendingContents,
            tags: true,
        });

        /** 10% slop; half on either side */
        const slop = b.inferredSpendablePerDay * .05;
        let spendingColor;
        if (b.avgSpending <= b.inferredSpendablePerDay - slop) {
            spendingColor = "green-fg";
        } else if (b.avgSpending <= b.inferredSpendablePerDay + slop) {
            spendingColor = "yellow-fg";
        } else {
            spendingColor = "red-fg";
        }

        const spendableContents =
            ` Inferred spendable: ${fmt$(b.inferredSpendable)}\n` +
            `            per day: ${fmt$(b.inferredSpendablePerDay)}\n` +
            `Remaining spendable: ${fmt$(b.spendable)}\n` +

            `  Spendable per day: {bold}${fmt$(b.spendablePerDay)}{/bold}\n` +
            `                     (${b.remainingDays}/${b.monthDays} days left)\n` +
            `   Average spending: {${spendingColor}}${fmt$(b.avgSpending)}{/${spendingColor}}`;

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
            bottom: 0,
            scrollable: true,
        });

        let rows = [];
        let categoryNameToItems = {};
        for (const [key, name, moneyKey] of CATEGORY_KINDS) {
            const items = b[key];
            if (!Array.isArray(items) || !items.length) continue;

            const category = this._makeCategory(key, name, items, moneyKey);
            categoryNameToItems[name] = category.items;
            rows = rows.concat(category.rows);
        }

        const categories = this.categories = new MultiHeaderListTable({
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
            this._savedCategory = index;
            const [key, category] = tableIndexToCategory(
                categoryNameToItems, rows, index);
            if (category) {
                this._onCategorySelected(key, category);
            } else {
                // TODO it was a header; deselect it (?)
            }
        });
        categories.key(['q', 'escape'], () => this.emit('quit'));
        categories.key(['r'], () => this.emit('refresh-budget'));
        categories.focus();
    }

    show() {
        this.categories.focus();
        this.screen.append(this.box);

        if (this._savedCategory !== undefined) {
            this.categories.select(this._savedCategory);
        }

        this.screen.render();
    }

    hide() {
        if (this.box) this.box.detach();
    }

    _makeCategory(kind, name, items, moneyKey) {
        const header = `{bold}${name}{/bold}`;
        const listRows = items.map(item => {
            const moneyFormatted = fmt$(item[moneyKey]);

            // ONLY for budgetedSpending, if we overspent, colorize it.
            // this is not a great way to do this, but it's simple for now
            const money = (kind === 'budgetedSpendingItems' && item[moneyKey] > item.bgt)
                ? `{red-fg}${moneyFormatted}{/red-fg}`
                : moneyFormatted;

            return [' ' + item.category, money];
        });
        return {
            items,
            rows: [ [header] ].concat(listRows),
        };
    }

    _onCategorySelected(kind, category) {
        this.emit('show-category-transactions', kind, category);
    }
}

module.exports = {
    MainUI,

    // for testing
    tableIndexToCategory,
};
