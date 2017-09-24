module.exports = {
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 8,
        "ecmaFeatures": {
            "experimentalObjectRestSpread": true,
        },
    },
    "env": {
        "node": true,
        "es6": true,
        "mocha": true,
    },
    "rules": {
        "no-console": "off",
    }
};

