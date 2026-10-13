# Guest App QA & Regression Matrix — Owner Review Oct 13 2026

**Branch:** `repair/guest-app-regression`  
**HEAD / P0 fix SHA:** `fee613065defea1f2b45492515b4f9e6c121d461`  
**Failed RC (superseded):** `dcd786a`  
**Parent chain:** `6b2a346` → … → `dcd786a` → … → `0080a82` → **`fee6130` (P0)**  
**Protected baseline:** `6b2a346` — **preserved** (ancestor; not rewritten)  
**Production:** https://bandits-two.vercel.app — **NOT deployed** this cycle  
**Updated:** 2026-10-13 (P0 iOS intro/touch + Android More crash — physical still NOT VERIFIED)

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

## Builds (EAS preview) — P0 same-SHA install pair

**P0 app code SHA:** `fee613065defea1f2b45492515b4f9e6c121d461`  
**Commit:** `fix(p0): restore iOS intro→bandits path; harden Android More mount`  
**Failed RC superseded:** `dcd786a` (do not use for retest)

| Platform | Build ID | Status | Install / artifact |
|----------|----------|--------|---------------------|
| **Android** | `6bed5ee6-28d7-4bec-8cd5-480dadef0197` | **FINISHED** @ `fee6130` (versionCode 10) | Page: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/6bed5ee6-28d7-4bec-8cd5-480dadef0197 · **APK:** https://expo.dev/artifacts/eas/84XPR1doHOsmdkB5H4MTudbj-0dgcfIimvDSjm2EEYE.apk |
| **iOS** | `46050ddd-7cd5-46b8-aa94-afbe632c1c19` | **FINISHED** @ `fee6130` (build 33) | Page: https://expo.dev/accounts/banditeam121275/projects/bandits/builds/46050ddd-7cd5-46b8-aa94-afbe632c1c19 · **IPA:** https://expo.dev/artifacts/eas/LucdJfVCsW6eiZ2jDSxeaZYHTMQMweqXm8wy4Km5148.ipa |

**Pairing note:** iOS + Android both built from **identical** git SHA `fee6130`. Physical iPhone / Android remain **NOT VERIFIED** until owner retests.

### P0 root causes (code diagnosis — device NOT VERIFIED)

| Platform | Root cause | Fix |
|----------|------------|-----|
| **iOS** | Post-intro redirected to `/home` (TripHome = “new experience”) instead of approved `/bandits`; boot gate could stick on dark loading; bottle `VideoView` could intercept touches with no Skip | Restore `/bandits`; AsyncStorage fail-open 2.5s; bottle Skip + 9s hard ceiling (`app/index.tsx`, `OpeningIntroScreen.tsx`) |
| **Android** | More (`menu.tsx`) mount crash vectors: VS16 emoji (e.g. 🛎️), Yoga `%`+`gap`, Pressable `transform`+elevation, ExpoImage, uncaught lifecycle refresh | Harden menu layout/emoji/image; guard `useGuestLifecycle.refresh` — destinations kept |

### Owner device retest (only these)

1. **Intro** — cold open shows approved opening; can progress (Who sent it? / Skip / Enter)
2. **First-tap** — after Enter, Local banDits / tabs / buttons respond
3. **More** — bottom More opens; navigate a destination; back; open More again (Android: no process death)

### Prior pair (superseded — AAPT era)

| Platform | Build ID | SHA |
|----------|----------|-----|
| Android | `e8e76108-…` | `dcd786a` |
| iOS | `4806b4c1-…` | `b2c4fb2` |

**Android AAPT (still resolved):** `play-theatrou.png` JPEG-as-PNG → re-encoded in `dcd786a`.

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

**NO-GO for production** — P0 preview pair ready for owner physical retest only.

Still required:
1. Physical-device PASS on iPhone + Android @ `fee6130` (builds above) — **both remain NOT VERIFIED**
2. QA-19 / screenshot work remains **ON HOLD**
3. No production deploy

Build FINISHED ≠ physical PASS. Owner must retest intro, first-tap, More.
