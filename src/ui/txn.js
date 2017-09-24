/*
 * Single transaction Pop-up UI
 */

const { EventEmitter } = require('events');
const blessed = require('blessed');

const INPUT_STYLE = {
    style: {
        bg: 'black',
        fg: 'bright-white',
    },
    border: {
        bg: 'black',
        fg: 'white',
        type: 'line',
    },
};

function describeFixed(txn) {
    return `${txn.fi}\n(${txn.account})\n` +
        `"${txn.omerchant}"` +
        `\n\n${txn.date}\n{bold}${txn.amount}{/bold}`;
}

class Spinner extends blessed.Button {
    constructor(options) {
        super({
            height: 3,

            ...options
        });

        this.selected = options.selected || 0;
        this.items = options.items;
        this._updateContent();

        this.on('press', () => this._showSelect());
    }

    _updateContent() {
        this.setContent(this._contentOf(this.items[this.selected]));
    }

    _contentOf(item) {
        if (typeof(item) === 'string') return item;
        if (item.content) return item.content;
        return '';
    }

    _showSelect() {
        // TODO
    }
}

class TxnUI extends EventEmitter {

    constructor(screen) {
        super();

        this.screen = screen;
    }

    show(txn) {
        this.hide();
        this._txn = txn;

        const box = this.box = new blessed.Box({
            align: 'center',
            top: 'center',
            left: 'center',
            width: '80%',
            height: '100%',
            padding: 1,

            clickable: true,

            shadow: true,
            style: {
                bg: 'black',
                fg: 'bright-white',
            },
            border: {
                bg: 'white',
            },

            tags: true,
            content: describeFixed(txn),
        });
        box.key('backspace', () =>
            this.emit('close-transaction', txn)
        );
        box.focus();

        const top = 7;

        const merchant = new blessed.Textbox({
            parent: box,

            top: top,
            left: 'center',
            align: 'center',
            height: 3,
            width: 40,

            name: 'merchant',

            ...INPUT_STYLE,
        });
        merchant.setValue(txn.merchant);

        const category = new Spinner({
            parent: box,

            top: top + 3,
            left: 'center',
            align: 'center',

            keys: true,
            mouse: true,
            tags: true,

            // TODO categories
            items: [
                {
                    id: 707,
                    content: "{bold}Bills & Utilities{/bold}",
                },
                {
                    id: 708,
                    content: "{bold}Food & Dining{/bold}",
                },
                {
                    id: 709,
                    content: "  Restaurants",
                },
            ],

            ...INPUT_STYLE,
        });
        category.on('select', newCategory => {
            console.log(newCategory);
        });

        // TODO

        this.screen.append(box);
        this.screen.render();
    }

    hide() {
        if (this.box) this.box.detach();
    }

}

module.exports = {
    TxnUI,
};
