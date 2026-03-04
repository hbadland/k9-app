-- Phase 4: Payments — wallets & Stripe integration

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE TABLE wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance     INT         NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Back-fill a zero-balance wallet for every existing user
INSERT INTO wallets (user_id)
  SELECT id FROM users
  ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE wallet_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount           INT         NOT NULL,   -- positive = credit, negative = debit
  type             TEXT        NOT NULL CHECK (type IN ('topup','usage','refund','subscription')),
  description      TEXT,
  stripe_reference TEXT,                   -- payment_intent or subscription id
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions (wallet_id, created_at DESC);
