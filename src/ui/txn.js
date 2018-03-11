/*
 * Single transaction Pop-up UI
 */

const { EventEmitter } = require('events');
const blessed = require('blessed');

const { IndefiniteProgressBox } = require('./widgets');

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

function categoriesToList(raw) {
    const list = [];

    for (const major of raw) {
        list.push({
            id: major.id,
            value: major.value,
            content: `{bold}${major.value}{/bold}`,
        });

        for (const minor of major.children) {
            list.push({
                id: minor.id,
                value: minor.value,
                content: `  ${minor.value}`,
            });
        }
    }

    return list;
}

class TextFilter {
    constructor(filter) {
        this.filter = filter.toLowerCase();
    }

    matches(text) {
        // TODO fancier?
        return text.toLowerCase().includes(this.filter);
    }
}

class Spinner extends blessed.Button {
    constructor(options) {
        super({
            height: 3,

            ...options
        });

        this.selected = options.selected || 0;
        this.items = options.items;
        this._.lastItemsLength = -1;
        this._.filter = "";

        this._.pickerBox = new blessed.Box({
            parent: options.parent,

            top: options.top,
            left: options.left,
            // height: 7, // TODO options?

            ...INPUT_STYLE
        });
        this._.picker = new blessed.List({
            parent: this._.pickerBox,

            keys: true,
            mouse: true,
            vi: false, // NOTE: no vim mode here, because we type to filter!

            tags: true,
            style: {
                selected: {
                    bg: 'black',
                    fg: 'bright-white',
                }
            }
        });
        this._.picker.on('select', (_, index) => this.select(index));
        this._.picker.on('keypress', this._onType.bind(this));
        this._.pickerBox.hide();

        this.on('press', () => this._showSelect());

        this._updateContent();
    }

    select(index) {
        if (index < 0 || index >= this.items.length) {
            throw new Error(`Attempt to select invalid index ${index}`);
        }

        if (this._.pickerBox.visible) {
            this._.pickerBox.hide();

            // only emit the event if NOT triggered programmatically
            // (IE: while the picker box is visible)
            const items = this._getFilteredItems();
            const item = items[index];
            this.selected = this.items.indexOf(item);
            this.emit('select', item, index);

            // restore focus back where it belongs
            this.screen.restoreFocus();
        } else {
            this.selected = index;
        }

        this._updateContent();
    }

    cancel() {
        // cancel changes by just selecting the currently-selected
        this.select(this.selected)
    }

    filter(text) {
        if (this._.filter === text) return;

        this._.filter = text;
        this._.lastItemsLength = -1; // invalidate picker list
        this._updateContent();
    }

    reset() {
        this.filter("");
    }

    _onType(ch, key) {
        if (key.name === 'escape' && this._.filter.length) {
            this.filter("");
            return;
        } else if (key.name === 'escape') {
            this.cancel();
            return;
        }

        if (key.name === 'backspace' && !this._.filter.length) {
            this.cancel();
            return;
        } else if (key.name === 'backspace') {
            this.filter(this._.filter.substr(0, this._.filter.length - 1));
            return;
        }

        if (!ch || !/[a-zA-Z &]/.test(ch)) {
            // weird char?
            return;
        }

        this.filter(this._.filter + ch);
    }

    _getFilteredItems() {
        const filter = new TextFilter(this._.filter);
        return this.items.filter(it => filter.matches(it.content));
    }

    _updateContent() {
        this.setContent(this._contentOf(this.items[this.selected]));

        if (this.items.length !== this._.lastItemsLength) {
            this._.picker.setItems(
                this._getFilteredItems()
                    .map(it => it.content)
            );
        }
    }

    _contentOf(item) {
        if (typeof(item) === 'string') return item;
        if (item.content) return item.content;
        return '';
    }

    _showSelect() {
        this._.pickerBox.show();
        this._.picker.focus();
    }
}

class TxnUI extends EventEmitter {

    constructor(screen) {
        super();

        this.screen = screen;
    }

    show(categories, txn) {
        this.hide();
        this._txn = txn;

        if (!this._categories) {
            categories = this._categories = categoriesToList(categories);
        }

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
        box.key(['q', 'escape', 'backspace'], () =>
            this.emit('close-transaction', txn)
        );
        box.key('c', () => this._changeCategory());
        box.focus();

        this.loader = new IndefiniteProgressBox({
            parent: box,
            right: 1,
            top: 0,

            style: {
                ...INPUT_STYLE.style
            }
        });
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

        const category = this._categorySpinner = new Spinner({
            parent: box,

            top: top + 3,
            left: 'center',
            align: 'center',

            keys: true,
            mouse: true,
            tags: true,

            items: this._categories,

            ...INPUT_STYLE,
        });
        const initial = this._findCategoryIndex(txn.categoryId);
        if (initial !== -1) {
            category.select(initial);
        }
        category.on('select', newCategory => {
            category.reset();

            if (txn.categoryId !== newCategory.id) {
                txn.categoryId = newCategory.id;
                txn.category = newCategory.value;
                this.emit('update-transaction', txn);
            }

            // user has finished with the spinner; re-focus
            box.focus();
        });

        // TODO rename

        this.screen.append(box);
        this.screen.render();
    }

    hide() {
        if (this.box) this.box.detach();
    }

    setActivity(activity) {
        if (activity) {
            this.loader.show();
        } else {
            this.loader.hide();
        }
    }

    _changeCategory() {
        this._categorySpinner.press();
    }

    _findCategoryIndex(categoryId) {
        const len = this._categories.length;
        for (let i=0; i < len; ++i) {
            if (this._categories[i].id === categoryId) {
                return i;
            }
        }

        return -1;
    }

}

module.exports = {
    TxnUI,
};
