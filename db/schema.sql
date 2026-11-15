CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_contact TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_data (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  founder_name TEXT NOT NULL DEFAULT '',
  age_group TEXT NOT NULL DEFAULT '8-9',
  parent_knows BOOLEAN,
  contact_method TEXT NOT NULL DEFAULT 'email',
  parent_contact TEXT NOT NULL DEFAULT '',
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT false,
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  theme_id TEXT NOT NULL DEFAULT 'mint',
  mascot_id TEXT NOT NULL DEFAULT 'sprout',
  custom_mascot_name TEXT NOT NULL DEFAULT '',
  tycoon_gems INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_preferences (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  active_shop_id TEXT NOT NULL DEFAULT 'shop-1',
  active_tab TEXT NOT NULL DEFAULT 'home',
  sound_muted BOOLEAN NOT NULL DEFAULT false,
  shop_open BOOLEAN NOT NULL DEFAULT true,
  forecast_weather TEXT NOT NULL DEFAULT 'cloudy',
  forecast_dow TEXT NOT NULL DEFAULT 'sun',
  ollama_url TEXT NOT NULL DEFAULT 'http://localhost:11434/api/chat',
  ollama_model TEXT NOT NULL DEFAULT 'llama3.2',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shops (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  goal_item_name TEXT NOT NULL DEFAULT '',
  financial_goal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 3,
  material_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  active_day INTEGER NOT NULL DEFAULT 1,
  earned_badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  jar_allocations JSONB NOT NULL DEFAULT '{"goal":70,"supplies":20,"charity":10}'::jsonb,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS inventory (
  account_id UUID NOT NULL,
  shop_id TEXT NOT NULL,
  id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '🛍️',
  PRIMARY KEY (account_id, shop_id, id),
  UNIQUE (account_id, shop_id, barcode),
  FOREIGN KEY (account_id, shop_id) REFERENCES shops(account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  account_id UUID NOT NULL,
  shop_id TEXT NOT NULL,
  shop_key TEXT NOT NULL,
  id TEXT NOT NULL,
  day INTEGER NOT NULL,
  receipt_time TEXT NOT NULL,
  items_summary TEXT NOT NULL DEFAULT '',
  units_count INTEGER NOT NULL DEFAULT 0,
  tip NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, id),
  CONSTRAINT transactions_shop_key_fkey
    FOREIGN KEY (account_id, shop_key) REFERENCES shops(account_id, id) ON DELETE CASCADE
);

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_shop_id_fkey;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shop_key TEXT;
UPDATE transactions AS t
SET shop_key = t.shop_id,
    shop_id = s.business_name
FROM shops AS s
WHERE t.shop_key IS NULL
  AND s.account_id = t.account_id
  AND s.id = t.shop_id;
ALTER TABLE transactions ALTER COLUMN shop_key SET NOT NULL;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_shop_key_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_shop_key_fkey
  FOREIGN KEY (account_id, shop_key) REFERENCES shops(account_id, id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS transaction_items (
  account_id UUID NOT NULL,
  transaction_id TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL,
  PRIMARY KEY (account_id, transaction_id, line_number),
  FOREIGN KEY (account_id, transaction_id)
    REFERENCES transactions(account_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS account_sessions_expiry_idx ON account_sessions(expires_at);
CREATE INDEX IF NOT EXISTS transactions_shop_day_idx ON transactions(account_id, shop_id, day);
