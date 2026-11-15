const { createHash } = require('node:crypto');
const {
  clearSessionCookie,
  createSession,
  errorMessage,
  errorStatus,
  getAccountId,
  getSql,
  hashPassword,
  loadState,
  normalizeContact,
  normalizeState,
  saveState,
  setJson,
  verifyPassword
} = require('../lib/database');

function validCredentials(contact, password) {
  return contact.length >= 5 && password.length >= 4 && password.length <= 128;
}

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const accountId = await getAccountId(req);
      if (!accountId) return setJson(res, 200, { authenticated: false });
      const rows = await sql`SELECT login_contact FROM accounts WHERE id = ${accountId}`;
      if (!rows[0]) return setJson(res, 200, { authenticated: false });
      return setJson(res, 200, {
        authenticated: true,
        contact: rows[0].login_contact
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return setJson(res, 405, { error: 'Method not allowed' });
    }

    const body = req.body || {};
    if (body.action === 'logout') {
      const accountId = await getAccountId(req);
      if (accountId) {
        const token = String(req.headers.cookie || '')
          .split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith('seedling_session='))
          ?.slice('seedling_session='.length);
        if (token) {
          await sql`DELETE FROM account_sessions WHERE token_hash = ${createHash('sha256')
            .update(decodeURIComponent(token))
            .digest('hex')}`;
        }
      }
      clearSessionCookie(res);
      return setJson(res, 200, { ok: true });
    }

    const contact = normalizeContact(
      body.action === 'import' ? body.state?.parentContact : body.contact
    );
    const password = String(
      body.action === 'import' ? body.state?.accountPassword : body.password
    );
    if (!validCredentials(contact, password)) {
      return setJson(res, 400, {
        error: 'Enter a valid parent/account contact and a password of at least 4 characters.'
      });
    }

    if (body.action === 'register') {
      const state = normalizeState(body.state);
      if (!state.hasCompletedOnboarding || normalizeContact(state.parentContact) !== contact) {
        return setJson(res, 400, { error: 'Complete onboarding with this account contact first.' });
      }
      const passwordHash = await hashPassword(password);
      const rows = await sql`
        INSERT INTO accounts (login_contact, password_hash)
        VALUES (${contact}, ${passwordHash})
        ON CONFLICT (login_contact) DO NOTHING
        RETURNING id
      `;
      if (!rows.length) {
        return setJson(res, 409, { error: 'An account already uses this contact. Sign in instead.' });
      }
      const accountId = rows[0].id;
      try {
        await saveState(sql, accountId, state);
      } catch (error) {
        await sql`DELETE FROM accounts WHERE id = ${accountId}`;
        throw error;
      }
      await createSession(sql, accountId, req, res);
      return setJson(res, 201, { authenticated: true, contact });
    }

    if (body.action === 'login' || body.action === 'import') {
      let rows = await sql`
        SELECT id, password_hash FROM accounts WHERE login_contact = ${contact}
      `;
      let accountId;
      if (rows.length) {
        if (!(await verifyPassword(password, rows[0].password_hash))) {
          return setJson(res, 401, { error: 'Contact or password is incorrect.' });
        }
        accountId = rows[0].id;
      } else if (body.action === 'import') {
        const passwordHash = await hashPassword(password);
        rows = await sql`
          INSERT INTO accounts (login_contact, password_hash)
          VALUES (${contact}, ${passwordHash})
          RETURNING id
        `;
        accountId = rows[0].id;
      } else {
        return setJson(res, 401, { error: 'Contact or password is incorrect.' });
      }

      if (body.action === 'import') {
        const state = normalizeState(body.state);
        if (normalizeContact(state.parentContact) !== contact) {
          return setJson(res, 400, { error: 'Saved data does not match this account contact.' });
        }
        const [onboardingRows, preferenceRows, shopRows] = await Promise.all([
          sql`SELECT has_completed_onboarding FROM onboarding_data WHERE account_id = ${accountId}`,
          sql`SELECT account_id FROM account_preferences WHERE account_id = ${accountId}`,
          sql`SELECT id FROM shops WHERE account_id = ${accountId} LIMIT 1`
        ]);
        if (onboardingRows.length || preferenceRows.length || shopRows.length) {
          return setJson(res, 409, {
            error: 'This account already has saved data. Import will not overwrite it.'
          });
        }
        await saveState(sql, accountId, state);
      }

      await createSession(sql, accountId, req, res);
      return setJson(res, 200, { authenticated: true, contact });
    }

    return setJson(res, 400, { error: 'Unknown account action.' });
  } catch (error) {
    console.error('Account request failed:', error?.code || error?.message || 'Unknown error');
    return setJson(res, errorStatus(error), { error: errorMessage(error) });
  }
};
