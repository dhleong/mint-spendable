/**
 * Config/credential storage
 */

/** Base class/interface */
class Store {
    async loadConfig() {
        throw new Error("Not Implemented");
    }

    async loadCredentials() {
        throw new Error("Not Implemented");
    }

    async saveCredentials(/* credentials */) {
        throw new Error("Not Implemented");
    }
}

module.exports = {
    Store,
};
