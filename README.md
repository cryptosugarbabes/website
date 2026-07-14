# Crypto Sugar Babes

Crypto-native, adults-only social discovery platform for `cryptosugarbabes.com`. The live foundation includes responsive discovery, server-verified Base/EVM and Solana wallet sign-in, permanent creator profiles, private photo processing, PostgreSQL storage, and an administrator approval queue.

## Run locally

1. Copy `.env.example` to `.env.local` and replace the development secrets.
2. Install dependencies with `pnpm install`.
3. Start the website with `pnpm dev`.
4. Visit `http://localhost:3000`.

Payment controls are intentionally in test mode. Wallet signatures are real and server-verified, but test messages and photo-likes never move funds.

## Profile and photo flow

- A verified Base or Solana wallet owns one creator profile.
- Saving creates or updates a permanent PostgreSQL record with `PENDING_REVIEW` status.
- The creator can upload up to 20 JPG, PNG, or WebP files of 5 MB each.
- Uploads are re-encoded as WebP, resized to a maximum of 2400×2400, and stripped of embedded metadata.
- Unapproved images are served only to their owning wallet and administrators.
- An administrator reviews profiles at `/admin`; approval makes the profile and approved images public.
- Production uploads live under `/opt/cryptosugarbabes/shared/uploads`, outside release folders, so deployments do not remove them.

The current storage uses the existing Droplet disk and does not require DigitalOcean Spaces. Database dumps run daily and are retained for 14 days. Photo disaster recovery still requires either DigitalOcean Droplet Backups or external object storage; local disk alone cannot protect against complete Droplet loss.

## Creator economy rules

- Incoming messages start at `0.30 USDC`; creators send and reply for free.
- Every 100 messages sent plus received adds 5 creator rating points.
- Each rating point increases the incoming-message price by 0.1%, using `0.30 × (1 + points × 0.001)`.
- Rating points have no maximum.
- A paid photo-like costs `0.11 USDC`: `0.10` creator share and `0.01` platform fee.
- Message revenue splitting remains configurable until the operating rule is chosen.
- Profile boosts and creator profile fees are not part of the product.

## Payment boundaries

- MetaMask, Rabby, Coinbase, Binance, and Trust injected wallets can authenticate on Base by signing a free message.
- Solana wallets including Solflare and Phantom can authenticate in the same way.
- WalletConnect support is installed and is enabled by setting `NEXT_PUBLIC_REOWN_PROJECT_ID` at build time. The GitHub workflow reads it from the `REOWN_PROJECT_ID` repository secret.
- Base is chain ID `8453`; Solana authentication uses Ed25519 signature verification.
- Platform products can transfer directly to the platform treasury.
- High-frequency micro-payments should use prepaid USDC credits or batched settlement. Requiring a blockchain transaction for every message or like is not acceptable UX.
- Creator payments, message charges, photo-like splits, coupons, affiliate fees, and commissions must use an audited settlement contract and immutable internal ledger. They should not be implemented as untracked direct wallet transfers.
- A future card-to-crypto on-ramp requires the provider's written approval for the product category and operating jurisdictions.

## Before accepting real customers

- Replace the starter discovery profiles as reviewed member profiles are approved.
- Add specialist age and identity verification; administrator approval is content review, not KYC.
- Add malware scanning and automated image moderation before publication.
- Add a database-backed nonce store, rate limiting, CSRF/origin checks, and passkey or recovery flows.
- Deploy an audited payment router and index confirmed chain events before enabling creator payments.
- Add immutable ledger entries, refunds, sanctions screening, abuse reporting, and moderator audit logs.
- Complete jurisdiction-specific legal review and publish terms, privacy, safety, and prohibited-activity policies.
