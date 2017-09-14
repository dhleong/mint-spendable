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

const UI = new SpendableUI();
const SERVICE = new SpendableService();

(async () => {
    var firstNotification = true;
    SERVICE.on('refreshing', accounts => {
        const names = accounts.map(it => it.name);
        if (firstNotification) {
            UI.setLoading("Refreshing accounts:\n" + names.join(", "));
        } else {
            UI.setLoading("Still refreshing:\n"  + names.join(", "));
        }
    });

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
