const assert = require('node:assert/strict');
const test = require('node:test');
const handler = require('./chat');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
}

test('AI chat requires an authenticated Seedling session', async () => {
  const response = createResponse();
  const originalSql = globalThis.seedlingSql;
  const originalKey = process.env.FIREWORKS_API_KEY;
  globalThis.seedlingSql = async () => [];
  process.env.FIREWORKS_API_KEY = 'test-fireworks-key';
  try {
    await handler({ method: 'POST', headers: {}, body: { messages: [] } }, response);

    assert.equal(response.statusCode, 401);
    assert.match(response.payload.error, /sign in/i);
  } finally {
    globalThis.seedlingSql = originalSql;
    if (originalKey === undefined) delete process.env.FIREWORKS_API_KEY;
    else process.env.FIREWORKS_API_KEY = originalKey;
  }
});

test('AI chat reports missing Fireworks configuration to an authenticated user', async () => {
  const response = createResponse();
  const originalSql = globalThis.seedlingSql;
  const originalKey = process.env.FIREWORKS_API_KEY;
  globalThis.seedlingSql = async () => [{ account_id: 'account-1' }];
  delete process.env.FIREWORKS_API_KEY;
  try {
    await handler(
      { method: 'POST', headers: { cookie: 'seedling_session=test-session' }, body: { messages: [] } },
      response
    );

    assert.equal(response.statusCode, 503);
    assert.match(response.payload.error, /FIREWORKS_API_KEY/);
  } finally {
    globalThis.seedlingSql = originalSql;
    if (originalKey === undefined) delete process.env.FIREWORKS_API_KEY;
    else process.env.FIREWORKS_API_KEY = originalKey;
  }
});

test('Fireworks receives all shop context without private account fields', async () => {
  const originalSql = globalThis.seedlingSql;
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIREWORKS_API_KEY;
  const originalModel = process.env.FIREWORKS_MODEL;
  let providerRequest;
  let requestUrl;
  let requestHeaders;
  process.env.FIREWORKS_API_KEY = 'test-fireworks-key';
  globalThis.seedlingSql = async () => [{ account_id: 'account-1' }];
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestHeaders = options.headers;
    providerRequest = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Use the saved shop data.' } }]
      })
    };
  };
  try {
    const response = createResponse();
    await handler(
      {
        method: 'POST',
        headers: { cookie: 'seedling_session=test-session' },
        body: {
          messages: [
            { role: 'system', content: 'Answer directly.' },
            { role: 'user', content: 'How is my shop doing?' }
          ],
          context: {
            founderName: 'Founder',
            ageGroup: '13+',
            activeShopId: 'shop-1',
            parentContact: 'private@example.test',
            shops: [
              {
                id: 'shop-1',
                businessName: 'Makers Market',
                products: [{ name: 'Bracelets', price: 4, unitCost: 1 }],
                sales: {
                  transactionCount: 2,
                  totalRevenue: 8,
                  totalProfit: 6,
                  totalTips: 1,
                  totalUnits: 2,
                  byDay: [{ day: 1, transactions: 2, revenue: 8, units: 2 }],
                  productSales: [{ name: 'Bracelets', quantity: 2, revenue: 8 }],
                  recentReceipts: []
                }
              }
            ]
          }
        }
      },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(requestUrl, 'https://api.fireworks.ai/inference/v1/chat/completions');
    assert.equal(requestHeaders.Authorization, 'Bearer test-fireworks-key');
    assert.equal(providerRequest.model, 'accounts/fireworks/models/glm-5p3-flash');
    const systemMessage = providerRequest.messages.find((message) => message.role === 'system');
    assert.match(systemMessage.content, /Makers Market/);
    assert.match(systemMessage.content, /Bracelets/);
    assert.match(systemMessage.content, /"totalRevenue":8/);
    assert.doesNotMatch(systemMessage.content, /private@example\.test/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.seedlingSql = originalSql;
    if (originalKey === undefined) delete process.env.FIREWORKS_API_KEY;
    else process.env.FIREWORKS_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.FIREWORKS_MODEL;
    else process.env.FIREWORKS_MODEL = originalModel;
  }
});
