CREATE TABLE IF NOT EXISTS user_wallets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_chain text NOT NULL CHECK (wallet_chain IN ('evm', 'solana')),
  wallet_address text NOT NULL,
  label varchar(80),
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_chain, wallet_address)
);

CREATE INDEX IF NOT EXISTS user_wallets_user_id_idx
  ON user_wallets (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_wallets_primary_chain_idx
  ON user_wallets (user_id, wallet_chain)
  WHERE is_primary = true;

INSERT INTO user_wallets (id, user_id, wallet_chain, wallet_address, is_primary)
SELECT
  md5(u.id::text || ':' || u.wallet_chain || ':' || u.wallet_address)::uuid,
  u.id,
  u.wallet_chain,
  u.wallet_address,
  true
FROM users u
WHERE u.wallet_chain IN ('evm', 'solana')
  AND u.wallet_address IS NOT NULL
ON CONFLICT (wallet_chain, wallet_address) DO NOTHING;

ALTER TABLE payment_quotes
  ADD COLUMN IF NOT EXISTS buyer_wallet_address text,
  ADD COLUMN IF NOT EXISTS creator_wallet_address text;

UPDATE payment_quotes q
SET buyer_wallet_address = COALESCE(
      q.buyer_wallet_address,
      (SELECT uw.wallet_address
       FROM user_wallets uw
       WHERE uw.user_id = q.buyer_user_id
         AND uw.wallet_chain = CASE WHEN q.network = 'BASE' THEN 'evm' ELSE 'solana' END
       ORDER BY uw.is_primary DESC, uw.created_at
       LIMIT 1),
      (SELECT u.wallet_address FROM users u WHERE u.id = q.buyer_user_id)
    ),
    creator_wallet_address = COALESCE(
      q.creator_wallet_address,
      (SELECT uw.wallet_address
       FROM profiles p
       JOIN user_wallets uw ON uw.user_id = p.user_id
       WHERE p.id = q.creator_profile_id
         AND uw.wallet_chain = CASE WHEN q.network = 'BASE' THEN 'evm' ELSE 'solana' END
       ORDER BY uw.is_primary DESC, uw.created_at
       LIMIT 1),
      (SELECT u.wallet_address
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = q.creator_profile_id)
    )
WHERE q.buyer_wallet_address IS NULL
   OR q.creator_wallet_address IS NULL;
