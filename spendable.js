#!/usr/bin/env node

let SpendableService;
if (process.argv.indexOf("--test") === -1) {
    const service = require('./src/service');
    SpendableService = service.SpendableService;
} else {
    const { TestSpendableService } = require('./test/test-service');
    SpendableService = TestSpendableService;
}

const { SpendableUI } = require('./src/ui');
const { CompositeStore } = require('./src/store/composite-store');
const { JsonStore } = require('./src/store/json-store');
const { KeychainStore } = require('./src/store/keychain-store');

// create and the store, the service, and the UI
const STORE = new CompositeStore(
    new KeychainStore(),
    new JsonStore(),
);
const UI = new SpendableUI();
const SERVICE = new SpendableService(STORE, async () => {
    UI.setLoading(false);
    const creds = await UI.showLogin();

    UI.setLoading("Signing in…");
    return creds;
});

// init the service
var firstNotification = true;
SERVICE.on('refreshing', accounts => {
    const names = accounts.map(it => it.name);
    if (firstNotification) {
        firstNotification = false;
        UI.setLoading("Refreshing accounts:\n" + names.join(", "));
    } else {
        UI.setLoading("Still refreshing:\n"  + names.join(", "));
    }
});

// init the UI
UI.on('show-category-transactions', async category => {
    UI.setLoading("Loading transactions...");
    try {
        const transactions = await SERVICE.loadTransactions(category);
        UI.showTransactions(category, transactions);
    } catch (e) {
        // probably, session timed out error. We could possibly
        // gracefully handle this by re-logging in....
        UI.reportError(e);
    }
});

UI.on('edit-transaction', transaction => {
    const categories = SERVICE.getCategories();
    UI.showEditTransaction(categories, transaction);
});
UI.on('close-transaction', () => {
    UI.hideEditTransaction();
});

UI.on('back', () => {
    UI.showBudget();
});

// go!
(async () => {
    UI.setLoading("Signing in…");
    await SERVICE.login();

    UI.setLoading("Checking if accounts need to be refreshed…");
    await SERVICE.refreshAndWait();

    UI.setLoading("Fetching budgets…");
    await SERVICE.loadBudgets();

    UI.setLoading("Crunching the numbers…");
    const budget = await SERVICE.calculate();
    UI.setLoading(false);
    UI.showBudget(budget);

})().catch(e => UI.reportError(e));
