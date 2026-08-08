# Argos One — Supabase Backend Plan

Status: **proposal, nothing built yet.** As of 2026-08-08 the app uses hardcoded
seed data (`lib/vehicle-data.ts`), in-memory mock data (`lib/mock-data.ts`), and
per-device `localStorage` for custom makes/models. There is no Supabase project,
client, `.env`, or table.

This document is the design to review before we build.

---

## 1. Guiding decisions

- **Australia-first.** Multi-tenant from the start (each shop's jobs are private),
  but the **makes/models catalog is shared globally** — a model one shop adds
  helps everyone, which is the whole point of "recorded for future usage."
- **The knowledge base is outcome-driven.** We don't store a solution's success
  rate as a fixed number. We record each *repair outcome* (did this fix work?),
  and compute success-rate / occurrences / avg-time from those rows. That's what
  makes rankings improve as more repairs are logged.
- **Case-insensitive uniqueness** on make/model names, enforced in the database —
  so `sq5` and `SQ5` can never both exist (matches the current UI behaviour).
- **Customer data is private and role-gated.** Owner + mechanics share one app,
  but only the owner (and admins they authorise) can see customer details.
  Client PII is never shared globally and is subject to the Australian Privacy
  Act / APPs. See §3.5 (roles & seats) and §7 (customers).

---

## 2. Schema

```mermaid
erDiagram
  shops ||--o{ profiles : has
  shops ||--o{ vehicles : owns
  shops ||--o{ jobs : owns
  makes ||--o{ models : has
  makes ||--o{ vehicles : "make_id"
  models ||--o{ vehicles : "model_id"
  vehicles ||--o{ jobs : "vehicle_id"
  jobs ||--o{ repairs : "job_id"
  solutions ||--o{ repairs : "solution_id"
  jobs }o--|| repairs : "confirmed_repair_id"
```

### Catalog (shared, global)

```sql
-- Case-insensitive-unique makes
create table makes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_custom  boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index makes_name_lower_idx on makes (lower(name));

create table models (
  id         uuid primary key default gen_random_uuid(),
  make_id    uuid not null references makes(id) on delete cascade,
  name       text not null,
  is_custom  boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index models_make_name_lower_idx on models (make_id, lower(name));
```

### Tenancy (shops + users)

```sql
create table shops (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  plan             text not null default 'standard',  -- billing tier
  admin_seat_limit int  not null default 2,           -- included admin seats
  created_at       timestamptz not null default now()
);

create type shop_role as enum ('owner', 'admin', 'mechanic');

-- One row per authenticated user, linking them to a shop.
-- 'owner' and 'admin' are the "admin seats" that can see customer data;
-- 'mechanic' cannot. See §3.5 for roles & seats.
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  shop_id    uuid references shops(id),
  full_name  text,
  role       shop_role not null default 'mechanic',
  created_at timestamptz not null default now()
);
```

### Vehicles & jobs (per-shop)

```sql
create table vehicles (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  vin        text,
  year       int,
  make_id    uuid references makes(id),
  model_id   uuid references models(id),
  mileage    int,
  engine     text,
  trim       text,
  body_style text,
  created_at timestamptz not null default now()
);

create type job_status as enum ('open', 'resolved');

create table jobs (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references shops(id) on delete cascade,
  vehicle_id          uuid not null references vehicles(id) on delete cascade,
  status              job_status not null default 'open',
  symptoms            text,
  customer_complaint  text,
  dtc_codes           text[] not null default '{}',
  confirmed_repair_id uuid,          -- set when a repair is confirmed as the fix
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
```

### Knowledge base (solutions + outcomes)

```sql
create type solution_category as enum
  ('electrical','mechanical','emissions','fuel','cooling','transmission','brakes','other');

-- A candidate fix for a symptom/code. Optionally scoped to a make/model.
create table solutions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  category   solution_category not null default 'other',
  dtc_code   text,                       -- the code this addresses (nullable)
  make_id    uuid references makes(id),  -- null = applies to any make
  model_id   uuid references models(id), -- null = applies to any model
  parts      text[] not null default '{}',
  notes      text,
  created_at timestamptz not null default now()
);

-- The learning loop: one row each time a solution is tried on a job.
create table repairs (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  solution_id       uuid not null references solutions(id),
  worked            boolean not null,
  repair_time_hours numeric(4,1),
  notes             text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);
```

### Ranking view (computed, not stored)

```sql
create view solution_stats as
select
  s.id as solution_id,
  count(r.*)                                   as occurrences,
  coalesce(avg((r.worked)::int) * 100, 0)      as success_rate,
  round(avg(r.repair_time_hours), 1)           as avg_repair_time_hours
from solutions s
left join repairs r on r.solution_id = s.id
group by s.id;
```

> To rank "what worked on *this* vehicle," query `repairs` joined to `jobs`/
> `vehicles` filtered by make/model/year — same aggregation, narrower slice.

---

## 3. Row-Level Security (RLS)

Enable RLS on every table. Two patterns:

**Shared catalog** (`makes`, `models`, `solutions`) — any signed-in user reads;
any signed-in user inserts (that's the crowd-sourced catalog):

```sql
alter table makes enable row level security;
create policy "read makes"   on makes for select to authenticated using (true);
create policy "insert makes" on makes for insert to authenticated with check (true);
-- same for models, solutions
```

**Per-shop data** (`vehicles`, `jobs`, `repairs`) — a user only sees their shop's
rows, via their `profiles.shop_id`:

```sql
alter table jobs enable row level security;
create policy "shop reads its jobs" on jobs for select to authenticated
  using (shop_id = (select shop_id from profiles where id = auth.uid()));
create policy "shop writes its jobs" on jobs for insert to authenticated
  with check (shop_id = (select shop_id from profiles where id = auth.uid()));
-- same pattern for vehicles, repairs (repairs via job -> shop)
```

### 3.5 Roles, seats & billing

One shop, one app — the owner and all mechanics sign in to the same product.
Access to **customer information** is gated by role, so a mechanic can run
diagnostics and log repairs without ever seeing client contact details.

**Roles** (`profiles.role`):

| Role | Diagnostics & repairs | Customer details (§7) | Manage team / seats |
|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | — (view/manage clients only) |
| `mechanic` | ✅ | ❌ hidden | — |

- The **owner** creates the shop and can promote any mechanic to **admin** (an
  "admin seat") to grant them customer-data access — "the owner, or whoever he
  authorises."
- `owner` + `admin` together count as **admin seats**, capped by
  `shops.admin_seat_limit`.

**Billing model.** The subscription includes a base number of admin seats
(default **2** — e.g. owner + 1 admin); additional admin seats are billed extra.
Mechanic seats are not admin seats (billed separately or unlimited, TBD by plan).

- `shops.admin_seat_limit` holds the included allowance.
- Promoting a mechanic to `owner`/`admin` beyond the limit is blocked until the
  extra seat is purchased. **Enforce server-side** (a trigger or an RPC that
  counts current admins vs. limit) — never trust the client for a paywall.

```sql
-- Guard: block promotions past the shop's admin_seat_limit.
create or replace function enforce_admin_seat_limit()
returns trigger language plpgsql as $$
declare
  seat_limit int;
  admin_count int;
begin
  if new.role in ('owner','admin') then
    select admin_seat_limit into seat_limit from shops where id = new.shop_id;
    select count(*) into admin_count
      from profiles
      where shop_id = new.shop_id and role in ('owner','admin') and id <> new.id;
    if admin_count + 1 > seat_limit then
      raise exception 'Admin seat limit (%) reached — purchase an extra seat', seat_limit;
    end if;
  end if;
  return new;
end $$;

create trigger admin_seat_guard
  before insert or update of role on profiles
  for each row execute function enforce_admin_seat_limit();
```

> Actual charging (Stripe, plan tiers, proration) is out of scope for this doc —
> `plan` + `admin_seat_limit` are the hooks the billing system will drive.

---

## 4. App integration — what changes

| Today | After Supabase |
|---|---|
| `getAllMakes()` reads seed + localStorage | `select * from makes order by name` |
| `getModelsForMake(make)` | `select * from models where make_id = …` |
| `addCustomMake` / `addCustomModel` (localStorage) | `insert into makes/models` (shop-wide) |
| `normalizeMake()` | unnecessary — DB is the canonical source |
| `mockJobs` / `mockSolutions` (in-memory) | `jobs`, `solutions`, `repairs` tables |
| `getSolutionsForCodes()` | query `solutions` + `solution_stats`, filtered by code/vehicle |

Client setup:
- `npm i @supabase/supabase-js @supabase/ssr`
- `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server components / route handlers)
- Env vars in `.env.local` **and** Vercel project settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, for seed scripts / admin)

---

## 5. Suggested build order

1. **Phase 1 — Catalog.** Create `makes` + `models`, seed from `lib/vehicle-data.ts`,
   wire the two dropdowns to Supabase. Smallest change; makes the catalog shop-wide.
   *(No auth needed yet — catalog is public-read.)*
2. **Phase 2 — Auth & shops.** Supabase Auth (magic link or email/password),
   `shops` + `profiles`, sign-in screen, RLS on per-shop tables.
3. **Phase 3 — Jobs & knowledge base.** Move jobs/vehicles/solutions/repairs to
   Supabase; replace mock data; the ranking view drives the Results screen and it
   starts genuinely learning from logged repairs.
4. **Phase 4 — Customers & roles.** Add the `customers` table, role-gated access
   (owner/admin vs mechanic), team management, and the admin-seat limit. Triggers
   the privacy-compliance work below. See §7.

---

## 6. What I need from you to start Phase 1

1. Create a Supabase project in your org and send me the **Project URL** and
   **anon public key** (Settings → API). The service_role key stays with you —
   paste it only into env, never into chat.
2. Confirm the **catalog is global** (shared across all shops) — or say if you'd
   rather each shop keep its own private catalog.
3. Confirm **Phase 1 first** (catalog only) vs. going wider.

---

## 7. Phase 4 — Customers & client privacy

Client details are **personal information** under the Australian Privacy Act 1988
and the Australian Privacy Principles (APPs). They are stored **private per-shop**,
gated to `owner`/`admin` roles, and **never** enter the shared/global layer.

### Schema

```sql
create table customers (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  full_name  text not null,
  phone      text,
  email      text,
  address    text,
  notes      text,
  created_at timestamptz not null default now()
);

-- Link a customer to the cars they own (vehicles already exist from Phase 3).
alter table vehicles add column customer_id uuid references customers(id);
```

This unlocks per-customer service history: a car's past jobs, "this vehicle was
here 8 months ago for the same code," and follow-up reminders.

### Access control (role-gated RLS)

`customers` is readable/writable only by the **owner/admin** of the owning shop —
mechanics in the same shop cannot see it:

```sql
alter table customers enable row level security;

create policy "admins read shop customers" on customers for select to authenticated
  using (
    shop_id = (select shop_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "admins write shop customers" on customers for all to authenticated
  using (
    shop_id = (select shop_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('owner','admin')
  )
  with check (
    shop_id = (select shop_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('owner','admin')
  );
```

> Mechanics still work jobs on a vehicle; they just don't get the owner's
> name/phone/email. The UI hides customer fields when the signed-in user's role
> is `mechanic` — but RLS is the real guard (UI hiding alone is not security).

### Privacy-compliance checklist (before go-live with real customer data)

- [ ] Privacy policy covering what's collected, why, and how it's stored/shared.
- [ ] Consent capture for storing customer contact details.
- [ ] Data-access limited by role (the RLS above) + audit of who can export.
- [ ] Deletion / "right to be forgotten" path for a customer record.
- [ ] Confirm the anonymised repair-intelligence layer carries **no** customer
      identifiers, VINs, or shop identity before any cross-shop sharing.
