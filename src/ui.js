
const { EventEmitter } = require('events');
const blessed = require('blessed');

const { LoginUI } = require('./ui/login');
const { MainUI } = require('./ui/main');
const { TransactionsUI } = require('./ui/transactions');

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

        this._ui = {
            login: new LoginUI(screen),
            main: new MainUI(screen),
            transactions: new TransactionsUI(screen),
        };

        // forward events: (is there a better way?)
        this._ui.main.on('show-category-transactions', (...args) => {
            this.emit('show-category-transactions', ...args);
        });
        this._ui.transactions.on('back', () => {
            this.emit('back');
        });
    }

    setLoading(status) {
        if (!status) {
            this.loader.stop();

            this.screen.key(['escape', 'q'], () => {
                return process.exit(0);
            });
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
    }

    async showLogin() {
        this._ui.login.show();
        return await this._ui.login.awaitLogin();
    }

    showTransactions(category, transactions) {
        this._ui.transactions.showTransactions(category, transactions);
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
