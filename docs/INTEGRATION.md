# Argos One — Backend Integration Contract

**For whoever is building the UI (Codex included).** This is the stable backend
surface of the app. Build the UI *around* these — call the routes/helpers below.
The backend is done and verified; treat it as a frozen contract.

> **Direction (updated):** the contract is being **matched to the existing Codex
> UI**, not the other way round. See §10 for how the real API maps onto what the
> UI renders, and the two concerns that need a decision.

> **Do not paste secret values anywhere.** Keys live in `.env.local` (gitignored)
> and Vercel env settings. This doc names the env vars and where each value comes
> from — never the values themselves. No secret belongs in code, a commit, or a
> chat message.

---

## 1. Ground rules (please respect these)

- **Don't edit the backend files** in §6 unless the contract itself needs to
  change — coordinate first, since collisions here break live features.
- Secrets are **server-side only** — never prefix a secret with `NEXT_PUBLIC_`.
  Anything the browser needs (Supabase URL/anon key) already carries that prefix
  intentionally; the rest must stay server-side.
- Call server routes from the client; **never** call Groq/Serper/NHTSA directly
  from browser code (that would leak keys and hit CORS).

---

## 2. API routes

### `POST /api/parts/search` — live parts price search

Price-scouts Google Shopping (via Serper) for a part. **AU-biased, cheapest-first.**

- **Request body:** `{ "query": string, "partNumber"?: string }`
- **Response 200:** `{ "query": string, "offers": PartOffer[] }` (see §4)
- **Errors:** `400` missing query · `500` not configured (no key) · `502` upstream failed
- Each offer includes `imageUrl` — render product thumbnails Google-Shopping style.
- **Keep the fitment disclaimer** in the results sheet: results are near-matches,
  not VIN-verified. "Confirm fitment against the VIN and supplier catalogue before
  ordering."
- Client helper: `searchPartPrices(query, partNumber?)` in `lib/parts-search.ts`.

### `POST /api/transcribe` — speech-to-text

Records audio in the browser (MediaRecorder), posts it here, returns text.
Works on iOS (Web Speech API does not). Powered by Groq Whisper.

- **Request:** `multipart/form-data` with a `file` field (the audio blob)
- **Response 200:** `{ "text": string }`
- **Errors:** `400` no/invalid audio · `500` not configured · `502` upstream failed
- Reference component: `components/ui/voice-input.tsx` (records + posts + inserts
  the returned text). Reuse or restyle it, but keep the record→POST→insert flow.

### `GET /api/vin?vin=<17-char>` — VIN decode (assist only)

Decodes a VIN via NHTSA. **Australia-first caveat:** many AU imports (European/JDM)
return only make + year, no model — that's expected, not an error. Manual
Year/Make/Model entry is the primary path; VIN is an assist.

- **Request:** query param `vin` (must be exactly 17 chars)
- **Response 200:** `VinDecodeResult` (see §4) — `partial: true` when model is absent
- **Errors:** `400` wrong length · `404` undecodable · `500` failure

---

## 3. Supabase catalog helpers (`lib/vehicle-data.ts`)

Backs the Year/Make/Model dropdowns. Case-insensitive, shared shop-wide (a model
one shop adds, everyone sees). All async.

```ts
getAllMakes(): Promise<string[]>
getModelsForMake(make: string): Promise<string[]>
addCustomMake(make: string): Promise<void>          // dupes ignored (case-insensitive)
addCustomModel(make: string, model: string): Promise<void>
```

- Duplicate casings can't coexist (`sq5` === `SQ5`) — enforced by DB unique indexes.
- The searchable dropdown with an "Add X" option lives in `components/ui/combobox.tsx`.

---

## 4. Types (`types/index.ts`)

```ts
interface PartOffer {
  title: string
  merchant: string
  price: string          // display string, e.g. "$74.90"
  priceValue: number | null   // parsed number for sorting; null if unparseable
  currency: string       // "AUD"
  link: string
  imageUrl?: string
  rating?: number
  ratingCount?: number
  delivery?: string
}
interface PartSearchResult { query: string; offers: PartOffer[] }

interface VinDecodeResult {
  make: string; model: string; year: string
  engine: string; trim: string; bodyStyle: string; fuelType: string
  partial?: boolean      // true = model missing (common for AU imports)
  error?: string
}

// Also available: Vehicle, DtcCode, Solution, Job (see the file). NOTE: Job/Solution
// currently back the MOCKED Results page (lib/mock-data.ts) — not yet persisted.
```

---

## 5. Environment variables (names + source — NO values here)

| Var | Scope | Where the value comes from | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase → Settings → API | ✅ live |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase → Settings → API (anon/publishable) | ✅ live |
| `GROQ_API_KEY` | **server** | console.groq.com → API keys | ✅ live |
| `SERPER_API_KEY` | **server** | serper.dev → API keys | ✅ local + Vercel |
| `REQUIRE_AUTH` | **server** | deployment configuration | ✅ Vercel Production (`true`) |

To run locally, `.env.local` must hold the four service variables. Vercel
Production and Development already contain them; Production also enforces
authentication with `REQUIRE_AUTH=true`.

---

## 6. Backend files (the contract lives here — read, don't rewrite)

| File | Role |
|---|---|
| `app/api/parts/search/route.ts` | Parts price search route |
| `app/api/transcribe/route.ts` | Speech-to-text route |
| `app/api/vin/route.ts` | VIN decode route |
| `lib/parts-search.ts` | `searchPartPrices()` client helper |
| `lib/nhtsa.ts` | VIN decode logic |
| `lib/vehicle-data.ts` | Supabase catalog helpers |
| `lib/supabase/client.ts` | Browser Supabase client |
| `types/index.ts` | Shared types |

---

## 7. Decided UX rules (from docs/supabase-plan.md §9)

- **Results match tabs:** keep all four — **Best match · Same model · Same engine ·
  Web sources**. Auto-hide a tab when its slice is empty.
- **Rename** "Repair sequence" → **"What worked"**.
- **Parts sheet:** render offers with product images, cheapest-first; keep the
  fitment disclaimer banner.
- **Touch targets:** infotainment-scale — large, high-contrast, generous tap
  areas (mechanics use this with dirty hands on a phone).

---

## 8. Current production implementation

| Area | State |
|---|---|
| Vehicle catalog dropdowns | ✅ real (Supabase) |
| VIN decode / STT / parts search | ✅ real |
| Photos in check-in and repair | ✅ private Supabase Storage + signed URLs |
| Similar repair matching | ✅ workshop-scoped SQL ranking by vehicle, DTC and text similarity |
| Auth / shops / roles | ✅ Supabase Auth + owner/manager/technician profiles + RLS |
| Jobs/repairs persistence | ✅ customer, vehicle, job, repair, steps, items and verification tables |
| AI text enhancement / card summary | ✅ server-side Groq routes |
| Web repair research | ✅ server-side Serper search + saved citations |

The complete schema is active in the Sydney production project
`dzlfbcjaoxwecqitrvup`. See `docs/PRODUCTION_SETUP.md` for deployment and field
testing.

---

## 10. Reconciliation with the Codex UI (read this before integrating)

The approved Argos UI is now bundled into this Next.js app under
`public/argos-ui/` and served at `/dashboard`. It uses the APIs above for live
data; the legacy `/Users/dsg/Documents/Argos One UI` folder remains a visual
source/reference and should not be deployed independently.

### 10.1 Two concerns that need a decision

1. **The UI has no server → it can't run the keyed backend as-is.** A static site
   can't execute `/api/*` routes and can't safely hold the Groq/Serper keys
   (anything in `app.js` ships to the browser). **Plan:** port the static UI into
   this Next.js app (`argos-one`) once the design is final — then `/api/*` +
   hidden keys just work. (Alternative: host this backend separately and call it
   cross-origin. Never put keys in `app.js`.)
2. **"In stock · 6 km" is not real.** The mock price rows show live stock +
   distance. Google Shopping (Serper) returns **no inventory and no distance** —
   only merchant, price, image, link, and sometimes delivery. Live stock/distance
   needs direct AU supplier APIs (Repco/Burson/Sparesbox) = a later v2. **Don't
   design around stock/distance for v1** — show what's real (below) and drop the
   "6 km" line rather than fake it.

### 10.2 Parts search — real `PartOffer` → UI offer row

The UI renders each offer as `[supplier, price, availability, detail]` + an image.
Map the real `PartOffer` like this (honest — no fabricated fields):

| UI field | From `PartOffer` | Notes |
|---|---|---|
| `supplier` | `merchant` | — |
| `price` | `price` | already a display string; sorted cheapest-first |
| image | `imageUrl` | **per-offer real photo** (better than one reference image) |
| `availability` | `delivery` if present, else `"Online"` | **do not** synthesize stock/distance |
| `detail` | `title` | the product/listing title |
| "Use offer" target | `link` | the UI currently has no link target — add one |

So v1 offer cards show: **real photo · merchant · price · listing title · delivery
(when known) · link out.** Keep the fitment disclaimer exactly as the mock has it.

### 10.3 Everything else maps cleanly

- **VIN** (`GET /api/vin`): UI's `state.vehicle` = `{year, make, model, mileage, vin,
  customerName, customerPhone}`. `VinDecodeResult` fills make/model/year/engine;
  mileage + customer fields are manual. **Keep the `partial` handling** — the
  mock's hardcoded Volvo scan hides that many AU imports return no model.
- **Dictate**: replace the toast stub with the real record→`POST /api/transcribe`
  →insert-text flow (reference: `components/ui/voice-input.tsx`).
- **Make/Model dropdowns**: back them with `getAllMakes()` / `getModelsForMake()` /
  `addCustomMake()` / `addCustomModel()` instead of hardcoded values.

### 10.4 Sequencing

The Polestar-inspired UI is now served by this Next.js application at `/dashboard`
and calls only the `/api/*` routes. Activate the Supabase migrations, configure
production environment variables, then deploy using `docs/PRODUCTION_SETUP.md`.
