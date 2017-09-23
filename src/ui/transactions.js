/**
 * Transactions list UI for Spendable
 */

const { EventEmitter } = require('events');
const blessed = require('blessed');

class TransactionsUI extends EventEmitter {

    constructor(screen) {
        super();

        this.screen = screen;
    }

    hide() {
        if (this.box) this.box.destroy();
    }

    showTransactions(category, transactions) {

        const rows = transactions.map(txn => [
            txn.date,
            txn.merchant,
            txn.amount,
        ]);

        const headers = [
            "Date", "Merchant", "Amount",
        ].map(it => `{bold}${it}{/bold}`);

        const box = this.box = new blessed.Box({
            align: 'center',
            top: 'center',
            left: 'center',
            width: '100%',
            height: '100%',
            border: {
                type: 'line',
            },
        });

        const table = blessed.ListTable({
            parent: box,
            align: 'left',
            left: 1,
            top: 1,
            right: 1,
            bottom: 1,
            rows: [headers].concat(rows),
            tags: true,

            keys: true,
            mouse: true,
            vi: true,
        });

        // manually set since otherwise it's ignored
        table.style.selected = {
            inverse: true
        };

        table.on('select', (_, index) => {
            // NOTE: `index` includes the header row,
            // so we subtract one when emitting the event
            this._savedIndex = index;
            this.emit('edit-transaction', transactions[index - 1]);
        });

        // TODO can we override `q` to go back as well?
        table.key('backspace', () => {
            this.emit('back');
        });
        table.focus();

        const header = blessed.Text({
            parent: box,
            align: 'center',
            top: -1,
            left: 'center',
            width: category.category.length + 2,
            content: ` ${category.category} `,
        });
        header.setFront();

        this.screen.append(box);
        this.screen.render();
    }
}

module.exports = {
    TransactionsUI,
};
