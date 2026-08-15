# Argos One — Services & Keys Handoff (for Codex)

Everything Codex needs to wire the app to its backend: what each service does,
its key, and where the value lives.

> **Secret keys are NOT written in this doc on purpose.** The real values for the
> two *secret* keys are already in the `.env` files on disk (see §3). Read them
> from there — never paste a secret into chat, a commit, or a shared doc, and
> never ship one to the browser (no `NEXT_PUBLIC_` prefix on a secret).

---

## 1. The four services — what each provides

| Service | Provides | Env var(s) | Type |
|---|---|---|---|
| **Supabase** | **Storage / database.** Holds the vehicle catalog, shops, users, customers, vehicles, jobs, repair records, parts, photos, DTCs and research history. | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable (browser-safe) |
| **Serper** | **Web product-price search.** Powers "Search best price" — queries Google Shopping and returns AU offers (merchant, price, image, link). | `SERPER_API_KEY` | **Secret (server-only)** |
| **Groq** | **Speech-to-text and text AI.** Powers dictation, copy enhancement and job-card summaries. | `GROQ_API_KEY` | **Secret (server-only)** |
| **Vercel** | **Hosting / deployment.** Serves the app and runs the server-side API routes; stores the secret keys as encrypted env vars in prod. | *(no app key — CLI/dashboard auth)* | Platform |

---

## 2. The publishable keys (browser-safe — OK to use inline)

These are *meant* to be public (Supabase's anon/publishable key is protected by
Row-Level Security, not secrecy):

```
NEXT_PUBLIC_SUPABASE_URL=https://dzlfbcjaoxwecqitrvup.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_q0c3xX_8924wUNvpXQ3uJw_oVAHE2Ez
```

---

## 3. The secret keys (values live on disk — do not print them)

`GROQ_API_KEY` and `SERPER_API_KEY` are **secret**. Their real values are in:

- `/Users/dsg/Documents/argos-one/.env`  (and `.env.local` — same values)
- On Vercel: Project → Settings → Environment Variables (Production + Development)

To run locally, make sure the project's `.env.local` contains all four vars. On
Vercel they're already set. **Codex: read the secret values from `.env` — never
copy them into source, the browser, or any message.**

Where the values originally come from (if a key ever needs replacing):
- `GROQ_API_KEY` → console.groq.com → API Keys
- `SERPER_API_KEY` → serper.dev → API Keys

---

## 4. How the keys are used (never call these services from the browser)

The secret keys are only ever read **server-side**, inside these API routes. The
browser calls our own routes; our routes call Groq/Serper with the secret key.
This is what keeps the secrets off the client.

| Route | Uses | Purpose |
|---|---|---|
| `POST /api/parts/search` | `SERPER_API_KEY` | Parts price search → AU offers (see INTEGRATION.md §2) |
| `POST /api/transcribe` | `GROQ_API_KEY` | Dictate → text |
| `POST /api/ai/enhance` | `GROQ_API_KEY` | Enhance notes without inventing facts |
| `POST /api/research` | `SERPER_API_KEY` | Repair research → saved web citations |
| `GET /api/vin?vin=…` | *(none — free NHTSA)* | VIN decode (assist) |

> **Architecture note:** these routes are **Next.js** server routes in this repo.
> The approved UI is served by the same app at `/dashboard`, and it calls only
> these first-party `/api/*` routes. Full details: `docs/INTEGRATION.md`.

---

## 5. Rules (please keep these)

- Read secret values from `.env` only; never inline them in code or messages.
- No `NEXT_PUBLIC_` prefix on `GROQ_API_KEY` / `SERPER_API_KEY`.
- Never call Groq / Serper / NHTSA directly from browser code — always via the
  `/api/*` routes above.
- Full API request/response shapes and the UI reconciliation are in
  `docs/INTEGRATION.md`.
