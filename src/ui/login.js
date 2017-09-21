/*
 * Login UI
 */

const blessed = require('blessed');

function autoInput(loginUi, textarea) {
    textarea.on('focus', () => {
        textarea.readInput();
    });
    textarea.on('keypress', () => {
        if (textarea.style.border.fg !== 'black') {
            textarea.style.border.fg = 'black';

            // just go ahead and clear the error
            loginUi._errors.setContent('');
        }
    });
    textarea.on('click', () => {
        // focus next tick to avoid creating duplicate
        // input reading
        process.nextTick(() => safeFocus(textarea));
    });
    textarea.on('submit', () => {
        textarea.parent.submit();
    });
    return textarea;
}

function safeFocus(element) {
    if (!element.focused && element.screen.focused !== element) {
        element.focus();
        element.screen.render();
    }
}

function validatePassword(password) {
    if (!(password && password.length)) {
        return "Password is required";
    }

    if (password.length < 6) {
        return "Passwords must be at least 6 characters";
    }

    if (password.indexOf(' ') !== -1) {
        return "Passwords must not contain spaces";
    }
}

function validateUsername(username) {
    if (!(username && username.length)) {
        return "Username is required";
    }
}

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
            // keys: true,
            align: 'center',
            top: 'center',
            left: 'center',
            width: '0%+42',
            height: '70%',

            content: '{bold}Spendable{/bold}\nLogin with Mint.com credentials',
            tags: true,
        });
        form.on('submit', data => {
            // focus on the button so that we can later
            // safely move focus back onto any problematic fields
            form.children[form.children.length - 1].focus();

            // do this on the next tick so keypress handling
            // happens first (IE: color changes from validation
            // aren't stepped on by keypress events)
            process.nextTick(() => {
                if (!this._validate(data)) return;

                if (this._resolve) {
                    this._resolve(data);
                    delete this._resolve;
                    delete this._reject;
                }
            });
        });

        const username = this._username = autoInput(this, blessed.Textbox({
            parent: form,
            top: 3,
            left: 10,
            width: 30,
            height: 3,

            name: 'username',

            border: {
                type: 'line',
            },
        }));
        blessed.Text({
            parent: form,
            top: 4,
            left: 0,
            width: 10,
            height: 1,

            content: "Username",
        }).on('click', () => safeFocus(username));

        blessed.Text({
            parent: form,
            top: 7,
            left: 0,
            width: 10,
            height: 1,

            content: "Password",
        });
        const password = this._password = autoInput(this, blessed.Textbox({
            parent: form,
            top: 6,
            left: 10,
            width: 30,
            height: 3,

            name: 'password',
            censor: true,

            border: {
                type: 'line',
            },
        }));
        password.on('submit', () => form.submit());

        // manually handle tab order
        // (the built-in behavior is weird right now)
        username.on('keypress', (_, key) => {
            if (key.name === 'tab') password.focus();
        });
        password.on('keypress', (_, key) => {
            if (key.name === 'tab') username.focus();
        });

        this._errors = blessed.Box({
            parent: form,
            top: 10,
            left: 2,
            right: 2,
            height: 1,

            align: 'center',
            content: '',

            style: {
                fg: 'red',
            },
        });

        blessed.Button({
            parent: form,
            top: 12,
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

        safeFocus(username);
    }

    awaitLogin() {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    _validate(data) {
        var dirty = false;
        this._errors.setContent('');

        dirty = this._checkError(dirty, this._username,
            validateUsername(data.username)
        );

        dirty = this._checkError(dirty, this._password,
            validatePassword(data.password)
        );

        if (dirty) {
            this.screen.render();
        }

        return !dirty;
    }

    _checkError(dirty, formElement, errorMessage) {
        if (errorMessage) {
            formElement.style.border.fg = 'red';
            if (!dirty) {
                dirty = true;
                process.nextTick(() => safeFocus(formElement));
            }

            if (this._errors.getContent() === '') {
                this._errors.setContent(errorMessage);
            }
        }

        return dirty;
    }
}

module.exports = {
    LoginUI,
};
