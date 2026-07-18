# Production deployment

The production build is created by GitHub Actions and deployed as a standalone Next.js release. The VPS does not compile the application and does not require Docker.

GitHub Actions connects as the unprivileged `cryptodeploy` user. That account can upload a release archive and invoke the root-owned `/usr/local/sbin/cryptosugar-release` activator with a validated full Git SHA; it does not receive a general root shell.

## One-time setup

1. The VPS is currently sized at 4 GB RAM, 2 vCPUs, and 80 GB disk.
2. Run `./deploy/bootstrap-vps.sh` from the project root.
3. Use the private GitHub repository `cryptosugarbabes/website` and push the `main` branch.
4. Add the private SSH key as the GitHub Actions secret `VPS_SSH_KEY`.
5. Push to `main`. The deployment workflow will build, upload, activate, health-check, and retain the five newest releases.

## Domain cutover

The root `A` record and `www` CNAME now resolve to `161.35.17.40`.

HTTPS is already installed for both hostnames with automatic renewal. The original certificate command was:

```bash
certbot --nginx \
  -d cryptosugarbabes.com \
  -d www.cryptosugarbabes.com \
  --redirect
```

Certificate notices go to `cryptosugarbabes@gmail.com`.
# Persistent data

Run `deploy/bootstrap-vps.sh` to install PostgreSQL, create the persistent upload directory, and schedule daily database backups. Profile photos use the existing Droplet disk at `/opt/cryptosugarbabes/shared/uploads`; no Spaces subscription is required.

The administrator review screen is available at `https://cryptosugarbabes.com/admin`. Its password is stored as `ADMIN_PASSWORD` in `/opt/cryptosugarbabes/shared/.env`.

## Beta readiness checks

- Each account records separate timestamps for the 18+ attestation, Terms acceptance, and Privacy Policy acceptance. Policy versions are stored so members can be prompted again after a material policy update.
- `backup-data.sh` records a successful offsite-upload marker only after both encrypted archives reach the configured S3-compatible destination. `monitor-health.sh` treats a stale marker as an alert when `BACKUP_S3_URI` is configured.
- The daily backup also exports encrypted archives for the private `Archive encrypted production backup` GitHub workflow. The workflow verifies checksums, stores the files as a 30-day GitHub artifact, and only then writes the offsite-success marker checked by monitoring. Keep the separately downloaded recovery key outside the VPS and repository.
- Health, service, disk, backup, and restore-verification failures are sent to the private Telegram chat and administrator email using the application&apos;s existing credentials. Repeated failures are throttled for six hours and a recovery notice is sent automatically. `MONITOR_WEBHOOK_URL` remains available as an optional additional destination.
- Run `/usr/local/sbin/cryptosugar-monitor --test-alert` after changing notification credentials to verify both Telegram and SMTP delivery without simulating an outage.
- Complete a small real Solana paid-like and gift test with separate customer and creator wallets before opening the beta. Confirm both recipient transfers, transaction signatures, the 90/10 ledger split, and creator totals in the administrator dashboard.
