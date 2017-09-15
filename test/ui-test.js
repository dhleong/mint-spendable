
const chai = require('chai');
const { tableIndexToCategory } = require('../src/ui');

const expect = chai.expect;
chai.should();

describe("tableIndexToCategory", () => {
    it('should work', function() {
        const map = {
            "Fancy Ships": ['zero', 'one'],
            "Mighty Fine Hats": ['ling', 'yi'],
        };
        const rows = [
            ["Fancy Ships"],
            ['zero', 0], ['one', 1],

            ["Mighty Fine Hats"],
            ['ling', 0], ['yi', 1],
        ];

        tableIndexToCategory(map, rows, 2).should.equal('one');
        expect(tableIndexToCategory(map, rows, 3)).to.be.undefined;

        tableIndexToCategory(map, rows, 4).should.equal('ling');
        tableIndexToCategory(map, rows, 5).should.equal('yi');
    });
});
