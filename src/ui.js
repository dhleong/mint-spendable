
const { EventEmitter } = require('events');
const blessed = require('neo-blessed');
const { IndefiniteProgressBox } = require('./ui/widgets');

const { LoginUI } = require('./ui/login');
const { MainUI } = require('./ui/main');
const { TransactionsUI } = require('./ui/transactions');
const { TxnUI } = require('./ui/txn');

const UI_EVENTS = {
    main: ['quit', 'refresh-budget', 'show-category-transactions'],
    transactions: ['back', 'edit-transaction'],
    txn: ['close-transaction', 'update-transaction'],
};

function count(text, targetChar) {
    let start = -1;
    let count = 0;
    do {
        start = text.indexOf(targetChar, start + 1);
        if (start !== -1) ++count;
    } while (start !== -1);
    return count;
}

class Loader extends blessed.Box {
    constructor(options) {
        super(options);

        this.minHeight = options.minHeight || 2;

        this._.text = new blessed.Box({
            parent: this,
            align: 'center',
            left: 4,
            right: 4,
            height: 1,
        });
        this._.icon = new IndefiniteProgressBox({
            parent: this,
            top: 2,
            left: 'center',
        });
    }

    load(text) {
        const lines = count(text, '\n');
        this._.icon.top = Math.max(this.minHeight - 1, lines) + 1;
        this._.text.height = lines + 1;
        this.height = lines + 2;

        this._.icon.show();
        this.show();
        this._.text.setContent(text);
    }

    stop() {
        this.hide();
        this._.icon.stop();
    }
}


class SpendableUI extends EventEmitter {

    constructor() {
        super();

        const screen = this.screen = blessed.screen({
            smartCSR: true
        });

        screen.title = "Spendable";

        // Always quit on Control-C.
        screen.key(['C-c'], () => {
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

        this._ui = {
            login: new LoginUI(screen),
            main: new MainUI(screen),
            transactions: new TransactionsUI(screen),
            txn: new TxnUI(screen),
        };

        // forward any events
        for (const event of Object.keys(UI_EVENTS)) {
            const ui = this._ui[event];
            const events = UI_EVENTS[event];

            for (const event of events) {
                ui.on(event, (...args) =>
                    this.emit(event, ...args)
                );
            }
        }
    }

    setActivity(status) {
        if (this._activeUI && this._activeUI.setActivity) {
            this._activeUI.setActivity(status);
        }
    }

    setLoading(status) {
        if (!status) {
            this.loader.stop();
        } else {
            for (const kind of Object.keys(this._ui)) {
                this._ui[kind].hide();
            }
            this.loader.load(status);
        }
    }

    showBudget(b) {
        if (b) {
            this._ui.main.setBudget(b);
        }
        this._ui.main.show();
        this._activeUI = this._ui.main;
    }

    showEditTransaction(categories, transaction) {
        this._ui.txn.show(categories, transaction);
        this._activeUI = this._ui.txn;
    }

    hideEditTransaction() {
        this._ui.txn.hide();
        this._activeUI = this._ui.transactions;
    }

    async showLogin() {
        this._ui.login.show();
        return await this._ui.login.awaitLogin();
    }

    showTransactions(category, transactions) {
        this._ui.transactions.showTransactions(category, transactions);
        this._activeUI = this._ui.transactions;
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
