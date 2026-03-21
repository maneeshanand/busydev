# busydev.com site content

This folder contains the initial landing page and docs content for `busydev.com`.

## Structure

- `site/index.html`: landing page
- `site/docs/index.html`: docs home
- `site/docs/getting-started.html`: quickstart
- `site/docs/setup.html`: prerequisites and setup
- `site/docs/core-workflows.html`: practical usage flow
- `site/styles.css`: shared site styling

## Publishing workflow

- GitHub Actions workflow: `.github/workflows/site-pages.yml`
- Triggered on changes to `site/**` on `main`
- Deploys the static `site/` directory to GitHub Pages

For content-only updates, edit HTML/CSS files in this folder and merge to `main`.
