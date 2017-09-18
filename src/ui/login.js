/*
 * Login UI
 */

const blessed = require('blessed');

class LoginUI {
    constructor(screen) {
        this.screen = screen;
    }

    hide() {
        if (this.box) this.box.destroy();
    }

    show() {
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

        const form = new blessed.Form({
            parent: box,
            keys: true,
            align: 'center',
            top: 'center',
            left: 'center',
            width: '0%+42',
            height: '70%',

            content: '{bold}Spendable{/bold}\nLogin with Mint.com credentials',
            tags: true,
        });
        form.on('submit', data => {
            this._resolve(data);
            delete this._resolve;
            delete this._reject;
        });

        blessed.Text({
            parent: form,
            top: 4,
            left: 0,
            width: 10,
            height: 1,

            content: "Username",
        });
        const username = blessed.Textbox({
            parent: form,
            top: 3,
            left: 10,
            width: 30,
            height: 3,

            name: 'username',

            inputOnFocus: true,

            border: {
                type: 'line',
            },
        });

        blessed.Text({
            parent: form,
            top: 7,
            left: 0,
            width: 10,
            height: 1,

            content: "Password",
        });
        const password = blessed.Textbox({
            parent: form,
            top: 6,
            left: 10,
            width: 30,
            height: 3,

            name: 'password',
            censor: true,

            inputOnFocus: true,

            border: {
                type: 'line',
            },
        });
        password.on('submit', () => form.submit());

        blessed.Button({
            parent: form,
            top: 10,
            left: 'center',
            shrink: true,

            name: 'submit',
            content: 'Login',

            keys: true,
            mouse: true,

            border: {
                type: 'line',
            },
        }).on('press', () => form.submit());

        this.screen.append(box);
        this.screen.render();

        username.focus();
    }

    awaitLogin() {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }
}

module.exports = {
    LoginUI,
};
