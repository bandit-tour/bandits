# Guest App QA & Regression Matrix — Owner Review Oct 13 2026

**Branch:** `repair/guest-app-regression` (history preserved; not reset)  
**Protected baseline / last working native SHA:** `6b2a3466a71951c87a0b52d39beb271bb57c4585`  
**Last working EAS iOS (historical):** `2015cc5c-879a-4d73-b398-f5a6508d9397` @ `6b2a346` (preview/internal, Jul 2026)  
**Broken RCs:** `dcd786a`, `fee6130` — do not use for owner retest  
**Recovery:** fresh iOS preview rebuilt **from exact `6b2a346` tree** (worktree) — see § Recovery build  
**Production:** https://bandits-two.vercel.app — **NOT deployed** · **NO-GO**  
**Modern tip verified:** `278be08` (owner typo `278be88` rejected)  
**Stage1 fix SHA (install):** `52e878af3ea84f6bdb79186109972cb08be9450e`  
**Updated:** 2026-10-15 — Emergency native recovery after owner FAIL on **`dcd786a`** (not Gate1 `52e878a`). Report: `rc-2026-10-15/emergency-native-recovery-report.md`. Stages 3–5 / onboarding **HOLD**. Physical **NOT VERIFIED**

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
| **QA-01** | Neo Premium CTA + Octopus badge only when authorized; carousel valid photos | **CODE FIXED — RUNTIME NOT VERIFIED** | Identity gallery = image+face only (no venue extras); Octopus badge → Your Local Insider; map left of photos | `BanditHeader`, `premium-visibility.ts`, `registeredBanditIds.ts` | Partial | NOT VERIFIED | NOT VERIFIED |
| **S1-A2** | Profile→Travel Stories→Open Local banDit trap | **CODE FIXED — RUNTIME NOT VERIFIED** | Seed used non-UUID `bandit_elena` → Postgres `22P02` → dead-end error UI without Back | `profileMemory` real UUIDs; `resolveRegisteredBanditId`; hide CTA if unresolved; `bandit/[id]` AppEscapeNav+Home on load/error; `getBanditById` rejects non-UUID | CODE PASS (`stage1-attribution-verify.json`) | NOT VERIFIED | NOT VERIFIED |
| **S1-A1** | iOS touch/nav Back/Home/Menu | **CODE FIXED — RUNTIME NOT VERIFIED** | Missing `overflow:hidden` on tabs content; error screens omitted Stack header | `(tabs)/_layout` overflow; escape on bandit/moment error | CODE | NOT VERIFIED | NOT VERIFIED |
| **S1-A3** | Prolonged Local banDits skeleton | **CODE FIXED — RUNTIME NOT VERIFIED** | `loadedOnce` never flips on hang | 8s skeleton timeout → empty/error+retry | CODE | NOT VERIFIED | NOT VERIFIED |
| **S1-F** | Profile demo-as-real (Guest / 842 / 4-night) | **CODE FIXED — RUNTIME NOT VERIFIED** | PROFILE_STAY seed presented as live | Sample banner; real stay from lifecycle; fake score hidden | CODE | NOT VERIFIED | NOT VERIFIED |
| **QA-02** | Explore map card clipped | **CODE FIXED — RUNTIME NOT VERIFIED** | Insufficient bottom pad | `explore.tsx` `+72` map pad | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-03** | bandiTEAM / More / rail / checkout invite | **CODE FIXED — RUNTIME NOT VERIFIED** | Rail order + duplicate reports | `upperTab`, menu, hub, `HotelCheckoutInvite` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-04** | Between Trips Home escape + contrast | **CODE FIXED — RUNTIME NOT VERIFIED** | Dark shell trap | `hotelier/index`, `AfterTripHome` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-05** | Connect My New Stay; verified unlock | **CODE FIXED — RUNTIME NOT VERIFIED** | Activate Stay copy | menu / AfterTrip / `reactivateStay` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-06** | Moments mystery-first + consent before 2-way chat | **CODE FIXED — RUNTIME NOT VERIFIED** | Discovery flow already existed; auto-reveal-on-Reply weakened consent | **Evidence:** `app/bottleDiscover.tsx` (mystery copy + “See who sent this” before Reply); `lib/guest-moment/store.ts` `revealBottleScanSender` / `revealed:false` default in `bottleBridge.ts`; `myMoment.tsx` history shows “Sender hidden” until reveal. **Guard:** Moment mode must reveal first — Reply no longer auto-opens Chat without prior reveal. Chat vs Notifications unchanged. | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-07** | Local Friend social / bottle / Chat | **CODE FIXED — RUNTIME NOT VERIFIED** | Ocean matching | `localFriend.tsx`, `services/localFriend.ts` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-08** | Bottle QR → Chat persistence | **CODE FIXED — RUNTIME NOT VERIFIED** | Echo / ocean mapping | `chatThreads.ts`, `chat.tsx` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-09** | Bottle throw video | **ALREADY FIXED — VERIFIED** | Assets + wiring | `.mov` + `play-intro.mp4` | Asset PASS | NOT VERIFIED | NOT VERIFIED |
| **QA-10** | SmartTraveler no FULL_STAY guest copy | **ALREADY FIXED — VERIFIED** | Code scan clean | `smarttraveler.tsx` | PASS | NOT VERIFIED | NOT VERIFIED |
| **QA-11** | Venue heroes card === detail | **ALREADY FIXED — VERIFIED** | Gallery-first resolver | `eventVenueGallery.ts` scripts PASS | PASS | NOT VERIFIED | NOT VERIFIED |
| **QA-12** | Carousels no black slides | **CODE FIXED — RUNTIME NOT VERIFIED** | Failed URIs | `BanditHeader` filter | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-13** | First-load Local banDits / Explore | **CODE FIXED — RUNTIME NOT VERIFIED** | Cache / nav lock | `banditsHomeCache`, safe nav | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-14** | Ask Me / Local Friend real delivery | **CODE FIXED — RUNTIME NOT VERIFIED** | JWT session | `resolveTravelerSession` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-15** | Distinct badges | **CODE FIXED — RUNTIME NOT VERIFIED** | Inbox ≠ Chat | `unreadCount` vs `chatUnreadCount` | Partial | NOT VERIFIED | NOT VERIFIED |
| **QA-16** | Select/Delete Notifications + Chat | **CODE FIXED — RUNTIME NOT VERIFIED** | Select modes | notifications / community / chat | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-17** | Your Local Insider / Concierge / payments | **CODE FIXED — RUNTIME NOT VERIFIED** + **WORKSPACE DEPENDENCY** | Stripe on Workspace | `/premium/[id]` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-18** | Stay-specific vs persistent | **CODE FIXED — RUNTIME NOT VERIFIED** | Lifecycle caps | `guest-lifecycle/access.ts` | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| **QA-19** | GUEST-INT-1.0 missing UI bindings | **BLOCKED** (docs) + **WORKSPACE DEPENDENCY** | Transfer package not in repo tree | See search paths below. Wrappers only: `lib/workspace/actions.ts` (`postGuestReflection`, hotel_request, collections, traveler services). No Maya/OwnerQA shell added. | BLOCKED | NOT VERIFIED | NOT VERIFIED |

### QA-19 search paths tried (no hits)
- `c:\Users\blonj\Documents\bandits` (incl. recursive `GUEST_INT*`, `TRANSFER_PACKAGE*`, `HANDOFF*`, `phase-16`)
- `c:\Users\blonj\Documents` (only sibling app dirs: bandits, games, museum — **no** `banditour-workspace`)
- `c:\Users\blonj\Documents\banditour-workspace` — **path missing**
- `c:\Users\blonj\Documents\workspace` — **path missing**
- `c:\Users\blonj\Desktop`, `Downloads`, `OneDrive` — no `GUEST_INT_1_0*.md`
- `c:\dev`, `c:\src`, `c:\code` — **missing**
- Targeted names: `phase-16/GUEST_INT_1_0_TRANSFER_PACKAGE.md`, `GUEST_INT_1_0_HANDOFF.md`

---

## Recovery build (priority) — restore working native @ `6b2a346`

**Strategy:** EAS iOS `preview` / `internal` from **exact** git tree `6b2a346` (detached worktree). Repair branch tip **not** reset; screenshot fixes deferred.

| Field | Value |
|-------|--------|
| Working SHA | `6b2a3466a71951c87a0b52d39beb271bb57c4585` |
| Historical working build | `2015cc5c-879a-4d73-b398-f5a6508d9397` (Jul 2026) |
| Fresh recovery build | _(filled when EAS returns)_ |
| Install page (CLI) | _(filled when EAS returns)_ |
| Login | `banditeam121275` / `banditourex@gmail.com` |
| Physical | **NOT VERIFIED** |
| Production | **NO-GO** |

Full write-up: `artifacts/runtime-proof/rc-2026-10-14/native-recovery-6b2a346.md`

### Owner retest (recovery)

1. Intro opens (approved opening) + Enter/Skip works  
2. Guest App tabs/buttons responsive  
3. Navigate Home / Explore / More without freeze  

Screenshot/QA product fixes: **ON HOLD** until physical PASS.

---

## Superseded broken RCs (do not retest)

| SHA | iOS build | Note |
|-----|-----------|------|
| `fee6130` | `46050ddd-…` | Speculative P0 on broken shell |
| `dcd786a` / `b2c4fb2` | `4806b4c1-…` | Post-`d012338` regression window |

---

## DB / migration (non-destructive)

| Item | Status |
|------|--------|
| Prod Supabase | `zubcakeamyfqatdmleqx.supabase.co` |
| `approved_hero_*` columns | **MISSING_IN_PRODUCTION** — not migrated |
| Hero path | `image_gallery[0]` / `image_url` |

---

## Workspace-owned blockers

| Blocker | Owner |
|---------|-------|
| Stripe / entitlements | `banditour-workspace` |
| `/api/bandit/premium` | Workspace |
| `/api/guest/reflection` Journey/Composer payloads | Workspace |
| Transfer docs location | Workspace package (not in Documents siblings) |

---

## GO / NO-GO

**NO-GO for production** · **NO-GO LIVE Stripe** · **GO Gate 1 owner install/retest**.

### Gate 1 SAME-SHA builds @ `52e878a` — FINISHED

| Platform | Detail page | Artifact |
|----------|-------------|----------|
| iOS | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/5a1ad004-7a64-4e8d-b0c0-9eb39c8d8150 | https://expo.dev/artifacts/eas/-ymv9nd-2-vab5AywTDgy8MbzKSSbQzFajgplsiOPpg.ipa |
| Android | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/8b5f2fd3-74dc-4ff2-96e7-ac8c7e3b8093 | https://expo.dev/artifacts/eas/lAHzgMwfFAbVZTzTeYqipcUrIN26ndgDHeXGtzBMgV4.apk |

Login: `banditeam121275`. Build FINISHED ≠ physical PASS.

**Owner retest A–E:** Story↔banDit Back/Home; Neo photos/map/Octopus; tabs; no dead-end. Physical **NOT VERIFIED**.

**HOLD until recovery physical PASS:** Stages 3–5, onboarding impl, overlapping fix batches.  
**Workspace-BLOCKED:** TiB hotel multi-photo + SmartTraveler coupons.  
**Coordination:** `artifacts/runtime-proof/rc-2026-10-13/task-coordination-plan.md`

---

## Emergency recovery 15 Oct 2026 — owner FAIL on `dcd786a`

| Field | Value |
|-------|--------|
| Owner-cited FAIL SHA | **`dcd786a`** (broken RC — **do not retest**) |
| Gate1 pair @ `52e878a` | iOS `5a1ad004…` / Android `8b5f2fd3…` — **never confirmed installed by owner** |
| Recovery product SHA | **`cfdd68d`** |
| Report | `artifacts/runtime-proof/rc-2026-10-15/emergency-native-recovery-report.md` |
| P0 code | Home Between Trips trap removed; Explore InteractionManager defer removed; More spa emoji; Hotel/guest escapes → `/home` |
| iOS EAS | _(pending)_ |
| Android EAS | _(pending)_ |
| Physical | **NOT VERIFIED** |
| Verdict | **NO-GO** production · builds ≠ product proof |

### Owner retest (recovery pair only)

1. Delete app → install **new** SAME-SHA iOS+Android (not `dcd786a`, not Gate1 unless reissued).  
2. Intro → Home; all bottom tabs; More (no eject); Explore categories/venues (no freeze); Hotel ← Home.  
3. Story → Local banDit → Back/Home.  
4. Report with **build detail URL + platform**.
