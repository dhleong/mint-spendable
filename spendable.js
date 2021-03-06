#!/usr/bin/env node

let SpendableService;
if (process.argv.indexOf("--test") === -1) {
    const service = require('./src/service');
    SpendableService = service.SpendableService;
} else {
    const { TestSpendableService } = require('./test/test-service');
    SpendableService = TestSpendableService;
}

const os = require('os');
const path = require('path');
const { SpendableUI } = require('./src/ui');
const { CompositeStore } = require('./src/store/composite-store');
const { JsonStore } = require('./src/store/json-store');
const { KeychainStore } = require('./src/store/keychain-store');

const BROWSER_LOGIN_TITLE = "A browser was opened to help with initial auth";
const BROWSER_LOGIN_MESSAGES = {
    init: BROWSER_LOGIN_TITLE,
    login: BROWSER_LOGIN_TITLE + "\nPlease finish logging in there",
    cookies: BROWSER_LOGIN_TITLE + "\nAuthenticating…",
    done: "Signing in…"
};

/*
 * State management
 * TODO: probably just refactor this file into a Presenter class
 */
const state = {
    editedTransaction: false,
};

/*
 * Init util
 */

function resolveHome(file) {
    if (file[0] === '~' && (file.length < 1 || file[1] === path.sep)) {
        return path.join(os.homedir(), file.substr(1));
    } else if (file[0] === '~') {
        throw new Error("~user syntax is not supported");
    }

    return file;
}

/*
 * Init
 */

// create and the store, the service, and the UI
const STORE = new CompositeStore(
    new KeychainStore(),
    new JsonStore(resolveHome('~/.config/spendable/config.json')),
    new JsonStore(resolveHome('~/.spendablerc.json')),
    new JsonStore(),
);
const UI = new SpendableUI();
const SERVICE = new SpendableService(STORE, async () => {
    UI.setLoading(false);
    const creds = await UI.showLogin();

    UI.setLoading("Signing in…");
    return creds;
});

async function refreshBudgetData() {
    UI.setLoading("Fetching budgets…");
    await SERVICE.loadBudgets();

    UI.setLoading("Crunching the numbers…");
    const budget = await SERVICE.calculate();
    UI.setLoading(false);
    UI.showBudget(budget);
}

/**
 * Wrap an async function into a "regular"
 *  promise-returning function that handles
 *  errors by reporting them via the UI. Any
 *  arguments received are passed along to the
 *  provided function
 */
function reportErrors(asyncFn) {
    return async (...args) => {
        try {
            await asyncFn(...args);
        } catch (e) {
            UI.reportError(e);
        }
    };
}

// init the service
var firstNotification = true;
SERVICE.on('refreshing', accounts => {
    if (accounts === true) {
        UI.setLoading("Refreshing accounts...");
        return;
    }

    const names = accounts
        .filter(SERVICE.isRelevantAccount.bind(SERVICE))
        .map(it => it.name);
    if (firstNotification) {
        firstNotification = false;
        UI.setLoading("Refreshing accounts:\n" + names.join(", "));
    } else {
        UI.setLoading("Still refreshing:\n"  + names.join(", "));
    }
});
SERVICE.on('browser-login', state =>
    UI.setLoading(
        BROWSER_LOGIN_MESSAGES[state]
    )
);
SERVICE.on('status', message =>
    UI.setLoading(message)
);

// init the UI
UI.on('show-category-transactions', reportErrors(async (kind, category) => {
    UI.setLoading("Loading transactions...");

    // only be strict about the category for unbudgeted items,
    // since those are each handled separately; budgeted categories
    // *may* include everything in a generic category
    const opts = {
        strict: (kind === 'unbudgetedItems'),
    };
    const transactions = await SERVICE.loadTransactions(category, opts);
    UI.showTransactions(category, transactions);
}));

UI.on('edit-transaction', transaction => {
    const categories = SERVICE.getCategories();
    UI.showEditTransaction(categories, transaction);
});
UI.on('close-transaction', () => {
    UI.hideEditTransaction();
});

UI.on('update-transaction', reportErrors(async txn => {
    UI.setActivity("Updating Transaction");

    await SERVICE.editTransaction(txn);
    UI.setActivity(false);

    state.editedTransaction = true;
}));

UI.on('refresh-budget', reportErrors(refreshBudgetData));

UI.on('back', reportErrors(async () => {
    if (state.editedTransaction) {
        state.editedTransaction = false;

        await refreshBudgetData();
    } else {
        UI.showBudget();
    }
}));

UI.on('quit', () => process.exit(0));

// go!
reportErrors(async () => {

    UI.setLoading("Signing in…");
    await SERVICE.login();

    UI.setLoading("Checking if accounts need to be refreshed…");
    await SERVICE.refreshAndWait();

    await refreshBudgetData();

})();
