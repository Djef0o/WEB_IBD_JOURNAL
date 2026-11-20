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

- No background reminders: a "To do today" card, `.ics` export (calendar alarms) and notifications while the app is open. Not possible in a browser, so absent compared with the Android app: notifications while the app is closed, answering a dose or typing a weight from a notification (the card does it), home-screen widgets, the phone calendar sync (replaced by the `.ics` export).
- Emergency sheet on the lock screen: when "Show on the lock screen" is turned on, a clear-text copy (name, birth date, diagnosis, treatment names and the emergency fields) is kept in the preferences so that it can be read before the PIN is entered; it is rewritten when the sheet changes and deleted when the option is turned off. It is not part of the backup.
- Doctor report: print / "Save as PDF" from the browser.
- Data lives in the browser: export an encrypted backup regularly. The backup format is the one of the former Android app (`IBDJENC1`), so old phone backups can be imported.
- PIN lock: the first launch (or the first launch after an update, for an existing install) asks for a 6 to 12 digit PIN. A random data key encrypts every record and photo (AES-256-GCM); it is stored wrapped by a PBKDF2 key derived from the PIN, and optionally by a WebAuthn PRF secret (fingerprint/face, only where the browser supports it). The app locks on each launch and after 1 minute in the background, like the Android app. Like on Android, the 5th wrong PIN starts waiting times of 30 s, 1 min, 5 min, 15 min, then 1 h, shown as a countdown on the lock screen. "PIN forgotten?" erases the local data and starts over, keeping appearance, language and reminder settings. Not encrypted: record ids, counts, preference names (theme, language), product barcodes. A forgotten PIN cannot be recovered: only the encrypted backup restores the data.
