# IBD Journal

A web diary for people living with Crohn's disease or ulcerative colitis. Log stools and symptoms in a few taps, follow your treatments and lab results, prepare your exams, and bring a clear report to your doctor.

Your health data stays in your browser. No account, no server, no trackers.

Responsive, installable (PWA) and usable offline. Static site in [`web/`](web/README.md), deployable on Netlify's free plan.

## Features

- **Daily journal**: stools (Bristol 0–7, blood, mucus, pain and fatigue 0–5, urgency, night-time), false urges (never counted as stools), meals with photo or barcode scan (Open Food Facts), evening check-in.
- **History and trends**: monthly calendar colored by consistency, stools per day, symptom days compared with the previous period.
- **Doctor report**: printable page ("Save as PDF" from the browser): period summary, symptoms, treatments with adherence, latest blood panels with the lab's reference ranges.
- **Care**: treatments with adherence and refill alerts, scheduled blood and stool tests, colonoscopy and rectosigmoidoscopy preparation, 43 lab tests with the lab's own reference ranges, multi-PDF lab report import (read locally, reviewed before saving).
- **Reminders**: "To do today" card, notifications while the app is open, `.ics` export for your calendar.
- **Backup**: password-encrypted export and import (AES-256-GCM, PBKDF2).
- Light, dark and AMOLED themes, several palettes. English, French, German, Spanish, Italian, Portuguese.

## Privacy

- The journal, treatments and lab results are stored in the browser (IndexedDB). Nothing is sent to a server.
- Lab PDFs are read in the browser (pdf.js) and barcodes are scanned there too.
- The only network request is the barcode lookup on Open Food Facts (the barcode only).
- Clearing the site data erases the journal: export an encrypted backup regularly.

## Build

```bash
cd web
npm ci
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build in web/dist
```

See [`web/README.md`](web/README.md) for tests, deployment and details.

## Disclaimer

IBD Journal is a personal journal. It records and displays what you enter; it does not interpret your results or suggest any medical decision, and it is not a medical device. It does not replace medical advice: always follow your doctor's instructions, especially for exam preparation and treatments.

AI tools were used to write the code and to create the Bristol scale icons.

## License

[GNU AGPL-3.0](LICENSE). You may use, study, modify and share the app; anyone who distributes a modified version, or offers it as an online service, must publish its source code under the same license.
