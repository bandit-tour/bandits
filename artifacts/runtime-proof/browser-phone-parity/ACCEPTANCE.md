# Browser ↔ Phone App Parity — Acceptance Pack

**Directive:** Exact browser ↔ phone functional parity (one product, two screens).  
**Branch tip:** `71b0451` on `repair/guest-app-regression` (matches `origin`)  
**Date:** 2026-10-17  
**Stripe:** TEST only (`stripeMode: test_ready`, `livePaymentsFlag: false`)  
**CEO testing readiness:** **NOT READY** until Android + iOS physical rows below flip to PASS.

---

## Installable deliverables

| Surface | Value |
|---------|--------|
| **Browser URL** | https://bandits-two.vercel.app |
| **Android APK (EAS preview)** | https://expo.dev/artifacts/eas/xlmhjCQwvLAhOsYc37uC9BhmayTkYv3BFaKxOMoKgzA.apk |
| **Android build page** | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/68553a9d-4f88-4ef8-8dab-4dc16aefe760 |
| **Android version** | `1.0.2` / versionCode **16** / commit **71b0451** / build id `68553a9d-4f88-4ef8-8dab-4dc16aefe760` |
| **iOS IPA (EAS preview, internal Ad Hoc)** | https://expo.dev/artifacts/eas/rPiZydpDZxKuszzQfRHPzeqjf7KUYRPmN8e3bsMH2EE.ipa |
| **iOS build page** | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/8f6209b3-4f3b-4890-8528-94644a3c7f76 |
| **iOS version** | `1.0.2` / buildNumber **40** / commit **71b0451** / build id `8f6209b3-4f3b-4890-8528-94644a3c7f76` |
| **iOS TestFlight** | **BLOCKED** — `eas submit` failed: no `ascAppId` in `eas.json`; preview profile is **internal Ad Hoc** (provisioned device `00008110-0019248C0A9A401E`), not App Store/TestFlight. Owner: add ASC app id + production submit profile, or install Ad Hoc IPA on registered iPhone. |
| **Workspace** | https://banditour-workspace.vercel.app (native preview `EXPO_PUBLIC_WORKSPACE_URL`; browser via `/__workspace`) |

Evidence: `BUILD-MANIFEST.json`, `browser-capture.json`, screenshots `browser-*.png`, `workspace-bridge-smoke.json`, `cross-device-sync.json`.

---

## Status legend (enforced)

| Tag | Meaning |
|-----|---------|
| **PASS** | Verified on **both** browser and installable phone build (physical or owner-confirmed device). |
| **BROWSER_OK** | Verified on production browser (Playwright mobile 390×844). Not native PASS. |
| **SOURCE_SHARED** | Same Expo Router screen / shared components — necessary but **not** sufficient for PASS. |
| **BLOCKED** | Exact reason + owner. Do not treat as PASS. |

**Rule:** No PASS from shared source alone. No native PASS from simulator-only when EAS physical install is the available path. This agent had **no USB Android device** and **no emulator**; iOS Ad Hoc IPA is installable only on the registered UDID.

---

## Route / screen / CTA parity matrix (Welcome → Support)

| # | Product surface | Route(s) | Browser | Android `71b0451` | iOS `71b0451` | Verdict |
|---|-----------------|----------|---------|-------------------|---------------|---------|
| 1 | Welcome / PLAY intro | `/`, `/playWelcome`, hotel entry | BROWSER_OK (`browser-welcome.png`) | BLOCKED — no device install in agent env | BLOCKED — Ad Hoc IPA ready; not installed here; TestFlight blocked | **BLOCKED** (native install/verify) · Owner: CEO device install |
| 2 | Home (trip brain) | `/home` | BROWSER_OK — rail + bottom nav + Meet Neo CTA (`browser-home.png`) | BLOCKED | BLOCKED | **BLOCKED** |
| 3 | Explore | `/explore` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 4 | Local banDits | `/bandits`, `/bandit/[id]` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 5 | Experiences | `/experiences`, `/experience/[id]` | BROWSER_OK — live `Kypseli courtyard clay morning` €72 (`browser-experiences.png`); API count=1 | BLOCKED | BLOCKED | **BLOCKED** |
| 6 | SmartTraveler | `/smarttraveler`, `/localFind/[id]` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 7 | banDiShop | `/shop`, `/product/[id]` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 8 | bandiTEAM / Safety | `/alerts`, `/scam-alerts`, `/bandiTeam`, `/bandiTeam/report` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 9 | Travel in a Bottle | `/travelBottle`, `/bottleHotel/[slug]`, `/journey/[id]` | BROWSER_OK — Mix form + PLAY/NYX chips (`browser-bottle.png`) | BLOCKED | BLOCKED | **BLOCKED** |
| 10 | Octopus / Your Local Insider | `/premium/[id]`, profile CTAs | BROWSER_OK — €19 Stay Pass + sign-in gate (`browser-octopus-premium.png`); Workspace `showPremiumInsights:true` | BLOCKED | BLOCKED | **BLOCKED** |
| 11 | Hotel (stay modules) | `/hotelier/*` | BROWSER_OK (route HTTP 200 + SOURCE_SHARED) | BLOCKED | BLOCKED | **BLOCKED** |
| 12 | Local Friend | `/localFriend` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 13 | Chat | `/chat`, `/community` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 14 | Notifications / Inbox | `/notifications`, `/inbox` | BROWSER_OK (SOURCE_SHARED); local WIP notification prefs **not** in tip build | BLOCKED | BLOCKED | **BLOCKED** |
| 15 | More / Menu | `/menu` | BROWSER_OK — Journey / Privileges / Support tiles (`browser-menu.png`) | BLOCKED | BLOCKED | **BLOCKED** |
| 16 | Profile | `/profile`, `/my-profile` | **FAIL on prod tip deploy** — `PROFILE_STAY is not defined` black screen (`browser-profile.png`); **FIX in working tree** `app/(tabs)/profile.tsx` (import + gate sample score) — needs commit + Vercel + EAS rebuild | BLOCKED (tip IPA/APK still crash until rebuild) | BLOCKED | **BLOCKED** · Owner: commit profile fix → redeploy web + EAS |
| 17 | Impact / Passport | `/impact` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 18 | Trips / Bookings | `/bookings` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 19 | Dream Destinations | `/dreamDestinations` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 20 | City Memory / Moments | `/cityMemory`, `/myMoment` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 21 | Payments | `/account/payments` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 22 | Premium Membership | `/account/membership` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 23 | Account → Support list | `/account` → settings, language, privacy, FAQ, **Technical Support** | BROWSER_OK — full Welcome→Support account list (`browser-account.png`) | BLOCKED | BLOCKED | **BLOCKED** |
| 24 | Technical Support | `/account/technical-support` | BROWSER_OK | BLOCKED | BLOCKED | **BLOCKED** |
| 25 | Media (images/video Bottle) | Bottle Mix assets + PLAY intro | BROWSER_OK (prior bottle-video proofs + tip `71b0451` Mix loop commit) | BLOCKED — needs on-device video/decode | BLOCKED | **BLOCKED** |
| 26 | Maps / location | Explore map, scam map | BROWSER_OK (SOURCE_SHARED) | BLOCKED — needs location permission on device | BLOCKED | **BLOCKED** |
| 27 | Stripe TEST return | Premium Stay Pass checkout | BROWSER_OK historically (product-recovery O5 TEST); LIVE off | BLOCKED — needs signed-in native checkout return | BLOCKED | **BLOCKED** |

**Bottom ACCESS (both platforms, shared `MainBottomNav`):** Home · Explore · Hotel · Local Friend · Chat · More  
**Discovery rail (shared `DISCOVERY_LANE_STAY`):** Local banDits · Experiences · SmartTraveler · bandiTEAM · banDiShop  

---

## Cross-device sync results

| Check | Result | Evidence |
|-------|--------|----------|
| Browser Workspace bridge == direct Workspace health | PASS (API) | `cross-device-sync.json` — `stripeMode: test_ready`, LIVE off |
| Experiences catalog identical via `/__workspace` vs direct | PASS (API) — count **1** both | `workspace-bridge-smoke.json` |
| Bottle provider inventory | Honest empty (`count:0`, `inventory:none`); demo seeds labelled | same |
| Premium visibility for Neo id | PASS (API) — authorized + `showPremiumInsights` | `premium-neo-probe.json` |
| Saves / requests / credits / bookings / settings persist across browser↔phone refresh/logout | **BLOCKED** | No physical phone in agent env; cannot claim PASS |
| Auth persistence on native | **BLOCKED** | Requires installed build |

---

## Preserved recoveries (do not regress)

| Lane | Status |
|------|--------|
| Bottle Mix + hotel discovery | Browser recovered (T01–T06 prior + `browser-bottle.png`) |
| Octopus / Premium TEST | Browser recovered (O1–O6 prior + `browser-octopus-premium.png`); LIVE off |
| Experiences commercial honesty | Live listing count=1 (not invented dual catalog) |
| Shared Expo source | Single `app/` tree for web + native |

---

## Remaining blockers (exact owner)

1. **Physical Android verify @ `71b0451` / vc16** — Owner: install APK on real device; run matrix rows 1–27. Agent: `adb` empty, no emulator.  
2. **Physical iOS verify @ `71b0451` / bn40** — Owner: install Ad Hoc IPA on registered iPhone UDID `00008110-0019248C0A9A401E`.  
3. **TestFlight** — Owner: set `submit.production.ios.ascAppId` (or interactive ASC auth) and submit an App Store distribution build; preview Ad Hoc ≠ TestFlight.  
4. **Cross-device sync sign-off** — Owner: same account on browser + phone — save spot, dream destination, Stay Pass TEST unlock, chat delete; refresh/logout/login both sides.  
5. **Shared lifecycle inconsistency (both platforms)** — Home shows **BEFORE ARRIVAL** while More shows **Members Club · After Trip** in same anonymous session (`browser-home.png` vs `browser-menu.png`). Owner product/lifecycle fix; not phone-only.  
6. **Bottle external sleep inventory** — Workspace `bottle/stays` count=0 (ops/supply); Guest must not invent bookings.  
7. **Profile black-screen crash (P0 shared)** — Prod + tip EAS `71b0451` throw `PROFILE_STAY is not defined` on `/profile`. Fix staged in working tree (not committed — awaiting owner commit approval). After commit: redeploy Vercel + rebuild Android/iOS preview.  
8. **Local WIP not in tip builds** — Uncommitted: notification prefs/policy, settings quiet hours, octopus entitlement, commerceBook, profile fix, `.easignore`. Re-ship EAS after owner commits required slices.  
9. **`.easignore`** — Added `python_scripts/` + `data_uploader/` to shrink future uploads (next build).

---

## CEO go / no-go

| Gate | Status |
|------|--------|
| Browser reference live | **GO** — https://bandits-two.vercel.app |
| Installable Android @ tip | **GO link** — APK above · **NO-GO verify** until physical PASS |
| Installable iOS @ tip | **GO Ad Hoc IPA** · **NO-GO TestFlight** · **NO-GO verify** until physical PASS |
| Stripe LIVE | **OFF** (required) |
| Exact parity PASS matrix | **NO-GO** — all native cells BLOCKED pending device |

**Owner must not start CEO testing until Android + iOS physical rows are PASS.**
