# Crypto Sugar Babes

Crypto-native, adults-only social discovery platform for `cryptosugarbabes.com`. The live foundation includes passwordless email access, server-verified Base/EVM and Solana wallet linking, permanent creator profiles, private photo processing, PostgreSQL storage, free messaging, automatic creator publication, and retrospective administrator review.

## Dashboards

- `/dashboard` is the private role-aware member area. Customers can manage their private profile, favorites, conversations, support history, safety reports, linked identities, and deletion requests. Creators additionally see publication status, photo management, earnings, paid likes, creator points, 24-hour discovery position, and their confirmed 90% payment share.
- `/admin` is the protected operations console. Named administrators sign in with an allowlisted email code; a private administrator password remains available. The console includes platform metrics, retrospective creator review and removal, account search and suspension, deletion-request review, confirmed payment reconciliation, safety cases, and an administrator action audit trail.
- Suspended accounts are removed from public discovery and cannot sign in, message, receive new paid support, or expose public media while suspended.

## Run locally

1. Copy `.env.example` to `.env.local` and replace the development secrets.
2. Install dependencies with `pnpm install`.
3. Start the website with `pnpm dev`.
4. Visit `http://localhost:3000`.

Passwordless email access uses a six-digit, ten-minute code. Configure the `EMAIL_SMTP_*` values from `.env.example`; Hostinger Email uses `smtp.hostinger.com` on SSL port `465`.

## Telegram website-chat replies

The optional Telegram bridge forwards website messages for every account marked **Alerts on** in the administrator Notifications page to one allowlisted, private Telegram bot chat. Configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_PASSWORD`, and `TELEGRAM_WEBHOOK_SECRET` in the production environment, then register `https://cryptosugarbabes.com/api/telegram/webhook` with Telegram's `setWebhook` method and pass the same secret as `secret_token`. Send `/unlock your-password` in the private bot chat to enable alerts and replies for 12 hours; the bot attempts to delete that password message immediately. Send `/lock` when finished. Five incorrect passwords lock access for 15 minutes. The bridge rejects every other chat and Telegram groups, encrypts saved replies, and de-duplicates Telegram retries. Turning an account's alerts off also prevents replies through its earlier Telegram notifications.

Administrators can also search and open conversations from the Conversations page. Opening content requires an audited reason. An administrator may reply only as a participant whose **Alerts on** setting is enabled; each such reply records the administrator identity, selected account, conversation, message, reason, and time.

## Identity and access

- Email sign-in creates a private account without a password or wallet.
- Email-authenticated customers can save favorites, send and receive messages, block accounts, and submit safety reports for free.
- Email-authenticated creators can publish a profile and up to eight photos free, and message without a wallet. Profiles and photos publish automatically and remain subject to administrator review.
- Paid photo likes, gifts, and message boosts require the customer to connect and sign the matching wallet.
- Connecting a wallet while signed in by email links that wallet to the same account; it does not create a second profile.

## Profile and photo flow

- Each verified email or wallet account can own one creator profile.
- Saving creates or updates a permanent PostgreSQL record with `APPROVED` status unless an administrator has already rejected the profile.
- A creator can join by email, publish a profile, message for free, and upload up to 8 JPG, PNG, or WebP files of 5 MB each at no cost.
- A creator must link a verified Solana wallet, or a verified Base wallet after the atomic splitter is configured, before live paid likes, gifts, or message boosts can be sent to the profile.
- Uploads are re-encoded as WebP, resized to a maximum of 2400×2400, and stripped of embedded metadata.
- New images publish automatically and remain available for retrospective administrator review.
- An administrator reviews profiles at `/admin` and can remove or restore profiles and photographs at any time.
- Production uploads live under `/opt/cryptosugarbabes/shared/uploads`, outside release folders, so deployments do not remove them.

The current storage uses the existing Droplet disk and does not require DigitalOcean Spaces. Database dumps run daily and are retained for 14 days. `BACKUP_S3_URI` can be configured for an additional encrypted offsite copy; local disk alone cannot protect against complete Droplet loss.

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
- `/api/payments/config` publishes the active treasury destinations and split policy for clients. Solana settlement is enabled and verified as one atomic transaction. Base payment settlement remains disabled until an independently reviewed splitter is deployed and `BASE_SPLITTER_ADDRESS` is configured; Base authentication and free messaging are unaffected.
- Platform products can transfer directly to the platform treasury.
- High-frequency micro-payments should use prepaid USDC credits or batched settlement. Requiring a blockchain transaction for every message or like is not acceptable UX.
- Paid likes, gifts, and message boosts are recorded only after server-side chain verification. Base must use the reviewed atomic splitter and never falls back to two independent transfers.
- A future card-to-crypto on-ramp requires the provider's written approval for the product category and operating jurisdictions.

## Before accepting real customers

- Replace the starter discovery profiles as member profiles are published.
- Add specialist age and identity verification; automatic publication and administrator content review are not KYC.
- Add malware scanning and automated image moderation before publication.
- Add passkey or documented account-recovery flows. Nonces, rate limits, origin checks, and confirmed payment records are database-backed.
- Independently review and deploy the Base splitter before enabling Base creator payments.
- Add immutable ledger entries, refunds, sanctions screening, abuse reporting, and moderator audit logs.
- Complete jurisdiction-specific legal review and publish terms, privacy, safety, and prohibited-activity policies.
