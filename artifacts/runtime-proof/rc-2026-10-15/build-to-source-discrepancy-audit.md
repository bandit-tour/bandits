# BUILD-TO-SOURCE DISCREPANCY AUDIT — 15 Oct 2026

**Branch:** `repair/guest-app-regression`  
**Tip HEAD:** `8ae188b` (docs) · last product fix `cfdd68d` · EAS recovery git `02e9fe1`  
**Owner-cited fail RC:** `dcd786a`  
**Protected baseline:** `6b2a346` (ancestor OK — not product target)  
**Physical device:** **NOT VERIFIED** in this environment  
**Production deploy:** **NOT DONE** · **NO-GO**

---

## Master finding — why “fixed in code” is invisible on device

| Factor | Evidence |
|--------|----------|
| **1. Stale install SHA** | Owner’s Oct 15 emergency brief cites **`dcd786a`**. That commit is **before** `fee6130`, `278be08`, `52e878a`, `cfdd68d`. Installs from `dcd786a` / Android APK labeled with that SHA **cannot** show later repairs. |
| **2. Gate1 / recovery pairs unused** | iOS/Android @ `52e878a` and later @ `02e9fe1` were published; matrix already marked physical **NOT VERIFIED** with no proof the owner deleted the old app and installed those pages. |
| **3. Gaps still real at tip** | Several approved behaviors are **still wrong or incomplete in HEAD source** (see items 1–2, 4–5, photo overlay). Code inspection PASS ≠ device PASS. |
| **4. Dual `/profile` routes** | `app/profile.tsx` (photo upload) **and** `app/(tabs)/profile.tsx` (journal shell) both claim `/profile` → native stack eject / wrong screen. |
| **5. EAS env** | Preview builds still do not embed Workspace commerce URLs → guest-facing “Commerce origin unset…” when checkout is attempted. |

**Rule:** Do not claim PASS from compilation or from commits the installed binary does not contain.

---

## Item 1 — Home repeats Neo (hero + carousel + recommendations)

| Field | Finding |
|-------|---------|
| **Approved** | One primary Home appearance for a featured banDit; diverse banDits elsewhere; personal routes/guides live on that banDit’s profile. |
| **Source** | `components/TripHomeScreen.tsx`: (a) `featured = bandits[0]` full-bleed hero + Meet CTA; (b) `ExploreBanditLane` carousel; (c) “What’s next” rows `${first}'s City Guide` + `${first}'s routes`. |
| **In `dcd786a`?** | **YES** — same TripHome pattern already present (repair RC). Not introduced only after dcd786a. |
| **Runtime path** | Home tab → `TripHomeScreen` → featured[0] often Neo if Neo sorts first from `getBanditsWithTags`. |
| **Backend** | Bandit list order / tags — not a photo bug. |
| **Why screenshot contradicts “fix”** | No commit ever consolidated the three surfaces; prior “Home escape” work did not touch this composition. |
| **Proposed correction** | Keep **one** of: hero **or** lane lead; move City Guide / routes CTAs off Home into profile only; ensure lane shows diverse IDs. Acceptance: screenshot with Neo ≤1 primary Home slot + other banDits visible. |
| **Device status** | **Physical FAIL** (owner) · Code still reproduces · **NOT VERIFIED** after future fix |

---

## Item 2 — City Guide / map overlay ON profile photo

| Field | Finding |
|-------|---------|
| **Approved** | Interactive map/City Guide control as a **corner overlay on the banDit photograph**, not a separate card below. |
| **Source @ tip** | `components/BanditHeader.tsx` Stage2 C1: `mapBesideGallery` — map is a **sibling column LEFT of the gallery**, not an overlay on the image. Separate journey-chapter `City Guide` `Pressable` still exists below identity. |
| **In `dcd786a`?** | **NO** `mapBesideGallery`. Older `mapWithGuide` pattern only. So dcd786a installs cannot show Stage2 layout; tip still ≠ approved overlay. |
| **Runtime path** | `/bandit/[id]` → `BanditHeader` detail → `heroMediaRow`. |
| **Backend** | None for placement. |
| **Why contradicts prior claim** | Claimed “map left of photo” ≠ owner’s “overlay on photograph corner”. Partial layout shipped; acceptance criteria misread. |
| **Proposed correction** | Absolute-position map/+City Guide control on the gallery image (e.g. bottom-left), remove detached below-Routes map/card. Acceptance: device screenshot overlay on portrait. |
| **Device status** | **Physical FAIL** · Code mismatch remains at tip |

---

## Item 3 — Octopus Verified beyond Neo

| Field | Finding |
|-------|---------|
| **Approved** | ~10 real eligible candidates; badge only for Workspace-authorized Octopus Verified; no unearned badges. |
| **Source** | `lib/guest-app/premium-visibility.ts` + `fetchBanditPremiumVisibility`; badge UI in `BanditHeader` / TripHome when visibility says verified. |
| **In `dcd786a`?** | Partial visibility plumbing; no completed 10-candidate audit commit. |
| **Runtime** | Client calls Workspace/premium visibility; if API returns only Neo, UI shows only Neo. |
| **Backend** | **Workspace Prisma authorization** — Guest App must not invent badges. |
| **Why contradicts claim** | Stage2 C3 left **OPEN / WORKSPACE**; never completed candidate list + auth proof. |
| **Proposed correction** | Reproducible sampling script + Workspace verify list; Guest only renders badge when API says authorized. |
| **Device status** | **BLOCKED** on Workspace · Physical FAIL for “only Neo” |

---

## Item 4 — Concise €19 / Your Local Insider page

| Field | Finding |
|-------|---------|
| **Approved** | Headline, price, ≤3 benefits, one CTA, brief terms, optional details; no env-var errors; checkout gated until auth passes. |
| **Source** | `app/premium/[id].tsx`: `BENEFIT_CARDS` has **8** cards + `BOOK_ACTIONS` (10); comment still says **€29**; title “Your Local Insider” exists. `lib/octopus-concierge/entitlement.ts` surfaces **“Commerce origin unset — set EXPO_PUBLIC_ORCHESTRA_OS_URL…”** to guests. |
| **In `dcd786a`?** | **YES** long page + Your Local Insider title already. Concise layout **not** shipped. |
| **Runtime** | `/premium/[id]` sales branch when entitlement inactive. |
| **Backend** | EAS must set `EXPO_PUBLIC_WORKSPACE_URL` + `EXPO_PUBLIC_ORCHESTRA_OS_URL` = `https://banditour-workspace.vercel.app`; Stripe TEST / Octopus auth = Workspace. |
| **Why contradicts claim** | Naming rename ≠ layout rewrite; env error strings never guest-proofed; EAS preview env incomplete. |
| **Proposed correction** | Collapse to 3 benefits + one CTA; gate/disable purchase; replace env strings with human copy; sync EAS env. |
| **Device status** | **Physical FAIL** · LIVE payments **NO-GO** |

---

## Item 5 — Venue heroes (Neo Athens, Vibe Route, Brunchers, Fixers, etc.)

| Field | Finding |
|-------|---------|
| **Approved** | Visible approved photos on cards + detail; same primary per venue ID; no blank/grey. |
| **Source** | `lib/eventVenueGallery.ts`, `resolveApprovedListHeroUrisByEventId`, spot detail gallery. Unit scripts may PASS with matching URLs. |
| **In `dcd786a`?** | Gallery-first resolver largely present; **physical blanks still reported**. |
| **Runtime** | Native `ExpoImage` + Places/storage URLs; expired Google Places tokens, empty `image_gallery`, RLS, cache. |
| **Backend** | Supabase `event` rows + Places keys; `approved_hero_*` columns **MISSING in production** (prior audit). |
| **Why contradicts “hero match PASS”** | Matching two **empty/broken** URLs ≠ visible photo. Automated card=detail does not prove media loads on device. |
| **Proposed correction** | Per-venue load probe (HTTP 200 + non-zero bytes); manual approval queue for failures; no inventing stock. |
| **Device status** | **Physical FAIL** · Automated PASS insufficient |

---

## Item 6 — QR bottle message missing from Chat

| Field | Finding |
|-------|---------|
| **Approved** | Scan → reveal → Chat thread or consent request (not Notifications-only). |
| **Source** | Bottle onboarding / Mode A AsyncStorage threads vs Mode B durable; `lib/chatThreads.ts`, guest-echo APIs. Onboarding audit: Mode A often **local-only**. |
| **In `dcd786a`?** | Same architectural split. |
| **Runtime** | Intro may write notification/local history without creating inbox thread for ordinary guest. |
| **Backend** | Messaging / notifications tables + traveler session JWT. |
| **Why contradicts claim** | Prior “CODE FIXED” for QR→Chat was incomplete for opening-intro path; Notifications ≠ Chat. |
| **Proposed correction** | Durable thread create on eligible bottle reveal; inbox query includes it; consent rules preserved. |
| **Device status** | **Physical FAIL** · two-account proof still required |

---

## Item 7 — P0 navigation (More eject, Explore freeze, stale bandiTEAM header)

| Field | Finding |
|-------|---------|
| **Approved** | More never ejects; Explore never freezes; headers match current screen. |
| **Source** | More harden `fee6130`/`cfdd68d`; Explore InteractionManager removal `cfdd68d`; upper tab title state in `lib/upperTab.ts` + headers — **stale bandiTEAM** still a known residual if header title not cleared on leave. |
| **In `dcd786a`?** | **NO** fee6130/cfdd68d mitigations. |
| **Runtime** | If owner binary = dcd786a → old More crash vectors + Explore defer. If tip binary → profile dual-route eject still possible. |
| **Why contradicts claim** | Wrong SHA installed **and/or** residual dual `/profile` + header state not cleared. |
| **Proposed correction** | Force owner onto `02e9fe1` pair; fix `/profile` conflict (below); clear upper-tab title on route blur. |
| **Device status** | **Physical FAIL** on owner’s tested build · tip mitigations **NOT VERIFIED** |

---

## P0-1 — Hotel tab action inventory

Guest Hotel tab = `app/(tabs)/hotelier/*` (guest stay companion — **not** Hotelier OS staff dashboard).

| Label / surface | Expected | Actual route | Auth / stay | Likely device result | Cause |
|-----------------|----------|--------------|-------------|----------------------|-------|
| Hotel tab root | Stay home | `/hotelier` | Soft stay context | Opens | OK structure |
| Today chips (Breakfast, Rooftop, …) | Module detail | `/hotelier/{module}` | Content mostly **demo** `hotelierDashboard.ts` | Opens module UI | Stub CTAs (`setClaimed` / local done) — not live PMS |
| Quick actions (Breakfast, Restaurant, Spa, Room Service, Late Checkout, Events, …) | Same | `/hotelier/{id}` | Same | Opens | Same stub content + Unsplash demos |
| Stay facts (room, wifi, …) | Info / module | module optional | PLAY sandbox seeds room 402 | Misleading PRE_TRIP | Demo `GUEST_STAY` constants |
| Offers / campaigns / events carousels | Book / request | `/hotelier/{module}` or item | Demo images Unsplash | Looks live, isn’t | Demo catalog |
| Between Trips entry (post-checkout) | Retention | AfterTrip / soft banner | Lifecycle | Was trapping Home on old RC | Mitigated `cfdd68d` soft banner — **NOT VERIFIED** |
| Menu → Current Hotel / Room / Breakfast / … | Guest services | `/hotelier/welcome` etc. | Same | Same stubs | Duplicate entry points |
| Operator / Admin (if shown) | Staff | `/operatorDesk`, `/admin` | Role gated | Must not appear for ordinary guests | Check role gates |

**Root cause (Hotel “does nothing”):** Modules navigate, but **primary/secondary CTAs are local state stubs** (`setDone` / `setClaimed`) without Workspace hotel-request APIs for ordinary stays. Pre-trip accounts still see PLAY-flavored demo copy when sandbox slug applies.

**Changed files for future fix (not claiming PASS):** `app/(tabs)/hotelier/[module].tsx`, `item/[itemId].tsx`, `lib/guest-workspace/hotelierDashboard.ts`, stay gating — wire Workspace hotel requests or disable CTAs with “Connect My New Stay” explanation.

**Device:** **Physical FAIL** (owner) · **NOT VERIFIED** after any future wire-up.

---

## P0-2 — More → My Profile eject + missing photo upload

| Field | Finding |
|-------|---------|
| **Approved** | See My Profile stays in Guest App; Add/Change photo; persist across sessions. |
| **Source** | Photo upload lives in **`app/profile.tsx`** (`expo-image-picker` + `/api/avatar-upload`). Journal/identity shell in **`app/(tabs)/profile.tsx`** — **no ImagePicker**. Menu pushes `href: "/profile"`. |
| **In `dcd786a`?** | Dual files already existed; upload on stack profile. |
| **Runtime** | Expo Router collision on `/profile`: leaving tab shell → feels like “eject”; or wrong screen without Change Photo. |
| **Root cause** | **Route ownership conflict** + menu not targeting a unique photo-capable path; tabs profile lacks upload UI. |
| **Proposed / applied correction** | Unique route `/my-profile` for stack identity+photo screen; More “See My Profile” + avatar → `/my-profile`; Back/Home escape to `/menu` / `/home`. Keep tabs journal separate if needed. |
| **Device** | **NOT VERIFIED** until owner installs build containing the route fix |

---

## Prior 19-item QA vs `dcd786a` (owner fail) vs tip

| Area | On `dcd786a` | On tip `cfdd68d`/`02e9fe1` | Physical |
|------|--------------|----------------------------|----------|
| Story→banDit Back/Home | Absent | Present | NOT VERIFIED |
| Intro→`/home` | Absent | Present | NOT VERIFIED |
| More harden / Explore no InteractionManager | Absent | Present | NOT VERIFIED |
| Neo photo strip / map beside | Absent/partial | Partial (not overlay) | FAIL criteria |
| Concise €19 | Absent | Absent | FAIL |
| Venue visible photos | Claimed unit PASS | Still device FAIL risk | FAIL |
| Bottle→Chat | Partial | Partial | FAIL |
| bandiTEAM rail order | Partial (9a80fe8) | In tip | NOT VERIFIED |

---

## Workspace blockers (exact)

1. Set EAS **preview** (+ production when approved):  
   `EXPO_PUBLIC_WORKSPACE_URL=https://banditour-workspace.vercel.app`  
   `EXPO_PUBLIC_ORCHESTRA_OS_URL=https://banditour-workspace.vercel.app`
2. Octopus Verified authorization list (~10) in Prisma + Guest visibility API.
3. Stripe TEST checkout + webhook entitlement — **no LIVE**.
4. Hotel request / stay service APIs if Hotel CTAs should be real.
5. TiB hotel multi-photo inventory; SmartTraveler coupons — still BLOCKED per prior gap report.

---

## Owner install instruction (stop testing `dcd786a`)

1. Delete the installed app.  
2. Log into Expo as **banditeam121275**.  
3. Install recovery pair @ **`02e9fe1`** only:  
   - Android: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/2984ce18-987a-4d5f-a9d0-30140be4dbbf  
   - iOS: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/07278794-6886-49f1-bd90-69d63993c799  
4. Report results with **build URL + platform + SHA**.  
5. After `/my-profile` fix ships, require a **new** SAME-SHA pair before calling Profile PASS.

---

## Acceptance honesty

| Claim type | Status |
|------------|--------|
| Code inspection | Used for this audit only — **not PASS** |
| Compilation / EAS SUCCESS | **≠** product PASS |
| Physical iPhone / Android | **NOT VERIFIED** here · owner FAIL on stale/incomplete behaviors |
| Production | **NO-GO** |
