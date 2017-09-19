/*
 * System Keychain-based Store
 */

const os = require('os');
const util = require('util');
const keytar = require('keytar');
const { Store } = require('../store');

const SERVICE = "net.dhleong.spendable";
const ACCOUNT = "keychain-store";

class KeychainStore extends Store {

    constructor(service = SERVICE, account = ACCOUNT) {
        super();

        this.service = service;
        this.account = account;
    }

    async loadConfig() {
        // KeyChain only stores credentials
        return null;
    }

    async loadCredentials() {
        try {
            const serialized = await keytar.getPassword(
                this.service, this.account
            );

            return this._inflate(serialized);
        } catch (e) {
            if (e.message.indexOf("passphrase") !== -1
                    && os.platform() === 'darwin') {
                return this._inflate(
                    await this._loadCredentialsMacAlt()
                );
            }

            throw new Error("Unable to load password:" + e);
        }
    }

    async saveCredentials(credentials) {
        await keytar.setPassword(
            this.service, this.account,
            this._serialize(credentials)
        );
        return true;
    }

    _serialize(data) {
        return JSON.stringify(data);
    }

    _inflate(data) {
        return JSON.parse(data);
    }

    async _loadCredentialsMacAlt() {
        // keytar on macos is not working for me
        const keychain = require('keychain');
        const getPassword = util.promisify(keychain.getPassword.bind(keychain));
        return await getPassword({
            service: SERVICE,
            account: ACCOUNT,
        });
    }
}

module.exports = {
    KeychainStore,
};
