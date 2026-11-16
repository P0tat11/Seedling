const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { createHash, randomBytes } = require('node:crypto');

const SESSION_COOKIE = 'seedling_session';
const SESSION_DURATION_DAYS = 30;

function getSql() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://neondb_owner:npg_yNPDxj0MLf9r@ep-cool-grass-bcjwf3yd-pooler.c-16.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  }
  if (!globalThis.seedlingSql) {
    globalThis.seedlingSql = neon(process.env.DATABASE_URL);
  }
  return globalThis.seedlingSql;
}

function normalizeContact(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s()-]/g, '');
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const cookie = cookies.find((part) => part.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : '';
}

function setSessionCookie(req, res, token) {
  const secure =
    process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  const options = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DURATION_DAYS * 24 * 60 * 60}`
  ];
  if (secure) options.push('Secure');
  res.setHeader('Set-Cookie', options.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

async function createSession(sql, accountId, req, res) {
  const token = randomBytes(32).toString('base64url');
  await sql`
    INSERT INTO account_sessions (token_hash, account_id, expires_at)
    VALUES (
      ${hashToken(token)},
      ${accountId},
      now() + (${SESSION_DURATION_DAYS} * interval '1 day')
    )
  `;
  setSessionCookie(req, res, token);
}

async function getAccountId(req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT account_id
    FROM account_sessions
    WHERE token_hash = ${hashToken(token)} AND expires_at > now()
  `;
  return rows[0]?.account_id || null;
}

function normalizeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Invalid account data');
    error.statusCode = 400;
    throw error;
  }

  if (input.shopsList !== undefined && !Array.isArray(input.shopsList)) {
    const error = new Error('Invalid shop list');
    error.statusCode = 400;
    throw error;
  }
  const shops = Array.isArray(input.shopsList) ? input.shopsList : [];
  if (shops.length > 100) {
    const error = new Error('Too many shops');
    error.statusCode = 400;
    throw error;
  }

  for (const shop of shops) {
    if (
      !shop ||
      typeof shop !== 'object' ||
      typeof shop.id !== 'string' ||
      (shop.products !== undefined && !Array.isArray(shop.products)) ||
      (shop.salesLog !== undefined && !Array.isArray(shop.salesLog))
    ) {
      const error = new Error('Invalid shop data');
      error.statusCode = 400;
      throw error;
    }
    if ((shop.products || []).length > 500 || (shop.salesLog || []).length > 5000) {
      const error = new Error('Shop data exceeds the allowed size');
      error.statusCode = 400;
      throw error;
    }
    if (
      (shop.products || []).some((product) => !product || typeof product.id !== 'string') ||
      (shop.salesLog || []).some(
        (transaction) =>
          !transaction ||
          typeof transaction.id !== 'string' ||
          (transaction.items !== undefined && !Array.isArray(transaction.items))
      )
    ) {
      const error = new Error('Invalid inventory or transaction data');
      error.statusCode = 400;
      throw error;
    }
  }

  return input;
}

async function saveState(sql, accountId, input) {
  const state = normalizeState(input);
  const json = (value, fallback) => JSON.stringify(value ?? fallback);
  const activeShopId = String(state.activeShopId || 'shop-1');
  const shops = state.shopsList || [];
  const statements = [
    sql`
      INSERT INTO onboarding_data (
        account_id, founder_name, age_group, parent_knows, contact_method,
        parent_contact, has_completed_onboarding, onboarding_step, theme_id,
        mascot_id, custom_mascot_name, tycoon_gems, streak_days, updated_at
      ) VALUES (
        ${accountId}, ${state.kidName || ''}, ${state.kidAgeGroup || '8-9'},
        ${state.parentKnows}, ${state.contactMethod || 'email'},
        ${state.parentContact || ''}, ${Boolean(state.hasCompletedOnboarding)},
        ${Number(state.onboardingStep) || 1}, ${state.themeId || 'mint'},
        ${state.mascotId || 'sprout'}, ${state.customMascotName || ''},
        ${Number(state.tycoonGems) || 0}, ${Number(state.streakDays) || 1}, now()
      )
      ON CONFLICT (account_id) DO UPDATE SET
        founder_name = EXCLUDED.founder_name,
        age_group = EXCLUDED.age_group,
        parent_knows = EXCLUDED.parent_knows,
        contact_method = EXCLUDED.contact_method,
        parent_contact = EXCLUDED.parent_contact,
        has_completed_onboarding = EXCLUDED.has_completed_onboarding,
        onboarding_step = EXCLUDED.onboarding_step,
        theme_id = EXCLUDED.theme_id,
        mascot_id = EXCLUDED.mascot_id,
        custom_mascot_name = EXCLUDED.custom_mascot_name,
        tycoon_gems = EXCLUDED.tycoon_gems,
        streak_days = EXCLUDED.streak_days,
        updated_at = now()
    `,
    sql`
      INSERT INTO account_preferences (
        account_id, active_shop_id, active_tab, sound_muted, shop_open,
        forecast_weather, forecast_dow, updated_at
      ) VALUES (
        ${accountId}, ${activeShopId}, ${state.activeTab || 'home'},
        ${Boolean(state.soundMuted)}, ${state.shopOpen !== false},
        ${state.forecastWeather || 'cloudy'}, ${state.forecastDow || 'sun'},
        now()
      )
      ON CONFLICT (account_id) DO UPDATE SET
        active_shop_id = EXCLUDED.active_shop_id,
        active_tab = EXCLUDED.active_tab,
        sound_muted = EXCLUDED.sound_muted,
        shop_open = EXCLUDED.shop_open,
        forecast_weather = EXCLUDED.forecast_weather,
        forecast_dow = EXCLUDED.forecast_dow,
        updated_at = now()
    `
  ];

  for (const shop of shops) {
    statements.push(sql`
      INSERT INTO shops (
        account_id, id, business_name, category, goal_item_name, financial_goal,
        duration_days, material_cost, active_day, earned_badges, jar_allocations
      ) VALUES (
        ${accountId}, ${shop.id}, ${shop.businessName || ''}, ${shop.category || ''},
        ${shop.goalItemName || ''}, ${Number(shop.financialGoal) || 0},
        ${Number(shop.durationDays) || 3}, ${Number(shop.materialCost) || 0},
        ${Number(shop.activeDay) || 1}, ${json(shop.earnedBadges, [])}::jsonb,
        ${json(shop.jarAllocations, { goal: 70, supplies: 20, charity: 10 })}::jsonb
      )
      ON CONFLICT (account_id, id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        category = EXCLUDED.category,
        goal_item_name = EXCLUDED.goal_item_name,
        financial_goal = EXCLUDED.financial_goal,
        duration_days = EXCLUDED.duration_days,
        material_cost = EXCLUDED.material_cost,
        active_day = EXCLUDED.active_day,
        earned_badges = EXCLUDED.earned_badges,
        jar_allocations = EXCLUDED.jar_allocations
    `);
    statements.push(sql`
      DELETE FROM inventory WHERE account_id = ${accountId} AND shop_id = ${shop.id}
    `);

    for (const product of shop.products || []) {
      statements.push(sql`
        INSERT INTO inventory (
          account_id, shop_id, id, barcode, name, price, unit_cost, image_url, emoji
        ) VALUES (
          ${accountId}, ${shop.id}, ${String(product.id)}, ${String(product.barcode || '')},
          ${String(product.name || '')}, ${Number(product.price) || 0},
          ${Number(product.unitCost) || 0}, ${String(product.imageUrl || '')},
          ${String(product.emoji || '🛍️')}
        )
      `);
    }

    for (const transaction of shop.salesLog || []) {
      statements.push(sql`
        INSERT INTO transactions (
          account_id, shop_id, shop_key, id, day, receipt_time, items_summary,
          units_count, tip, total, profit
        ) VALUES (
          ${accountId}, ${String(shop.businessName || '')}, ${shop.id},
          ${String(transaction.id)}, ${Number(transaction.day) || 1},
          ${String(transaction.timestamp || '')}, ${String(transaction.itemsSummary || '')},
          ${Number(transaction.unitsCount) || 0}, ${Number(transaction.tip) || 0},
          ${Number(transaction.total) || 0}, ${Number(transaction.profit) || 0}
        )
        ON CONFLICT (account_id, id) DO UPDATE SET
          shop_id = EXCLUDED.shop_id,
          shop_key = EXCLUDED.shop_key,
          day = EXCLUDED.day,
          receipt_time = EXCLUDED.receipt_time,
          items_summary = EXCLUDED.items_summary,
          units_count = EXCLUDED.units_count,
          tip = EXCLUDED.tip,
          total = EXCLUDED.total,
          profit = EXCLUDED.profit
      `);
      statements.push(sql`
        DELETE FROM transaction_items
        WHERE account_id = ${accountId} AND transaction_id = ${String(transaction.id)}
      `);
      (transaction.items || []).forEach((item, index) => {
        statements.push(sql`
          INSERT INTO transaction_items (
            account_id, transaction_id, line_number, product_id, product_name,
            quantity, unit_price, unit_cost
          ) VALUES (
            ${accountId}, ${String(transaction.id)}, ${index + 1},
            ${item.id ? String(item.id) : null}, ${String(item.name || '')},
            ${Number(item.qty) || 0}, ${Number(item.price) || 0},
            ${Number(item.unitCost) || 0}
          )
        `);
      });
    }
    statements.push(sql`
      DELETE FROM transactions
      WHERE account_id = ${accountId} AND shop_key = ${shop.id}
        AND NOT (id = ANY(${(shop.salesLog || []).map((transaction) => String(transaction.id))}::text[]))
    `);
  }

  statements.push(sql`
    DELETE FROM shops
    WHERE account_id = ${accountId} AND NOT (id = ANY(${shops.map((shop) => shop.id)}::text[]))
  `);
  await sql.transaction(statements);
}

async function loadState(sql, accountId) {
  const [onboardingRows, preferenceRows, shopRows, inventoryRows, transactionRows, itemRows] =
    await Promise.all([
      sql`SELECT * FROM onboarding_data WHERE account_id = ${accountId}`,
      sql`SELECT * FROM account_preferences WHERE account_id = ${accountId}`,
      sql`SELECT * FROM shops WHERE account_id = ${accountId} ORDER BY id`,
      sql`SELECT * FROM inventory WHERE account_id = ${accountId} ORDER BY shop_id, id`,
      sql`SELECT * FROM transactions WHERE account_id = ${accountId} ORDER BY created_at DESC, id DESC`,
      sql`SELECT * FROM transaction_items WHERE account_id = ${accountId} ORDER BY transaction_id, line_number`
    ]);

  const onboarding = onboardingRows[0] || {};
  const preferences = preferenceRows[0] || {};
  const itemsByTransaction = new Map();
  for (const item of itemRows) {
    const items = itemsByTransaction.get(item.transaction_id) || [];
    items.push({
      id: item.product_id,
      name: item.product_name,
      qty: Number(item.quantity),
      price: Number(item.unit_price),
      unitCost: Number(item.unit_cost)
    });
    itemsByTransaction.set(item.transaction_id, items);
  }

  const shopsList = shopRows.map((shop) => ({
    id: shop.id,
    businessName: shop.business_name,
    category: shop.category,
    goalItemName: shop.goal_item_name,
    financialGoal: Number(shop.financial_goal),
    durationDays: shop.duration_days,
    materialCost: Number(shop.material_cost),
    activeDay: shop.active_day,
    earnedBadges: shop.earned_badges,
    jarAllocations: shop.jar_allocations,
    products: inventoryRows
      .filter((product) => product.shop_id === shop.id)
      .map((product) => ({
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        price: Number(product.price),
        unitCost: Number(product.unit_cost),
        imageUrl: product.image_url,
        emoji: product.emoji
      })),
    salesLog: transactionRows
      .filter((transaction) => transaction.shop_key === shop.id)
      .map((transaction) => ({
        id: transaction.id,
        day: transaction.day,
        timestamp: transaction.receipt_time,
        itemsSummary: transaction.items_summary,
        unitsCount: transaction.units_count,
        tip: Number(transaction.tip),
        total: Number(transaction.total),
        profit: Number(transaction.profit),
        items: itemsByTransaction.get(transaction.id) || []
      }))
  }));
  const activeShopId = preferences.active_shop_id || shopsList[0]?.id || 'shop-1';
  const activeShop = shopsList.find((shop) => shop.id === activeShopId) || {};

  return {
    hasCompletedOnboarding: Boolean(onboarding.has_completed_onboarding),
    onboardingStep: onboarding.onboarding_step || 1,
    activeTab: preferences.active_tab || 'home',
    soundMuted: Boolean(preferences.sound_muted),
    shopOpen: preferences.shop_open !== false,
    kidName: onboarding.founder_name || '',
    kidAgeGroup: onboarding.age_group || '8-9',
    parentKnows: onboarding.parent_knows ?? null,
    contactMethod: onboarding.contact_method || 'email',
    parentContact: onboarding.parent_contact || '',
    themeId: onboarding.theme_id || 'mint',
    mascotId: onboarding.mascot_id || 'sprout',
    customMascotName: onboarding.custom_mascot_name || '',
    tycoonGems: Number(onboarding.tycoon_gems) || 0,
    streakDays: Number(onboarding.streak_days) || 1,
    shopsList,
    activeShopId,
    businessName: activeShop.businessName || '',
    category: activeShop.category || '',
    goalItemName: activeShop.goalItemName || '',
    financialGoal: activeShop.financialGoal || 0,
    durationDays: activeShop.durationDays || 3,
    materialCost: activeShop.materialCost || 0,
    products: activeShop.products || [],
    activeDay: activeShop.activeDay || 1,
    salesLog: activeShop.salesLog || [],
    forecastWeather: preferences.forecast_weather || 'cloudy',
    forecastDow: preferences.forecast_dow || 'sun',
    earnedBadges: activeShop.earnedBadges || [],
    jarAllocations: activeShop.jarAllocations || { goal: 70, supplies: 20, charity: 10 }
  };
}

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function setJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function errorMessage(error) {
  if (error instanceof Error && error.message === 'DATABASE_URL is not configured') {
    return error.message;
  }
  if (error?.code === '42P01') {
    return 'Seedling database tables are missing. Run npm run db:migrate and try again.';
  }
  if (error?.statusCode === 400) return error.message;
  return 'The request could not be completed. Please try again.';
}

function errorStatus(error) {
  return error?.statusCode === 400 ? 400 : 500;
}

module.exports = {
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
};
