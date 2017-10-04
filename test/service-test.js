
const chai = require('chai');
const { Store } = require('../src/store');
const { SpendableService, doneRefreshing } = require('../src/service');

chai.should();

class EmptyStore extends Store {
    async loadConfig() {
        return {};
    }
}

function budgets(args) {
    return {
        spending: [],
        unbudgeted: {
            spending: [],
        },

        ...args,
    }
}

describe("doneRefreshing", () => {
    it('should handle empty "config"', function() {
        doneRefreshing(undefined, undefined, [
            /* no accounts left */
        ]).should.be.true;
    });
});

describe("SpendableService", () => {
    const emptyStore = new EmptyStore();

    describe(".calculate", () => {
        it('neutralizes rollover', async () => {
            const service = new SpendableService(emptyStore);
            service.budgets = budgets({
                spending: [
                    {
                        amt: -200.0,
                        ramt: -400.0
                    },

                    {
                        amt: 0.0,
                        ramt: -100.0,
                    }
                ],
            });

            await service.calculate();

            service.budgets.spending[0].spent.should.equal(200);
            service.budgets.spending[1].spent.should.equal(100);
        });
    });
});
