
const chai = require('chai');
const { tableIndexToCategory } = require('../../src/ui/main');

const expect = chai.expect;
chai.should();

describe("tableIndexToCategory", () => {
    it('should work', function() {
        const map = {
            "Inferred Spending": ['zero', 'one'],
            "Budgeted Spending": ['ling', 'yi'],
        };
        const rows = [
            ["Inferred Spending"],
            ['zero', 0], ['one', 1],

            ["Budgeted Spending"],
            ['ling', 0], ['yi', 1],
        ];

        tableIndexToCategory(map, rows, 2).should.deep.equal(
            ['inferredSpendingItems', 'one']
        );
        expect(tableIndexToCategory(map, rows, 3)[1]).to.be.undefined;

        tableIndexToCategory(map, rows, 4).should.deep.equal(
            ['budgetedSpendingItems', 'ling']
        );
        tableIndexToCategory(map, rows, 5).should.deep.equal(
            ['budgetedSpendingItems', 'yi']
        );
    });
});
