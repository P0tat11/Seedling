const {
  errorMessage,
  errorStatus,
  getAccountId,
  getSql,
  setJson
} = require('../lib/database');

const GUIDELINE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidInput(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateGuideline(body) {
  if (
    !body ||
    typeof body.title !== 'string' ||
    typeof body.content !== 'string' ||
    (body.category !== undefined && typeof body.category !== 'string') ||
    (body.isActive !== undefined && typeof body.isActive !== 'boolean')
  ) {
    throw invalidInput('Invalid guideline data.');
  }
  const title = body.title.trim();
  const content = body.content.trim();
  const category = (body.category || 'General').trim() || 'General';

  if (!title || title.length > 120) {
    throw invalidInput('Enter a guideline title of 1–120 characters.');
  }
  if (!content || content.length > 12000) {
    throw invalidInput('Enter guideline content of 1–12,000 characters.');
  }
  if (category.length > 60) {
    throw invalidInput('Guideline category must be 60 characters or fewer.');
  }

  return {
    title,
    category,
    content,
    isActive: body.isActive ?? true
  };
}

module.exports = async function handler(req, res) {
  try {
    const accountId = await getAccountId(req);
    if (!accountId) return setJson(res, 401, { error: 'Please sign in to manage business guidelines.' });
    const sql = getSql();

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const query = (url.searchParams.get('query') || '').trim();
      if (query.length > 500) throw invalidInput('Search query is too long.');

      if (query) {
        const guidelines = await sql`
          SELECT id, title, category, content
          FROM business_guidelines
          WHERE account_id = ${accountId}
            AND is_active = true
            AND search_document @@ plainto_tsquery('english', ${query})
          ORDER BY ts_rank_cd(
            search_document,
            plainto_tsquery('english', ${query})
          ) DESC, updated_at DESC
          LIMIT 4
        `;
        return setJson(res, 200, {
          guidelines: guidelines.map((guideline) => ({
            ...guideline,
            content: guideline.content.slice(0, 4000)
          }))
        });
      }

      const guidelines = await sql`
        SELECT id, title, category, content, is_active, created_at, updated_at
        FROM business_guidelines
        WHERE account_id = ${accountId}
        ORDER BY updated_at DESC
        LIMIT 100
      `;
      return setJson(res, 200, { guidelines });
    }

    if (req.method === 'POST') {
      const guideline = validateGuideline(req.body);
      const count = await sql`
        SELECT count(*)::int AS total
        FROM business_guidelines
        WHERE account_id = ${accountId}
      `;
      if (count[0].total >= 100) {
        return setJson(res, 409, { error: 'You can save up to 100 guidelines per account.' });
      }
      const rows = await sql`
        INSERT INTO business_guidelines (account_id, title, category, content, is_active)
        VALUES (
          ${accountId}, ${guideline.title}, ${guideline.category},
          ${guideline.content}, ${guideline.isActive}
        )
        RETURNING id, title, category, content, is_active, created_at, updated_at
      `;
      return setJson(res, 201, { guideline: rows[0] });
    }

    if (req.method === 'PUT') {
      const id = String(req.body?.id || '');
      if (!GUIDELINE_ID.test(id)) throw invalidInput('Invalid guideline ID.');
      const guideline = validateGuideline(req.body);
      const rows = await sql`
        UPDATE business_guidelines
        SET title = ${guideline.title},
            category = ${guideline.category},
            content = ${guideline.content},
            is_active = ${guideline.isActive},
            updated_at = now()
        WHERE id = ${id} AND account_id = ${accountId}
        RETURNING id, title, category, content, is_active, created_at, updated_at
      `;
      if (!rows.length) return setJson(res, 404, { error: 'Guideline not found.' });
      return setJson(res, 200, { guideline: rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = String(req.body?.id || '');
      if (!GUIDELINE_ID.test(id)) throw invalidInput('Invalid guideline ID.');
      const rows = await sql`
        DELETE FROM business_guidelines
        WHERE id = ${id} AND account_id = ${accountId}
        RETURNING id
      `;
      if (!rows.length) return setJson(res, 404, { error: 'Guideline not found.' });
      return setJson(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return setJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Business guidelines request failed:', error?.code || error?.message || 'Unknown error');
    return setJson(res, errorStatus(error), { error: errorMessage(error) });
  }
};
