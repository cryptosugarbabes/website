# Production deployment

The production build is created by GitHub Actions and deployed as a standalone Next.js release. The VPS does not compile the application and does not require Docker.

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
