# Security policy

## Supported versions

Only the latest release receives security fixes. Please check that the issue still exists in the
[latest release](https://github.com/Djef0o/WEB_IBD_JOURNAL/releases/latest) before reporting it.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: on the repository page, open the **Security** tab and click
**Report a vulnerability**
([direct link](https://github.com/Djef0o/WEB_IBD_JOURNAL/security/advisories/new)).

Please include:

- the affected version (the deployed version or commit);
- the browser and its version;
- steps to reproduce, and the impact you expect.

This is a personal project maintained by one person: expect an answer within about a week. Once a fix is
released, the report can be made public and you will be credited if you wish.

## Scope

IBD Journal stores health data locally and has no server. Relevant areas:

- **Local data:** the database stays on the device; Android cloud backup is disabled
  (`allowBackup="false"` and data extraction rules).
- **Encrypted export:** AES-256-GCM with a key derived by PBKDF2-HMAC-SHA256 (600,000 iterations,
  random salt and IV). A forgotten password cannot be recovered.
- **Network:** the only request is a barcode lookup to [Open Food Facts](https://world.openfoodfacts.org/),
  over HTTPS.
- **Sharing:** PDF reports are shared through a `FileProvider` limited to the app's `cache/reports/` folder.

Out of scope: vulnerabilities in third-party libraries with no impact on this app, and attacks requiring a
rooted or already compromised device.
