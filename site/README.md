# busydev.com site content

This folder contains the VitePress-powered landing/docs content for `busydev.com`.

## Structure

- `site/docs/index.md`: landing/home page
- `site/docs/getting-started.md`: quickstart
- `site/docs/setup.md`: prerequisites and setup
- `site/docs/core-workflows.md`: practical usage flow
- `site/docs/.vitepress/config.mts`: VitePress site config

## Publishing workflow

- Primary workflow: `.github/workflows/site-bluehost.yml`
- Triggered on:
  - pushes to `main` that touch `site/**`
  - manual `workflow_dispatch` (supports `dry_run`)
- Builds VitePress and deploys `site/docs/.vitepress/dist` to Bluehost over FTP/FTPS

### Required GitHub Secrets

- `BLUEHOST_FTP_HOST`
- `BLUEHOST_FTP_USERNAME`
- `BLUEHOST_FTP_PASSWORD`

### Recommended GitHub Repository Variables

- `BLUEHOST_FTP_PROTOCOL` (`ftps` recommended, or `ftp`)
- `BLUEHOST_FTP_PORT` (`21` default unless provider-specific override)
- `BLUEHOST_FTP_REMOTE_DIR` (`/public_html/` by default)
- `BLUEHOST_FTP_PASSIVE` (`true` default)
- `BLUEHOST_SSL_VERIFY` (`true` default)
- `BLUEHOST_SITE_URL` (`https://busydev.com`)
- `BLUEHOST_CANONICAL_URL` (optional, e.g. `https://www.busydev.com`)

## Local preview

```bash
npm run docs:dev
```

For content updates, edit Markdown under `site/docs/` and merge to `main`.
