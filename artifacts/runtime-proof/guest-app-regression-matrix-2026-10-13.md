# Guest App QA & Regression Matrix — Owner Review Oct 13 2026

**Branch:** `repair/guest-app-regression`  
**HEAD (post-batch):** see git log after commit (parent chain: `6b2a346` → `d012338` → QA batch)  
**Protected baseline:** `6b2a346` — **preserved** (ancestor; not rewritten)  
**Production:** https://bandits-two.vercel.app — **NOT deployed** this cycle  
**Date:** 2026-10-13  

## Status legend
| Tag | Meaning |
|-----|---------|
| **ALREADY FIXED — VERIFIED** | Code present + automated/web evidence this session |
| **CODE FIXED — RUNTIME NOT VERIFIED** | Repair present; web/device not fully proven |
| **OPEN BUG** | Still broken / incomplete in Guest App |
| **WORKSPACE DEPENDENCY** | Requires Workspace APIs / Stripe / entitlements |
| **BLOCKED** | Cannot finish without external blocker |

Physical iPhone / Android = **NOT VERIFIED** unless explicitly marked on-device.

---

## QA-01 … QA-19

| ID | Requirement | Classification | Root cause / notes | Fix / evidence | Web | iPhone | Android |
|----|-------------|----------------|--------------------|----------------|-----|--------|---------|
| **QA-01** | Neo Premium CTA + Octopus badge only when authorized; carousel valid photos, count matches, no black slides | **CODE FIXED — RUNTIME NOT VERIFIED** | Premium gated via Workspace `fetchBanditPremiumVisibility`; carousel could keep failed URIs | `BanditHeader` + `premium-visibility.ts`; this batch: drop failed gallery URIs, no empty null slides | Partial | NOT VERIFIED | NOT VERIFIED |
| **QA-02** | Explore map card clipped by bottom nav (Tragos) | **CODE FIXED — RUNTIME NOT VERIFIED** | `listBottomPad` too small | `explore.tsx` map `listBottomPad={Math.max(insets.bottom,8)+72}` (+ list pad 72+) | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-03** | bandiTEAM stuck header; More = See Reports + Upload Report; rail order Local banDits→Experiences→SmartTraveler→bandiTEAM→banDiShop; Bottle under More; dismissible HOTEL checkout invite | **CODE FIXED — RUNTIME NOT VERIFIED** | Wrong rail order (shop before team); duplicate More report entries; missing checkout invite | This batch: `upperTab` order; menu safety = See/Upload only; hub labels; `HotelCheckoutInvite` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-04** | Between Trips: Home escape; contrast; Bottle + Connect My New Stay | **CODE FIXED — RUNTIME NOT VERIFIED** | Dark shell trap | Light shell + `← Home` → `/bandits` in `hotelier/index`; AfterTrip sections + Bottle CTA | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-05** | Persistent traveler; rename Connect My New Stay; hotel unlock only verified stay | **CODE FIXED — RUNTIME NOT VERIFIED** | Copy still “Activate Stay” | Renamed menu / AfterTrip / `reactivateStay`; copy states proximity ≠ unlock | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-06** | My Moments: mystery first; consent before 2-way chat | **OPEN BUG** | `myMoment` is personal status; no mystery-first / consent-before-chat gate found | Needs dedicated Moments discovery + consent UX (not Maya shell) | FAIL | NOT VERIFIED | NOT VERIFIED |
| **QA-07** | Local Friend = traveler social; ≤3 recipients; matching/consent; bottle; Chat persists past checkout | **CODE FIXED — RUNTIME NOT VERIFIED** | Social bottle + echo paths exist; explicit “pick 3” UI not present — matching is ocean/vibe | `localFriend.tsx` + `services/localFriend.ts` + guest echo; bottle video wired | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-08** | Bottle QR → Chat (not only Notifications); survives refresh/login/checkout | **CODE FIXED — RUNTIME NOT VERIFIED** | Thread mapping guest echo / ocean | `chatThreads.ts`, `chat.tsx`, ocean refs | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-09** | Bottle throw video after Local Friend + bandiTEAM report; `.mov` + `play-intro.mp4`; no static; no double-submit | **ALREADY FIXED — VERIFIED** (assets + code paths) | Web previously static | Native `local-friend-bottle.mov`; web `/videos/play-intro.mp4` present; wired in `localFriend` + `bandiTeam/report`; send starts once then video | Asset PASS | NOT VERIFIED | NOT VERIFIED |
| **QA-10** | SmartTraveler: remove internal FULL_STAY guest-visible paragraph | **ALREADY FIXED — VERIFIED** (code scan) | Guest UI had no FULL_STAY string in `smarttraveler.tsx` | FULL_STAY remains lifecycle-only (`guest-lifecycle/*`) | PASS (static) | NOT VERIFIED | NOT VERIFIED |
| **QA-11** | Venue heroes card === detail (Spook, Ergon, Kick + guides); no unapproved migrate | **ALREADY FIXED — VERIFIED** (automated) | Gallery order / merges | `eventVenueGallery.ts`; unit PASS; live DB unique heroes PASS; `approved_hero_*` MISSING in prod — **not migrated** | PASS scripts | NOT VERIFIED | NOT VERIFIED |
| **QA-12** | Carousels: no black/empty; arrows/swipe; count correct | **CODE FIXED — RUNTIME NOT VERIFIED** | Failed URI slides | Same `BanditHeader` gallery filter this batch | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-13** | Local banDits first load + Explore first tap; no freeze | **CODE FIXED — RUNTIME NOT VERIFIED** | Cold cache / unguarded nav | `banditsHomeCache` disk warm; `runSafeNavigation` on Explore | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-14** | Ask Me + Local Friend real delivery + chat creation; no fake success | **CODE FIXED — RUNTIME NOT VERIFIED** | Stale JWT / silent fail | `resolveTravelerSession` on send + echo APIs | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-15** | Badges: Notifications / Alerts / Chat distinct unread | **CODE FIXED — RUNTIME NOT VERIFIED** | Chat vs inbox split exists; Alerts is public feed (no personal unread badge on bottom nav) | `unreadCount` (inbox bell) ≠ `chatUnreadCount` (Chat tab); Alerts ≠ Notifications by route | Partial | NOT VERIFIED | NOT VERIFIED |
| **QA-16** | Select/Delete Notifications + Chat | **CODE FIXED — RUNTIME NOT VERIFIED** | Restored on baseline + RC | `notifications.tsx`, `community.tsx` / `chat.tsx` select modes | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-17** | Premium commercial UX: Your Local Insider; Octopus Concierge real page; payments Workspace | **CODE FIXED — RUNTIME NOT VERIFIED** + **WORKSPACE DEPENDENCY** | Dead-end risk; Stripe on Workspace | `/premium/[id]` real page; title “Your Local Insider”; payments → Workspace | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-18** | Stay-specific vs persistent experiences | **CODE FIXED — RUNTIME NOT VERIFIED** | Lifecycle access levels | `guest-lifecycle/access.ts` FULL_STAY vs AFTER_TRIP caps | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-19** | GUEST-INT-1.0 missing UI bindings only | **OPEN BUG** + **WORKSPACE DEPENDENCY** | Transfer docs `phase-16/GUEST_INT_1_0_*` **not found** in bandits/siblings; reflection **API wrappers** exist (`lib/workspace/actions.ts`) | No Maya/OwnerQA shell; UI for Journey/Composer/collections/hotel requests not fully bound | BLOCKED (docs) | NOT VERIFIED | NOT VERIFIED |

---

## Builds (EAS preview)

| Platform | Build ID | Status | Install / artifact |
|----------|----------|--------|---------------------|
| **iOS** | `406acd3c-f8d8-49cc-8c64-10113fa89f49` | **FINISHED** @ `d012338` | Page: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/406acd3c-f8d8-49cc-8c64-10113fa89f49 · IPA: https://expo.dev/artifacts/eas/KFvK1akBdiAuQs4QQpr71NEP2NQ6xdE7YqkbUY08zuU.ipa |
| **Android** | `b515d503-a07c-42bb-bfdd-6cc049a80283` | **ERRORED** (Gradle / `EAS_BUILD_UNKNOWN_GRADLE_ERROR`) @ `d012338` | **No APK** — rebuild required after QA batch commit |

Note: iOS IPA is from **pre-batch** SHA `d012338`. New QA-03/05/01 fixes need a fresh preview build for device install of this batch.

---

## DB / migration (non-destructive)

| Item | Status |
|------|--------|
| Prod Supabase | `zubcakeamyfqatdmleqx.supabase.co` |
| `approved_hero_url` / `approved_gallery` / `hero_approved_at` | **MISSING_IN_PRODUCTION** — do **not** apply 066 unapproved |
| Hero path used | `image_gallery[0]` / `image_url` via `eventVenueGallery` |

---

## Workspace-owned blockers (separate)

| Blocker | Owner |
|---------|-------|
| Stripe checkout / entitlement sync | `banditour-workspace` |
| `/api/bandit/premium` visibility truth | Workspace |
| `/api/guest/reflection` live Journey/Composer data | Workspace |
| Commerce operational flags | Workspace |

---

## Automated evidence this session

| Check | Result |
|-------|--------|
| `verify-card-matches-spot-hero.mjs` | **PASS** |
| `rc-live-venue-hero-check.mjs` (Spook/Ergon/Kick) | **PASS** unique heroes |
| Bottle assets `.mov` + `play-intro.mp4` | **FOUND** |
| Expo web export (earlier) | **PASS** → `dist-rc-web` |
| `expo lint` | FAIL (missing eslint module — env) |
| Playwright explore/authentic scripts | Need live Metro on expected ports |
| Physical device | **NOT VERIFIED** |

---

## GO / NO-GO

**NO-GO for production.**

Gate remaining:
1. Fresh iOS + Android preview builds including this QA batch SHA  
2. Physical-device PASS for messaging, heroes, Between Trips, badges, select/delete  
3. QA-06 Moments consent UX  
4. QA-19 transfer-package UI bindings once docs located  
5. Workspace premium/payment probe if commercial path in RC  

**Do not deploy to production until gate satisfied.**
