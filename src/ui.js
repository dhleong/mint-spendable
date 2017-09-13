
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
        screen.key([/* 'escape', 'q', */ 'C-c'], (ch, key) => {
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

    stop() {
        this.screen.destroy();
    }
}

module.exports = {
    SpendableUI,
};
