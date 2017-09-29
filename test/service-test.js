
const chai = require('chai');
const { doneRefreshing } = require('../src/service');

chai.should();

describe("doneRefreshing", () => {
    it('should handle empty "config"', function() {
        doneRefreshing(undefined, undefined, [
            /* no accounts left */
        ]).should.be.true;
    });
});
