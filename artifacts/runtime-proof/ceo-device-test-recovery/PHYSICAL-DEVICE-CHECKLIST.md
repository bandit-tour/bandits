# CEO physical device acceptance — BLOCKED until installed

**Status:** BLOCKED (no adb / no on-device session in recovery agent run)  
**Source commit:** `2bbf93beee6944e17b16ec98c5c2649772db8e5d`  
**Web deploy:** `dpl_KrFQXBoNz7NSXdMNas3Pav1HRfPt` → https://bandits-two.vercel.app

## Install

| Platform | Artifact | EAS build |
|----------|----------|-----------|
| Android | [APK](https://expo.dev/artifacts/eas/EQtdE1_rFXpz_Z78As2O4CwDRphrQZBu8X480AHU3fA.apk) | `d9ceb6f8-28d8-4b70-845a-a1e080a27d7d` (vc **21**) |
| iOS Ad Hoc | [IPA](https://expo.dev/artifacts/eas/mL1yftlhdkw2xmCmUk5Cx8cRUxbMjrAjNQ83sQPsTM0.ipa) | `2385fbe6-06a2-4201-8a7c-9bcb23cd5775` (bn **45**) |

iOS IPA installs only on UDID **00008110-0019248C0A9A401E** (current Ad Hoc profile). Add devices in Apple Developer + refresh provisioning before expecting other phones.

## Pre-flight (both platforms)

- [ ] Confirm app version **1.0.2** / build **21** (Android) or **45** (iOS) in About or EAS install page
- [ ] Fresh anonymous or proof guest — **PRE_TRIP** (no active stay)
- [ ] Stripe **TEST** only — no live card charges

## P0 routes (native)

- [ ] **Home** (`/bandits`): hero loads; lifecycle reads **before stay / arriving**, not “Between trips”
- [ ] **More** (`/menu`): status pill **Members Club · Before arrival**; quick actions are pre-arrival set (Local Friend, Connect My Stay — not City Memory-first After Trip rail)
- [ ] **Profile** (`/profile`): opens without crash; no `PROFILE_STAY` redbox
- [ ] **Explore** + **Experiences**: list renders; open one detail and back
- [ ] **Travel in a Bottle**: intro / mix surfaces load (no stale vc19 video regression)
- [ ] **Octopus / Local Insider (Neo)**: offer surfaces; no live checkout unless explicitly enabled

## Regression spot-checks

- [ ] Pull-to-refresh on Home, More, Profile, Chat
- [ ] Tab navigation: Home → Explore → Experiences → More → back
- [ ] Deep link: `https://bandits-two.vercel.app/hotel/play-theatrou` → intro → Home

## Sign-off

| Surface | Result | Tester | Date |
|---------|--------|--------|------|
| Android APK | ☐ PASS ☐ FAIL | | |
| iOS Ad Hoc | ☐ PASS ☐ FAIL | | |
| Web parity spot-check | ☐ PASS ☐ FAIL | | |

Do **not** mark **PASS** until both Android and iOS rows are checked on physical hardware.
