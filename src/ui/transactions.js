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

        blessed.Text({
            parent: box,
            align: 'center',
            top: -1,
            left: 'center',
            content: ` ${category.category} `,
        });

        blessed.ListTable({
            parent: box,
            align: 'left',
            left: 1,
            top: 1,
            right: 1,
            bottom: 1,
            rows: [headers].concat(rows),
            tags: true,
        });

        // TODO can we override `q` to go back as well?
        box.key('backspace', () => {
            this.emit('back');
        });
        box.focus();

        this.screen.append(box);
        this.screen.render();
    }
}

module.exports = {
    TransactionsUI,
};
