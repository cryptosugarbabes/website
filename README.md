# Crypto Sugar Babes

Crypto-native, adults-only social discovery platform for `cryptosugarbabes.com`. The current foundation includes a responsive discovery experience, fictional demo profiles, server-verified Base/EVM and Solana wallet sign-in, free profile onboarding with up to 20 photos, and a PostgreSQL-ready creator economy schema.

## Run locally

1. Copy `.env.example` to `.env.local` and replace the development secrets.
2. Install dependencies with `pnpm install`.
3. Start the website with `pnpm dev`.
4. Visit `http://localhost:3000`.

Payment controls are intentionally in test mode. Wallet signatures are real and server-verified, but test messages and photo-likes never move funds.

## Creator economy rules

- Incoming messages start at `0.30 USDC`; creators send and reply for free.
- Every 100 messages sent plus received adds 5 creator rating points.
- Each rating point increases the incoming-message price by 0.1%, using `0.30 × (1 + points × 0.001)`.
- Rating points have no maximum.
- A paid photo-like costs `0.11 USDC`: `0.10` creator share and `0.01` platform fee.
- Message revenue splitting remains configurable until the operating rule is chosen.
- Profile boosts and creator profile fees are not part of the product.

## Payment boundaries

- Base/EVM wallets and Solana wallets (including Solflare and Phantom) can authenticate by signing a free message.
- Base is chain ID `8453`; Solana authentication uses Ed25519 signature verification.
- Platform products can transfer directly to the platform treasury.
- High-frequency micro-payments should use prepaid USDC credits or batched settlement. Requiring a blockchain transaction for every message or like is not acceptable UX.
- Creator payments, message charges, photo-like splits, coupons, affiliate fees, and commissions must use an audited settlement contract and immutable internal ledger. They should not be implemented as untracked direct wallet transfers.
- A future card-to-crypto on-ramp requires the provider's written approval for the product category and operating jurisdictions.

## Before production

- Replace the fictional in-code profiles with database-backed, reviewed profiles.
- Add specialist age and identity verification.
- Put uploads in private object storage, strip metadata, scan files, and moderate before publication.
- Add a database-backed nonce store, rate limiting, CSRF/origin checks, and passkey or recovery flows.
- Deploy an audited payment router and index confirmed chain events before enabling creator payments.
- Add immutable ledger entries, refunds, sanctions screening, abuse reporting, and moderator audit logs.
- Complete jurisdiction-specific legal review and publish terms, privacy, safety, and prohibited-activity policies.
