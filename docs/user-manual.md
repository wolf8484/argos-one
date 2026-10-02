# Argos One — User Manual

A field guide to the live app, written from the actual running code (`public/argos-ui/app.js`, the dashboard shell, and the login/join pages). It covers what's built today, step by step, and calls out who is and isn't allowed to do each thing.

Roles referenced throughout: **Owner**, **Admin** (shown in the app as "Admin"), **Technician**. Role checks live in the app itself — if a button isn't there, the app has already decided you can't use it.

---

## 1. Getting in

### Signing in
Go to the sign-in screen and enter **email or mobile** plus your password — either identifier works, the app resolves which login it belongs to before authenticating. If your access to the workshop has been switched off, sign-in itself is blocked with a message to contact your manager (this is checked straight after your password, not later).

### Creating a workshop (first-time owners)
From the sign-in screen, choose **Create a workshop**. It's a 3-step wizard:
1. Workshop details — name, phone, email (all but name are optional and editable later in Settings).
2. Owner details — your name, email, mobile.
3. Password (typed twice).

Then review and confirm. You're signed in immediately as Owner. If the workshop you just created has a device-registration code available, you're offered the chance to register the device you're on right then — skip this if it's your own phone, not the shop's shared tablet.

### Joining a workshop (invited staff)
If an Owner/Admin gave you an invitation code, go to **Join a workshop** from the sign-in screen:
1. Enter the invite code.
2. Confirm your name, mobile (this becomes your sign-in identifier), and optional email.
3. Set a password.
4. Review and tap **Join workshop** — you're signed in immediately.

### Registering a shared workshop device
A shop tablet or wall terminal can be pinned to one branch permanently, so nobody has to pick a branch each time they sign in on it. From the sign-in screen's **Register this device** option, enter the branch's **Registration ID** (found on that branch's profile under Settings → Workshop & branches). Once registered, the option disappears from that device's sign-in screen — there's currently no way to unpair it yourself.

---

## 2. Home dashboard

The home screen (bottom nav → **Home**) shows:
- **Open jobs** and **Resolved today** counts, plus an average-diagnosis-time stat.
- Four control tiles: **New job**, **Resume job** (only shown if you have an active job; otherwise this tile becomes a second way to start a new one), **All jobs**, and **Repair library** (shows how many car profiles exist).
- **Currently active** — the first 3 open jobs, with a "View all" link into the full Jobs list.

Tapping any job card takes you straight back into that job at whatever stage it's at.

---

## 3. Starting a new job

A job moves through four stages, shown as a journey bar at the top of each screen: **Vehicle → Assessment → Similar repairs → Repair**.

### Stage 1 — Vehicle intake
From Home or the bottom nav, tap **New**. Fill in:
- **VIN** (optional) — scan with the camera icon or type it in; a 17-character VIN triggers an automatic decode that fills in year/make/model/trim/engine/drivetrain/transmission for you (partial decodes are flagged so you can check the fields).
- **Year, Make, Model, Trim, Drivetrain, Engine, Transmission** — all required except where marked optional. These are mandatory specifically because the repair library filters a car's history by them; skip one and that vehicle's repairs become invisible to the trim filter.
- **Registration** (optional), **Current mileage** (required).
- **Customer details** — first/last name required, phone and email optional.

Tap **Save & continue** to move to Assessment, or **Delete job** to abandon a draft.

### Stage 2 — Assessment
Record:
- **Symptoms** (required) — in the customer's own words. A dictation button lets you talk instead of type.
- **Initial observations** (optional) — your own objective notes before research. Has both dictation and **AI enhance** (cleans up/expands the text) buttons.
- **Diagnostic trouble codes** (optional) — add any DTCs read off a scan tool.
- **Arrival photos** (optional) — camera or file upload, max 15 MB each, JPG/PNG/WebP/HEIC/HEIF.

Two ways forward:
- **Show similar repairs** — goes to Stage 3 to look for matching past jobs first.
- **Save & continue** (labelled for direct diagnosis) — skips straight to the Repair stage if you already know the fix.

### Stage 3 — Similar repairs
The app surfaces past repairs — from your own shop's history — that match this vehicle and complaint, ranked by match percentage (a "Best match" badge marks the top one). For the selected match you see the original complaint, observations, DTCs, work performed, verification notes, and the parts/consumables used.

Two actions:
- **Search web repair tips** — runs a web lookup for this symptom/vehicle combination.
- **Save & start repair** — commits to this job and moves to Stage 4.

### Stage 4 — Repair / work performed
Record:
- **System type** (required) — a controlled list (Engine/fuel/air, Ignition, Transmission, Emissions, Cooling/HVAC, Brakes, Suspension/steering, Electrical, Body/interior, Other). This is what groups the repair under the car profile for future techs.
- **Work performed** — free text, with dictation and AI-enhance.
- **Parts & consumables** — add items with part number, brand, quantity, supplier, and price; totals are calculated automatically.
- **Verification notes** — how you confirmed the fix worked.
- **Repair photos** (optional).
- **Extra notes** (optional) — this is explicitly model-level knowledge ("these always fail at the water pump"), not job-specific; it's saved onto the car's profile as a shop note, not onto this one repair record.

**Save job** keeps it open for later; **Complete job** resolves it and files it into the repair library.

### Who can edit a job
Every job on the floor is visible to everyone. But a persisted (already-saved) job can only be edited by:
- The technician it's assigned to, or
- An Owner or Admin (they can edit any job).

A technician viewing a job assigned to someone else gets a locked, read-only version of the workflow — inputs disabled, action buttons (dictate, enhance, add photo/DTC/part) hidden — with a banner showing who it's assigned to and which bay it's in. A draft job that hasn't been saved yet is always editable by whoever is creating it.

---

## 4. Job list & filters

Bottom nav → **Jobs**. Shows every job with:
- A **search box** (matches vehicle or customer).
- Filter chips: **All / Active / Resolved / Deleted**, each showing a live count.
- Each job card shows status, bay, date, vehicle, and a one-line issue summary.

**Deleting a job**: tap the "⋯" menu on any active or resolved job card to delete it — this doesn't erase it, it moves it to the **Deleted** filter.

**Deleted jobs**: open one from the Deleted filter to see the full repair record plus two extra actions — **Restore job** (puts it back as active/resolved) or **Delete forever** (permanent, no undo).

---

## 5. Repair library (car profiles)

Bottom nav → **Library**. This is the shop's accumulated knowledge base, auto-built from completed jobs — profiles aren't created manually.

- Browse by **Brand**, then by **Model + trim** (the library is trim-specific end to end — notes, repair history and network cases all narrow to the exact trim you pick).
- Or **search** across the whole library by make/model, which also searches matching individual repairs and offers a **"Search the web"** fallback if nothing turns up in your shop's own history.

Each car profile has two tabs:
- **Notes & insights**:
  - *Common symptoms & repairs* — grouped by system, from this workshop's own completed jobs.
  - *Extra notes* — free-text shop knowledge written by your team (add/edit from here).
  - *Branch patterns* and *network patterns* — repair patterns shared from your other branches or from the wider anonymised network (see Network sharing, §8).
  - *Known issues* — public manufacturer recalls, and commonly-reported complaint trends, both informational only.
- **Repair history** — every resolved job filed under this car/trim, openable individually.

---

## 6. Staff directory & roles

Settings → **Staff directory**. Available to everyone, but what you can do differs by role:

- **Technician**: read-only. You can see every name, role and status, but there's no edit chevron, no invite button, and tapping a row does nothing.
- **Owner / Admin**: can tap **Invite staff** to create a roster entry — fill in first name, role (Technician or Admin), mobile (required — this becomes their sign-in), and optional email. This produces a one-time invitation code to hand the person directly (there's no email/SMS delivery — you tell them the code yourself, or show them the code screen which also lets you copy it, regenerate it, or revoke it).
- Tapping a joined staff member's row opens their **Staff details** page, where an authorized admin can edit name, contact details, default bay, and role.

**Who can act on whom** (mirrors the database's own rules):
- **Owner** can edit/promote/demote anyone, including other Owners and Admins.
- **Admin** can edit Technicians and other Admins, but **cannot touch an Owner** — no edit button is shown on an Owner's row to an Admin.
- The **last active Owner** can't have their own role changed (no one can accidentally orphan a workshop with no Owner) — the role field is simply not editable in that case.
- **Owner** is never offered as a role option to an Admin creating an invite or editing a role — only an existing Owner can hand out the Owner role. Ownership handover works by: inviting the incoming person as Admin, promoting them to Owner, then the outgoing Owner steps down or is removed.

Only staff with a linked login (i.e., who have actually redeemed their invite) can be assigned jobs or set as a branch's default technician.

---

## 7. Branch / multi-shop management

Settings → **Workshop & branches** (Owner/Admin only — hidden entirely from Technicians, not shown-but-locked).

- A **branch** is a separate site under one business: each keeps its own jobs, bays, staff and repair library — nothing moves between branches automatically, and a job booked at one branch is invisible from another.
- The **head/business row** is where the business name lives (if there's more than one branch); every other branch is listed below it with its person-count.
- **Only an Owner** can tap **Add branch**.
- Tapping a branch you're not standing in opens its (limited) detail page — editable fields depend on your permission — with a **Switch to this branch** button for Owners/Admins with access there. Switching changes only what *this device* shows; your other signed-in devices stay where they are.
- **Deleting a branch** (Owner only, and not available on the head/business branch) is a danger-zone action: it permanently removes that branch's jobs, customers, vehicles and bays.
- One person can hold a role at multiple branches on a single login (manage this from an Owner's staff-detail page, when multi-branch).
- Each branch's **Registration ID** lives on its own profile page — that's the code used to pair a device (see §1).

### Repair sharing (network & branches)
Settings → **Repair sharing**. Two independent switches:
- **Share with other shops** — anonymised repair patterns go out to, and come back from, the wider Argos One network. No customer, staff, or VIN data is ever shared either way.
- **Share across your branches** (only shown if multi-branch) — named repairs shared between your own sites, with the branch that did the work attached. Owner/Admin only; a Technician sees it but can't change it. When this is on, individual target branches can be toggled on/off one by one.

---

## 8. Bay management

Settings → **Bay management** (Owner/Admin only).
- Set a **Default bay** — new jobs start here unless changed.
- **Add bay** / tap an existing bay to edit its name, description, and active/inactive status.

---

## 9. Settings — full map

Settings home is grouped, and groups itself by role:

- **Appearance** — Theme (Dark/Light).
- **Network** — Repair sharing (see §7).
- **Profile & management**:
  - Workshop & branches *(Owner/Admin only)*
  - Bay management *(Owner/Admin only)*
  - Staff directory *(everyone, read-only for Technicians)*
- **Preferences**:
  - Units & measurements — Metric vs Imperial. Only odometer mileage actually changes units today; the rest of the preview (length, temperature, pressure, torque, weight) is a placeholder showing which unit each would use, since those aren't recorded fields yet.
  - Voice & dictation — shows mic permission status and a test-microphone action. Language, auto-punctuation, and review-before-saving are **not built** — dictation always auto-transcribes in one pass.
  - Camera & photos — shows camera permission status. Photo quality tiers and location metadata are **not built** — photos upload at original quality, no location tag.
  - Notifications — **not built** at all (every toggle disabled); the update banner on the Settings home page is the only alert the app currently sends.
  - Data & storage — **not built** — the app always reads live from the server, no offline cache.
  - Privacy — a plain-language summary of what's stored and shared.
- **Support**:
  - Help & feedback — **not built**; the page tells you to contact your Argos One admin directly for now.
  - What's new — a running changelog.

A "You're up to date — Build …" line (with version) shows at the bottom once nothing needs updating; otherwise an update banner appears at the top of the app.

---

## 10. Account & device

- Tap your initials in the top bar to open your profile, which shows a **Sign out** action (or **Sign in for cloud storage** if currently unauthenticated/offline).
- The **branch bar**, just under the header, only appears if your login has access to more than one branch — tap it to switch.
- The **theme toggle** and **clock/date** (which opens the workshop calendar) sit in the top bar alongside your profile button.

---

## Notable things already built that are easy to miss

- **AI enhance** on text fields (observations, work performed, verification notes, extra notes) — not just dictation, it rewrites/cleans the text.
- **VIN camera scanning**, not just manual VIN entry.
- **Automatic car-profile creation** — you never create a profile directly; completing a job's first repair for a make/model/trim creates it.
- **Three-tier repair-pattern sharing**: your own shop's history, your other branches (opt-in, named), and the wider anonymised network (opt-in) — all visible side-by-side on a car profile.
- **Soft delete with full restore** for jobs, plus a separate, deliberate "Delete forever" for true permanent removal.
- **Per-device branch pinning** so a shared workshop tablet never needs anyone to pick a branch.
