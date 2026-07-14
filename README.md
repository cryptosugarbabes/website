# Crypto Sugar Babes

Crypto-native, adults-only social discovery platform for `cryptosugarbabes.com`. The current foundation includes a responsive discovery experience, fictional demo profiles, server-verified Ethereum wallet sign-in, a PostgreSQL-ready marketplace schema, and a Base USDC checkout for platform profile boosts.

## Run locally

1. Copy `.env.example` to `.env.local` and replace the development secrets.
2. Install dependencies with `pnpm install`.
3. Start the website with `pnpm dev`.
4. Visit `http://localhost:3000`.

The checkout stays safely disabled while `NEXT_PUBLIC_PLATFORM_TREASURY` is the zero address. Add a Base wallet controlled by the operating company to enable the 20 USDC profile-boost transfer.

## Payment boundaries

- Base is chain ID `8453`.
- USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on Base.
- Platform products can transfer directly to the platform treasury.
- Creator payments, coupons, affiliate fees, and commission splits must use a separately audited payment-router contract. They should not be implemented as untracked direct wallet transfers.
- A future card-to-crypto on-ramp requires the provider's written approval for the product category and operating jurisdictions.

## Before production

- Replace the fictional in-code profiles with database-backed, reviewed profiles.
- Add specialist age and identity verification.
- Put uploads in private object storage, strip metadata, scan files, and moderate before publication.
- Add a database-backed nonce store, rate limiting, CSRF/origin checks, and passkey or recovery flows.
- Deploy an audited payment router and index confirmed chain events before enabling creator payments.
- Add immutable ledger entries, refunds, sanctions screening, abuse reporting, and moderator audit logs.
- Complete jurisdiction-specific legal review and publish terms, privacy, safety, and prohibited-activity policies.
