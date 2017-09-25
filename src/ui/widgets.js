/*
 * Shared widgets
 */
const blessed = require('blessed');

class IndefiniteProgressBox extends blessed.Text {
    constructor(options) {
        super({
            height: 1,
            align: 'center',

            ...options,
        });

        this._.icons = [
            '⠄', '⠆', '⠇', '⠋',
            '⠉',
            '⠈', '⠘', '⠸', '⠴',
            '⠤',
        ];
        this._.iconIndex = 0;

        this.on('destroy', () => this.stop());
    }

    show() {
        super.show();

        if (!this.hidden) this.stop();
        if (this._.timer) {
            this.stop();
        }

        this._.timer = setInterval(() => {
            this._.iconIndex = ++this._.iconIndex % this._.icons.length;
            this.setContent(this._.icons[this._.iconIndex]);
            this.screen.render();
        }, 100);
    }

    stop() {
        if (this._.timer) {
            clearInterval(this._.timer);
            delete this._.timer;
        }
        this.screen.render();
    }
}

module.exports = {
    IndefiniteProgressBox,
};
