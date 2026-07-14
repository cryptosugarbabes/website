# Production deployment

The production build is created by GitHub Actions and deployed as a standalone Next.js release. The VPS does not compile the application and does not require Docker.

## One-time setup

1. Resize the VPS if possible. The current 512 MB / 10 GB instance is below the recommended production size; 2 GB RAM and about 40 GB disk is a safer baseline.
2. Run `./deploy/bootstrap-vps.sh` from the project root.
3. Create a private GitHub repository named `cryptosugarbabes` and push the `main` branch.
4. Add the private SSH key as the GitHub Actions secret `VPS_SSH_KEY`.
5. Optionally add the Base treasury address as the repository variable `NEXT_PUBLIC_PLATFORM_TREASURY`. Without it, live USDC checkout stays disabled.
6. Push to `main`. The deployment workflow will build, upload, activate, health-check, and retain the five newest releases.

## Domain cutover

The current root domain is parked. When the app passes its VPS health check, change the root `A` record to `161.35.17.40`. The existing `www` CNAME can continue to point to `cryptosugarbabes.com`.

After DNS resolves to the VPS, issue the certificate on the server:

```bash
certbot --nginx \
  -d cryptosugarbabes.com \
  -d www.cryptosugarbabes.com \
  --redirect
```

Certbot will request the operational email address interactively. Do not run it before both hostnames resolve to the VPS.
