# IBD Journal — web version

Responsive, offline-capable PWA port of the Android app. Static site (Vite + Preact + TypeScript), no server, no account: data stays in the browser (IndexedDB).

## Develop

```bash
cd web
npm ci
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run e2e        # Playwright (Chromium + Firefox; E2E_BROWSERS=chromium,firefox,webkit to add WebKit)
npm run build      # i18n generation + typecheck + production build in web/dist
```

Strings come from the Android resources: `npm run i18n` regenerates `src/i18n/*.json` from `i18n-source/values*/strings*.xml` (frozen copy of the former Android resources) plus `src/i18n/web-extra.*.json` (web-only strings, `web_*` keys). Do not edit the generated JSON by hand.

## Deploy on Netlify (free plan)

`netlify.toml` at the repo root sets `base = "web"`, `npm ci && npm run build`, publish `dist`, the SPA redirect, the CSP and the other security headers. No Netlify Function is used.

1. Push the repo to GitHub/GitLab (the folder is not a git repository yet; `.gitignore` already excludes `keystore/`, `keystore.properties`, `local.properties`, `Labos/`).
2. Netlify → *Add new site* → *Import from Git*; the build settings are read from `netlify.toml`.
3. Or from the CLI: `npx netlify deploy --prod` (after `npm run build` in `web/`, `--dir=web/dist`).

AGPL-3.0: a hosted service must offer its source. Set `SOURCE_URL` in `src/config.ts` to the public repository that contains the deployed code.

## Notes

- No background reminders: a "To do today" card, `.ics` export (calendar alarms) and notifications while the app is open.
- Doctor report: print / "Save as PDF" from the browser.
- Data lives in the browser: export an encrypted backup regularly. The backup format is the one of the former Android app (`IBDJENC1`), so old phone backups can be imported.
