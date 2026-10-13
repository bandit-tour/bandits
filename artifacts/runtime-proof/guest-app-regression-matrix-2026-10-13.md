# Guest App QA & Regression Matrix — Owner Review Oct 13 2026

**Branch:** `repair/guest-app-regression`  
**HEAD:** `dcd786a3abc7cd318f364b9c2685cd0be590df3e`  
**Parent chain:** `6b2a346` → `d012338` → `9a80fe8` → `2be767c` → `6d8e857` → `dcd786a`  
**Protected baseline:** `6b2a346` — **preserved** (ancestor; not rewritten)  
**Production:** https://bandits-two.vercel.app — **NOT deployed** this cycle  
**Updated:** 2026-10-13 (Android AAPT fix + installable APK)

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
| **QA-01** | Neo Premium CTA + Octopus badge only when authorized; carousel valid photos | **CODE FIXED — RUNTIME NOT VERIFIED** | Workspace visibility + failed URI slides | `BanditHeader`, `premium-visibility.ts` | Partial | NOT VERIFIED | NOT VERIFIED |
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

## Builds (EAS preview)

| Platform | Build ID | Status | Install / artifact |
|----------|----------|--------|---------------------|
| **Android** | `e8e76108-1cc6-4211-ae74-f50c7b297a79` | **FINISHED** @ `dcd786a` (versionCode 9) | Page: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/e8e76108-1cc6-4211-ae74-f50c7b297a79 · **APK:** https://expo.dev/artifacts/eas/q6rUoYFcV3JjJ-94S3p8sg3sX2vay_YuxNXTXOZgeYg.apk |
| **iOS** | `13632132-4186-458e-bfd5-82db4288cd69` | **FINISHED** @ `9a80fe8` (build 31) | Page: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/13632132-4186-458e-bfd5-82db4288cd69 · IPA: https://expo.dev/artifacts/eas/4AW2sEsepWyCXhRXvm7ipx5BdmCghrSRfmwrtQ-vsoM.ipa |
| Android (failed) | `6469a183-…` / `65b3fb4e-…` / `b515d503-…` | ERRORED | Root cause: AAPT `:app:mergeReleaseResources` — `assets_images_playtheatrou.png` was JPEG bytes with `.png` extension |

**Android root cause (resolved):** `assets/images/play-theatrou.png` was a JPEG mislabeled as PNG → AAPT2 `file failed to compile` during `mergeReleaseResources`. Fixed by re-encoding to a real PNG (`dcd786a`). Also shrunk EAS upload via `.easignore` and dropped color notification icon from `expo-notifications` plugin (`6d8e857`).

**SHA drift:** iOS IPA is still @ `9a80fe8`; Android APK is @ `dcd786a` (includes PNG fix + prior QA batch). Rebuild iOS if a same-SHA install pair is required. Physical device PASS still **NOT** claimed.

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

**NO-GO for production** (unchanged materially).

Still required:
1. Successful **Android** preview APK (Gradle blocker)
2. Physical-device PASS (iOS IPA available for ad-hoc install; Android none)
3. QA-19 docs + UI bindings once transfer package is provided
4. No production deploy

iOS HEAD IPA is installable for **manual** device QA only — does **not** equal physical PASS.
