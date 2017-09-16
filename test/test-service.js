
const { EventEmitter } = require('events');
const BASE_DELAY = 300;

function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

class TestSpendableService extends EventEmitter {
    async login() {
        await delay(BASE_DELAY);
    }

    async refreshAndWait() {
        await delay(BASE_DELAY * .5);

        this.emit('refreshing', [
            {name: "Serenity Independent Bank"},
            {name: "Outer Rim Credit Union"},
            {name: "The Cargo Hold"},
            {name: "The Captain's Mattress"},
        ]);

        await delay(BASE_DELAY * 2);
    }

    async loadBudgets() {
        await delay(BASE_DELAY * 2/3);
    }

    async loadTransactions() {
        await delay(BASE_DELAY);
        return [
            {
                date: 'Sep 14',
                note: '',
                isPercent: false,
                fi: 'Serenity Independent Bank',
                txnType: 0,
                numberMatchedByRule: -1,
                isEdited: false,
                isPending: true,
                mcategory: 'Restaurants',
                isMatched: false,
                odate: 'Sep 14',
                isFirstDate: true,
                id: 1,
                isDuplicate: false,
                hasAttachments: false,
                isChild: false,
                isSpending: true,
                amount: '$122.49',
                ruleCategory: '',
                userCategoryId: null,
                isTransfer: false,
                isAfterFiCreationTime: true,
                merchant: "Junky's Quality Parts",
                manualType: 0,
                labels: [],
                mmerchant: "Junky's Quality Parts",
                isCheck: false,
                omerchant: "JUNKYS QUALITY PARTS",
                isDebit: true,
                category: 'Bills & Utilities',
                ruleMerchant: '',
                isLinkedToRule: false,
                account: 'Independent Checking Account',
                categoryId: 707,
                ruleCategoryId: 0 }
        ];
    }

    async calculate() {
        return {
            budgeted: 6189.0,
            totalSpent: 4443.51,

            nonInferredSpending: 436.51,
            inferredSpending: 3949.0,
            unbudgetedSpending: 58.0,

            inferredSpendable: 2240.0,
            inferredSpendablePerDay: 74.67,
            spendable: 1745.49,
            avgSpending: 38.04,
            spendablePerDay: 102.68,
            remainingDays: 17,
            monthDays: 30,

            inferredSpendingItems: [
                {
                    category: "Auto & Transport: Public Transportation",
                    bgt: 150.0,
                    amt: 30.0,
                },

                {
                    category: "Bills & Utilities",
                    bgt: 310.0,
                    amt: 99.0,
                },

                {
                    category: "Home: Home Services",
                    bgt: 99.0,
                    amt: 99.0,
                },

                {
                    category: "Home: Mortgage & Rent",
                    bgt: 2000.0,
                    amt: 0.0,
                }
            ],
            rolledOverItems: [
                {
                    category: "Personal Care: Laundry",
                    bgt: 25.0,
                    amt: -10.0,
                },
            ],
            budgetedSpendingItems: [
                {
                    category: "Food & Dining",
                    bgt: 1000.0,
                    amt: 346.51,
                },
            ],
            unbudgetedItems: [
                {
                    category: "Travel",
                    amt: 58.0,
                }
            ],
        }
    }
}

module.exports = {
    TestSpendableService,
};
