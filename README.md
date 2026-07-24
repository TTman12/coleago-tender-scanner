# Coleago Tender Scanner

Five files. No build step. No dependencies.

- `index.html` — the dashboard (judging parameters, live test, tender list)
- `api/ingest.js` — the door: change detector posts here, Claude judges, keepers are stored and emailed
- `api/settings.js` — read/save judging parameters
- `api/tenders.js` — list stored tenders
- `package.json` — just marks the project

## Environment variables (set in Vercel → Settings → Environment Variables)

Required:
- `ANTHROPIC_API_KEY` — your Anthropic key
- `INGEST_SECRET` — any long random string you invent

Added automatically when you add Upstash Redis from the Storage tab:
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` equivalents)

Optional, to switch on email:
- `RESEND_API_KEY` — from resend.com
- `ALERT_EMAIL` — where alerts go
- `ALERT_FROM` — a verified sender address (defaults to Resend's test sender)

## Sending a change in

POST to `/api/ingest` with header `Authorization: Bearer YOUR_INGEST_SECRET` and body:

```json
{"source":"ICASA","url":"https://example.com/tenders","changed_text":"..."}
```

Add `"test": true` to judge without saving or emailing.

## Connecting changedetection.io later

Add a webhook notification pointing at `https://YOUR-SITE.vercel.app/api/ingest`,
with the Authorization header above, and this body:

```json
{"source":"{{watch_title}}","url":"{{watch_url}}","changed_text":"{{diff}}"}
```
