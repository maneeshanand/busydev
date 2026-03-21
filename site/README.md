# busydev.com site content

This folder contains the VitePress-powered landing/docs content for `busydev.com`.

## Structure

- `site/docs/index.md`: landing/home page
- `site/docs/getting-started.md`: quickstart
- `site/docs/setup.md`: prerequisites and setup
- `site/docs/core-workflows.md`: practical usage flow
- `site/docs/.vitepress/config.mts`: VitePress site config

## Publishing workflow

- GitHub Actions workflow: `.github/workflows/site-pages.yml`
- Triggered on changes to `site/**` on `main`
- Builds VitePress and deploys `site/docs/.vitepress/dist` to GitHub Pages

## Local preview

```bash
npm run docs:dev
```

For content updates, edit Markdown under `site/docs/` and merge to `main`.
