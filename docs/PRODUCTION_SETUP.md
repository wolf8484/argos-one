# Argos One production and field-test setup

The application is a Next.js Progressive Web App (PWA). For workshop testing on
another Wi-Fi or mobile network, deploy it to an HTTPS host; do not use a local
`192.168.x.x` address. Local addresses only work while the tablet and development
computer are on the same LAN and while the development server is running.

## 1. Supabase production schema

The production schema is in `supabase/migrations/0001_phase1_catalog.sql` through
`0003_workshop_core.sql`. It creates the catalog, workshop accounts, customers,
vehicles, jobs, repair records, repair steps, parts/consumables, photos, web
research, private Storage, indexes, matching RPC, and Row-Level Security.

The schema is active in the Sydney (`ap-southeast-2`) project. To relink a local
checkout or push a future migration:

```bash
supabase login
supabase link --project-ref dzlfbcjaoxwecqitrvup
supabase db push
```

Alternatively, paste the three migration files into the Supabase SQL editor in
numeric order. Do not expose the service-role key; the application uses user
sessions and RLS.

Supabase Authentication is configured for `https://argos-one-mu.vercel.app` and
local development redirects. Create the first workshop owner through `/login`.

## 2. Configure and deploy Vercel

Connect the repository to Vercel or run `vercel link`. Add all variables from
`.env.example` for Production and Preview. `GROQ_API_KEY` and `SERPER_API_KEY`
must remain server-side. Set `REQUIRE_AUTH=true` in Production.

Deploy:

```bash
vercel --prod
```

Production is deployed at `https://argos-one-mu.vercel.app/dashboard` and works
from any network.

## 3. Install on the Android tablet

Open the production HTTPS URL in Chrome, sign in, then use **⋮ → Add to Home
screen / Install app**. Camera, microphone, service worker and installability all
require HTTPS outside localhost. Accept camera and microphone permissions when
prompted.

## 4. Field-test checklist

- Create/sign in as a workshop owner.
- Add a customer and vehicle; decode a known 17-character VIN.
- Dictate and AI-enhance both intake fields.
- Capture several arrival photos, reload, and verify they return.
- Complete one repair with steps, parts, prices and verification notes.
- Start a second related job and confirm the first repair appears as a match.
- Test price search, offer images/links and the fitment warning.
- Test sign-out and confirm another account cannot read the workshop data.
- Test the installed PWA after changing Wi-Fi networks.

## Known external-data boundaries

- NHTSA VIN data can be partial for Australian, European and JDM vehicles; manual
  make/model entry remains available.
- The camera attempts barcode-based VIN capture where the browser supports the
  Barcode Detection API. It is not full OCR of arbitrary printed text.
- Serper returns current web listings, not guaranteed fitment, inventory or
  distance. Mechanics must verify the VIN and supplier catalogue before ordering.
- Web repair research is reference material, not a replacement for official
  service information or the technician's diagnosis.
