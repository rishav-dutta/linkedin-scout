---
name: run-linkedin-scout
description: Build, run, and drive the LinkedIn Scout web app (Vite + React). Use when asked to start or run the app, take screenshots of its UI (desktop, phone, dark mode), test the search → resume upload → ranked flow, stress-test it with worst-case data, or check a UI change, without spending Apify credits.
---

Start the Vite dev server, then drive it with `.claude/skills/run-linkedin-scout/driver.mjs`, a Playwright script that **mocks the backend by default**. Every real search spends Apify credits and counts against the n8n-proxy rate limit, so the driver answers the Supabase Edge Function and RPC calls itself unless you pass `--live`.

All paths are relative to the repo root. Verified on macOS (Node 25.8, Playwright 1.61.1). Not yet run on Linux.

## Prerequisites

Node and a global Playwright with Chromium. The driver uses the project's `playwright` if one is installed, otherwise the global one. If `npm ls -g playwright` shows nothing, install it with `npm install -g playwright` (not re-run here, since it was already installed).

```bash
npm ls -g playwright
npx playwright install chromium
```

## Setup

```bash
npm ci
```

The app refuses to start without Supabase settings and shows "App not configured" instead. For mocked driving, placeholder values passed on the command line are enough, so no `.env.local` or real key is needed. For `--live`, put the real URL and anon key in `.env.local` (see `.env.example`).

## Run (agent path)

Start the dev server on **port 5173**, the only localhost origin the Edge Function allows (it matters for `--live`), and wait until it serves:

```bash
VITE_SUPABASE_URL=https://placeholder.supabase.co VITE_SUPABASE_ANON_KEY=placeholder-anon-key nohup npm run dev -- --port 5173 --strictPort > /tmp/linkedin-scout-dev.log 2>&1 &
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 0.5; done
```

Drive the full flow. It goes idle → search → profiles loading → people found → upload a fake PDF → ranked list → keyboard (↓ ↓ Enter), with a screenshot at each step:

```bash
node .claude/skills/run-linkedin-scout/driver.mjs
node .claude/skills/run-linkedin-scout/driver.mjs --data worst --device both
node .claude/skills/run-linkedin-scout/driver.mjs --scheme dark --device phone
node .claude/skills/run-linkedin-scout/driver.mjs --company nobody
node .claude/skills/run-linkedin-scout/driver.mjs --company ratelimit
```

Screenshots go to `/tmp/linkedin-scout-shots/<data>[-<company>]-<device>-<scheme>-<step>.png`. Each run prints horizontal overflow and console errors, and exits 1 if either is non-zero or a step times out. In that case it also saves `…-error.png`.

| option | effect |
|---|---|
| `--data demo\|worst` | Demo is the sample "Acme Cloud" people. Worst is break-ui style data: long accented names, 3-line titles with "\|", a broken photo URL, a one-letter name, CJK and Vietnamese names, scores 0 and 100, an unscored person, a long company name |
| `--device desktop\|phone\|both` | 1280×860, or 390×844 touch (iPhone-like, 2× scale) |
| `--scheme light\|dark` | colour scheme |
| `--company nobody` | mocked `{"status":"no_results"}` → the "No LinkedIn profiles found" message |
| `--company ratelimit` | mocked HTTP 429 with an error body → the rate-limit message, as the real Edge Function sends it |
| `--headed` | opens a visible window with the mocked backend and leaves it open. Close the window to exit |
| `--live` | no mocks: real search and scoring. Spends Apify and Gemini credits and uses the rate limit (5 searches per hour per IP). Needs the real `.env.local` |

Stop the dev server:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs kill
```

## Run (human path)

`npm run dev` with a real `.env.local`, then open http://localhost:5173. Real searches cost Apify credits. Use `--headed` above to click around with mocked data instead.

## Test

There is no unit test suite. These are the checks CI runs:

```bash
npm run lint && npm run typecheck && npm run build
cd supabase/functions/n8n-proxy && deno check index.ts && rm -f deno.lock
```

All pass on the current tree. `deno check` writes a `deno.lock` that isn't part of the repo, so delete it afterwards.

## Gotchas

- **Mocks must be time-based, not call-counted.** React StrictMode runs effects twice in dev, so "first RPC call returns profiles still loading" was consumed by the discarded first effect and the loading state never appeared. The driver marks profiles as loading for 3.5 s after the first read.
- **The resume input is a hidden `<input type=file id="resume-upload">`.** Waiting for it to be visible never resolves. Wait for the "Choose PDF" button text, then call `setInputFiles('#resume-upload', …)` on the hidden input.
- **Upload stays disabled until full profiles arrive.** With mocks that takes about 3.5 s. Live, Apify takes 7–35 s (the driver waits up to 180 s).
- **The error path logs on purpose.** The app `console.error`s failed searches (for example the 429), so the driver ignores console errors once an error banner appears.
- **Vercel Analytics in dev** logs a debug line and requests `/_vercel/insights/*`. The driver blocks that request and filters the resulting `ERR_FAILED` console message.
- **GoatCounter** (`gc.zgo.at/count.v5.js` in `index.html`) is an outside request, so the driver blocks it too; `track()` in `src/lib/analytics.ts` is then a no-op. GoatCounter also ignores localhost by itself, so local runs never count as visits.
- **ESLint only covers `.ts`/`.tsx`**, so `npm run lint` doesn't check this driver.
- **macOS has no `timeout` command.** Poll with a `for … sleep` loop, as above.
- **Stop the server by its port, not `pkill -f vite`.** A broad pattern can match unrelated processes.

## Troubleshooting

- **`waiting for locator('#resume-upload:not([disabled])') to be visible` times out**: the input is hidden by design. Wait for `text=Choose PDF` instead.
- **The "Loading full profiles" screenshot is skipped and the list is ready immediately**: a call-counting mock collided with StrictMode's double effect (see Gotchas).
- **The driver exits 1 on `--company ratelimit` with "Failed to load resource: 429"**: expected app logging. Fixed in the driver by clearing errors on the alert path. If it comes back, check that the `[role=alert]` banner rendered.
