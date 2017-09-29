/*
 * A Store that delegates to other Stores,
 *  using the first results found
 */

const { Store } = require('../store');

class CompositeStore extends Store {

    constructor(...alternatives) {
        super();

        this.alternatives = alternatives;
    }

    async loadConfig() {
        for (const choice of this.alternatives) {
            const result = await choice.loadConfig();
            if (Object.keys(result).length) return result;
        }

        return {};
    }

    async loadCredentials() {
        for (const choice of this.alternatives) {
            const result = await choice.loadCredentials();
            if (result) return result;
        }
    }

    async saveCredentials(credentials) {
        for (const choice of this.alternatives) {
            const result = await choice.saveCredentials(credentials);
            if (result) return result;
        }
    }
}

module.exports = {
    CompositeStore,
};

