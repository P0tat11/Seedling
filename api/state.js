const {
  errorMessage,
  errorStatus,
  getAccountId,
  getSql,
  loadState,
  normalizeState,
  saveState,
  setJson
} = require('../lib/database');

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    const accountId = await getAccountId(req);
    if (!accountId) return setJson(res, 401, { error: 'Please sign in to access your shop.' });

    if (req.method === 'GET') {
      return setJson(res, 200, { state: await loadState(sql, accountId) });
    }

    if (req.method === 'PUT') {
      const state = normalizeState(req.body?.state);
      await saveState(sql, accountId, state);
      return setJson(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await sql.transaction([
        sql`DELETE FROM onboarding_data WHERE account_id = ${accountId}`,
        sql`DELETE FROM account_preferences WHERE account_id = ${accountId}`,
        sql`DELETE FROM shops WHERE account_id = ${accountId}`
      ]);
      return setJson(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return setJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Account data request failed:', error?.code || error?.message || 'Unknown error');
    return setJson(res, errorStatus(error), { error: errorMessage(error) });
  }
};
