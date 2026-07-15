# Crypto Sugar Babes

Crypto-native, adults-only social discovery platform for `cryptosugarbabes.com`. The live foundation includes passwordless email access, server-verified Base/EVM and Solana wallet linking, permanent creator profiles, private photo processing, PostgreSQL storage, free messaging, and an administrator approval queue.

## Dashboards

- `/dashboard` is the private role-aware member area. Customers can manage their private profile, favorites, conversations, support history, safety reports, linked identities, and deletion requests. Creators additionally see profile review status, photo management, earnings, paid likes, creator points, 24-hour discovery position, and their confirmed 90% payment share.
- `/admin` is the password-protected operations console. It includes platform metrics, creator profile approval, account search and suspension, deletion-request review, confirmed payment reconciliation, safety cases, and an administrator action audit trail.
- Suspended accounts are removed from public discovery and cannot sign in, message, receive new paid support, or expose public media while suspended.

## Run locally

1. Copy `.env.example` to `.env.local` and replace the development secrets.
2. Install dependencies with `pnpm install`.
3. Start the website with `pnpm dev`.
4. Visit `http://localhost:3000`.

Passwordless email access uses a six-digit, ten-minute code. Configure the `EMAIL_SMTP_*` values from `.env.example`; Hostinger Email uses `smtp.hostinger.com` on SSL port `465`.

## Identity and access

- Email sign-in creates a private account without a password or wallet.
- Email-authenticated customers can save favorites, send and receive messages, block accounts, and submit safety reports for free.
- Publishing a creator profile requires a verified Base or Solana wallet.
- Paid photo likes, gifts, and message boosts require the customer to connect and sign the matching wallet.
- Connecting a wallet while signed in by email links that wallet to the same account; it does not create a second profile.

## Profile and photo flow

- A verified Base or Solana wallet owns one creator profile. Email-only accounts cannot publish.
- Saving creates or updates a permanent PostgreSQL record with `PENDING_REVIEW` status.
- The creator can upload up to 20 JPG, PNG, or WebP files of 5 MB each.
- Uploads are re-encoded as WebP, resized to a maximum of 2400×2400, and stripped of embedded metadata.
- Unapproved images are served only to their owning wallet and administrators.
- An administrator reviews profiles at `/admin`; approval makes the profile and approved images public.
- Production uploads live under `/opt/cryptosugarbabes/shared/uploads`, outside release folders, so deployments do not remove them.

The current storage uses the existing Droplet disk and does not require DigitalOcean Spaces. Database dumps run daily and are retained for 14 days. Photo disaster recovery still requires either DigitalOcean Droplet Backups or external object storage; local disk alone cannot protect against complete Droplet loss.

## Creator economy rules

- Normal messages are free for every member.
- A sender can optionally attach a USDC boost to a message for priority placement. The boost also contributes to creator support and sender generosity reputation.
- A paid photo-like begins at `5.00 USDC`.
- Every completed 100 paid likes increases that creator's next paid-like amount by 0.1%, using `5.00 × (1 + floor(likes / 100) × 0.001)`.
- Every completed 100 paid likes adds 5 creator support points; each whole USDC given as a custom gift adds one more support point.
- Paid likes, message boosts, and gifts use a 90% creator / 10% platform split.
- Custom gifts also add one sender generosity point per whole USDC, with visible supporter levels planned for Sugar Daddy profiles.
- Profile boosts and creator profile fees are not part of the product.

## Payment boundaries

- MetaMask, Rabby, Coinbase, Binance, and Trust injected wallets can authenticate on Base by signing a free message.
- Solana wallets including Solflare and Phantom can authenticate in the same way.
- WalletConnect uses the public Crypto Sugar Reown project ID, with an optional `NEXT_PUBLIC_REOWN_PROJECT_ID` build-time override. The GitHub workflow can read that override from the `REOWN_PROJECT_ID` repository secret.
- Base is chain ID `8453`; Solana authentication uses Ed25519 signature verification.
- Base platform fees are assigned to `0x7293F09B131B99D564c602538D0777b18075c9b4`; Solana platform fees are assigned to `EjkzchC98rxfQzHgmXD5cCbBQmhp1csqbPHkpXEA9shL`. These public destinations can be overridden at build time with `NEXT_PUBLIC_BASE_TREASURY_ADDRESS` and `NEXT_PUBLIC_SOLANA_TREASURY_ADDRESS`.
- `/api/payments/config` publishes the active treasury destinations and split policy for clients. `settlementEnabled` remains `false` until an audited payment router and ledger are deployed.
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
