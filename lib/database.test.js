const assert = require('node:assert/strict');
const test = require('node:test');
const { loadState, saveState } = require('./database');

test('saveState stores the shop name as a sale shop_id', async () => {
  const statements = [];
  const sql = (strings, ...values) => ({
    query: strings.join(' '),
    values
  });
  sql.transaction = async (queries) => statements.push(...queries);

  await saveState(sql, 'account-1', {
    shopsList: [
      {
        id: 'shop-internal-1',
        businessName: 'Makers Market',
        salesLog: [{ id: 'sale-1' }]
      }
    ]
  });

  const saleInsert = statements.find((statement) =>
    statement.query.includes('INSERT INTO transactions')
  );
  assert.ok(saleInsert);
  assert.equal(saleInsert.values[1], 'Makers Market');
  assert.equal(saleInsert.values[2], 'shop-internal-1');
});

test('loadState associates sales using the internal shop key', async () => {
  const rowsByTable = {
    onboarding_data: [],
    account_preferences: [],
    shops: [
      {
        id: 'shop-internal-1',
        business_name: 'Makers Market',
        category: '',
        goal_item_name: '',
        financial_goal: 0,
        duration_days: 3,
        material_cost: 0,
        active_day: 1,
        earned_badges: [],
        jar_allocations: { goal: 70, supplies: 20, charity: 10 }
      }
    ],
    inventory: [],
    transactions: [
      {
        id: 'sale-1',
        shop_id: 'Makers Market',
        shop_key: 'shop-internal-1',
        day: 1,
        receipt_time: '',
        items_summary: '',
        units_count: 0,
        tip: 0,
        total: 0,
        profit: 0
      }
    ],
    transaction_items: []
  };
  const sql = (strings) => {
    const query = strings.join(' ');
    const table = Object.keys(rowsByTable).find((name) =>
      query.includes(`FROM ${name}`)
    );
    return Promise.resolve(rowsByTable[table] || []);
  };

  const state = await loadState(sql, 'account-1');
  assert.deepEqual(state.shopsList[0].salesLog.map(({ id }) => id), ['sale-1']);
});
