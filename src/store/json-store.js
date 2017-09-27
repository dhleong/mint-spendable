/*
 * Simple, unencrypted, flat-file JSON store
 */

const { promisify } = require('util');
const fs = require('fs');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const { Store } = require('../store');

const CONFIG_FILE = './config.json';

function mapToList(m) {
    return Object.keys(m);
}

function listToMap(l) {
    if (!l) return {};

    return l.reduce((m, key) => {
        m[key] = true;
        return m;
    }, {});
}

class JsonStore extends Store {
    constructor(configFile = CONFIG_FILE) {
        super();

        this.configFile = configFile;
    }

    async loadConfig() {
        const config = JSON.parse(await readFile(this.configFile));

        const definiteCategories = listToMap(config.definiteCategories);
        /** goal categories are ignored in unbudgeted spending */
        const goalCategories = listToMap(config.goalCategories);
        const ignoredRollover = listToMap(config.ignoredRolloverCategories);
        const maxRefreshingIds = config.maxRefreshingIds || 0;
        const unrelatedAccounts = config.unrelatedAccounts;

        return Object.assign(config, {
            definiteCategories,
            goalCategories,
            ignoredRollover,
            maxRefreshingIds,
            unrelatedAccounts,
        });
    }

    async loadCredentials() {
        const config = await this.loadConfig();
        if (!(config && config.username && config.password)) return;
        return config;
    }

    async saveCredentials(credentials) {
        const creds = {
            username: credentials.username,
            password: credentials.password,
            cookie: credentials.cookie,

            definiteCategories: mapToList(credentials.definiteCategories),
            goalCategories: mapToList(credentials.goalCategories),
            ignoredRolloverCategories: mapToList(credentials.ignoredRollover),
            maxRefreshingIds: credentials.maxRefreshingIds,
            unrelatedAccounts: credentials.unrelatedAccounts,
        };

        try {
            await writeFile(this.configFile,
                JSON.stringify(creds, null, '  ')
            );
        } catch (e) {
            console.warn("Unable to save cookies!");
        }

        return true;
    }
}

module.exports = {
    JsonStore,
};
