/*
 * Single transaction Pop-up UI
 */

const { EventEmitter } = require('events');
const blessed = require('blessed');

class TxnUI extends EventEmitter {

    constructor(screen) {
        super();

        this.screen = screen;
    }

    show(txn) {
        this.hide();
        this._txn = txn;

        const box = this.box = new blessed.Box({
            top: 'center',
            left: 'center',
            width: '80%',
            height: '100%',
            padding: 1,

            shadow: true,
            style: {
                bg: 'black',
                fg: 'bright-white',
            },
            border: {
                bg: 'white',
            },

            content: JSON.stringify(txn, null, '  '),
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
