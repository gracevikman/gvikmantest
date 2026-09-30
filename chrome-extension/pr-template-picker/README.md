# PR Template Picker

Chrome extension (Manifest V3, plain JavaScript, no build step) that adds a "PR template" dropdown to GitHub's compare / new pull request page. Picking a template reloads the page with `template=<file>&expand=1`, so GitHub fills in the PR body.

Templates are read from the repo's default branch in `.github/PULL_REQUEST_TEMPLATE`, `PULL_REQUEST_TEMPLATE`, or `docs/PULL_REQUEST_TEMPLATE` (plus lowercase variants) (first one with templates wins).

## Install

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and select this directory.

## Private repos

Public repos work without setup. For private repos (or to avoid API rate limits), open the extension options and save a GitHub personal access token with read access to repository contents. It is stored in `chrome.storage.local` (this browser only, not synced across devices) and only sent to `api.github.com`.

## Tests

```
node --test test/*.test.js
```
