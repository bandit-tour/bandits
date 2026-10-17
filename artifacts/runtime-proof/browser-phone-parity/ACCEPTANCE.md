# Browser ↔ Phone App Parity — Acceptance Pack

**Directive:** Exact browser ↔ phone functional parity (one product, two screens).  
**Branch tip:** `c9b6bf7` on `repair/guest-app-regression` (includes profile P0 fix `605cb4c`)  
**Date:** 2026-10-17  
**Stripe:** TEST only (`stripeMode: test_ready`, `livePaymentsFlag: false`) — **LIVE OFF**  
**CEO testing readiness:** **NOT READY** until Android + iOS physical rows below flip to PASS.

---

## Installable deliverables

| Surface | Value |
|---------|--------|
| **Browser URL** | https://bandits-two.vercel.app |
| **Vercel deploy** | `dpl_Hm7aQ1vVKD8PYFwp37vQe8e5esjh` |
| **Android APK (EAS preview)** | https://expo.dev/artifacts/eas/Q73wklYQQsl5FkGRb7F3AA3xEsl68I-6jR3WAVILJrE.apk |
| **Android build page** | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/33c3a52e-da11-4871-95b2-d59bdfb4795b |
| **Android version** | `1.0.2` / versionCode **19** / commit **c9b6bf7** / build id `33c3a52e-da11-4871-95b2-d59bdfb4795b` |
| **iOS IPA (EAS preview, internal Ad Hoc)** | https://expo.dev/artifacts/eas/PnvW_DVKzYohWfAf01r4PYB4quTfILMf91-PtOk_tVM.ipa |
| **iOS build page** | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/2c023dd7-0931-4fbb-a1f8-cd46fffb0e6a |
| **iOS version** | `1.0.2` / buildNumber **43** / commit **c9b6bf7** / build id `2c023dd7-0931-4fbb-a1f8-cd46fffb0e6a` |
| **iOS TestFlight** | **BLOCKED** — no `ascAppId` in `eas.json`; preview is **internal Ad Hoc** (UDID `00008110-0019248C0A9A401E`). |
| **Workspace** | https://banditour-workspace.vercel.app |

Evidence: `BUILD-MANIFEST.json`, `BUILDS.json`, `RESULT.json`, `profile-crash-probe.json`.

---

## Profile P0

| Check | Status |
|-------|--------|
| Browser `/profile` after `605cb4c` + deploy | **PASS** — no `PROFILE_STAY is not defined`; page renders |
| Native APK/IPA include fix | Yes (`605cb4c` ancestor of tip `c9b6bf7`) |
| Physical device PASS | **BLOCKED** — `adb devices` empty; no emulator; Ad Hoc IPA not installed in this agent env |

---

## Status legend (enforced)

| Tag | Meaning |
|-----|---------|
| **PASS** | Verified on **both** browser and installable phone build (physical or owner-confirmed device). |
| **BROWSER_OK** | Verified on production browser. Not native PASS. |
| **BLOCKED** | Exact reason + owner. Do not treat as PASS. |

**Rule:** No PASS from shared source alone.

---

## Route matrix (summary)

Rows 1–27 remain **BROWSER_OK** / **BLOCKED** for native — physical install required on vc19 + bn43.  
Row 16 Profile: browser **PASS** post-fix; native **BLOCKED** pending device.

---

## Remaining blockers (exact owner)

1. **Physical Android verify @ `c9b6bf7` / vc19** — install APK; agent `adb` empty.  
2. **Physical iOS verify @ `c9b6bf7` / bn43** — Ad Hoc on UDID `00008110-0019248C0A9A401E`.  
3. **TestFlight** — needs `ascAppId` + App Store distribution profile.  
4. **Cross-device sync sign-off** — requires phones.  
5. Lifecycle Home BEFORE ARRIVAL vs Menu After Trip inconsistency (product).

---

## CEO go / no-go

| Gate | Status |
|------|--------|
| Browser reference live | **GO** — https://bandits-two.vercel.app |
| Profile P0 web | **GO** (fixed) · device PASS pending |
| Installable Android @ tip | **GO link** · **NO-GO verify** until physical PASS |
| Installable iOS @ tip | **GO Ad Hoc IPA** · **NO-GO TestFlight** · **NO-GO verify** |
| Stripe LIVE | **OFF** |
| Exact parity PASS matrix | **NO-GO** — native cells BLOCKED (no adb) |
