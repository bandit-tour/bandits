# Browser ↔ Phone parity matrix

**Verdict: NOT CEO-READY — phone routes BLOCKED (no on-device verification)**

| Surface | Status |
|---------|--------|
| Browser (prod) | **26/27 PASS**, Local Insider **PARTIAL** |
| Android preview | **Builds READY** — route matrix **BLOCKED** until install + device QA |
| iOS preview (Ad Hoc) | **Builds READY** — route matrix **BLOCKED** until install on registered iPhone |
| TestFlight | **BLOCKED** — no `ascAppId` / preview is Ad Hoc not store |
| Cross-device sync | **BLOCKED** — needs phone install |

**Browser prod:** https://bandits-two.vercel.app · `dpl_9nD15uX3P2gqNgM8pYnWrSQ8jhc3`  
**Guest completion commit:** `a1ec0c0`  
**Tip at evidence:** `c9b6bf7` (includes profile crash + concierge voice fixes)  
**Stripe LIVE:** OFF · No invented supply

## Install links (preview / internal)

| Platform | Build ID | Install |
|----------|----------|---------|
| **Android tip (prefer)** | `33c3a52e-da11-4871-95b2-d59bdfb4795b` | [APK](https://expo.dev/artifacts/eas/Q73wklYQQsl5FkGRb7F3AA3xEsl68I-6jR3WAVILJrE.apk) · [page](https://expo.dev/accounts/banditeam121275/projects/bandits/builds/33c3a52e-da11-4871-95b2-d59bdfb4795b) |
| **iOS tip Ad Hoc (prefer)** | `2c023dd7-0931-4fbb-a1f8-cd46fffb0e6a` | [IPA](https://expo.dev/artifacts/eas/PnvW_DVKzYohWfAf01r4PYB4quTfILMf91-PtOk_tVM.ipa) · [page](https://expo.dev/accounts/banditeam121275/projects/bandits/builds/2c023dd7-0931-4fbb-a1f8-cd46fffb0e6a) |
| Android (Guest completion `a1ec0c0`) | `ad11e51b-aa36-4dc2-9b2f-1860e8a6623b` | [APK](https://expo.dev/artifacts/eas/Dn6yagonhBZVenv-fAfki-cHufME24LV-LxfBvfzPDE.apk) · [page](https://expo.dev/accounts/banditeam121275/projects/bandits/builds/ad11e51b-aa36-4dc2-9b2f-1860e8a6623b) |
| iOS Ad Hoc (`a1ec0c0`) | `62213240-b99f-494e-85a3-80d43f303f2b` | [IPA](https://expo.dev/artifacts/eas/mW_uKQVCjenMk2WuF-q4qydD5U_XjpyDklxEDck_S3A.ipa) · [page](https://expo.dev/accounts/banditeam121275/projects/bandits/builds/62213240-b99f-494e-85a3-80d43f303f2b) |

iOS Ad Hoc only on UDID `00008110-0019248C0A9A401E`.

## Route matrix

Rule: **PASS only if verified on device/build**. Browser column from Guest App completion WEB run. Phone columns are BLOCKED until physical install QA.

| Route | Browser | Android | iOS | Notes |
|-------|---------|---------|-----|-------|
| Welcome `/` | PASS | BLOCKED | BLOCKED | No adb / no agent-held iPhone |
| Home `/home` | PASS | BLOCKED | BLOCKED | |
| Explore `/explore` | PASS | BLOCKED | BLOCKED | |
| Local banDits `/bandits` | PASS | BLOCKED | BLOCKED | |
| Experiences `/experiences` | PASS | BLOCKED | BLOCKED | |
| Experience detail `/experience/exp_costume_warehouse` | PASS | BLOCKED | BLOCKED | |
| SmartTraveler `/smarttraveler` | PASS | BLOCKED | BLOCKED | |
| banDiShop `/shop` | PASS | BLOCKED | BLOCKED | |
| bandiTEAM `/scam-alerts` | PASS | BLOCKED | BLOCKED | |
| Hotel hub `/hotelier` | PASS | BLOCKED | BLOCKED | |
| Local Friend `/localFriend` | PASS | BLOCKED | BLOCKED | |
| Chat `/community` | PASS | BLOCKED | BLOCKED | |
| Notifications `/notifications` | PASS | BLOCKED | BLOCKED | Prefs shipped in `a1ec0c0` |
| More `/menu` | PASS | BLOCKED | BLOCKED | |
| Profile `/my-profile` | PASS | BLOCKED | BLOCKED | Tip includes `605cb4c` crash fix |
| Settings `/settings` | PASS | BLOCKED | BLOCKED | Category + quiet hours prefs |
| Impact `/impact` | PASS | BLOCKED | BLOCKED | |
| Travel in a Bottle `/travelBottle` | PASS | BLOCKED | BLOCKED | Mix preserved; empty second-sleep honest |
| Bottle hotel `/bottleHotel/play-theatrou` | PASS | BLOCKED | BLOCKED | |
| Bookings `/bookings` | PASS | BLOCKED | BLOCKED | |
| Dream Destinations `/dreamDestinations` | PASS | BLOCKED | BLOCKED | |
| City Memory `/cityMemory` | PASS | BLOCKED | BLOCKED | |
| Your Local Insider `/premium/…` | PARTIAL | BLOCKED | BLOCKED | Workspace/Stripe TEST; LIVE OFF |
| Account `/account` | PASS | BLOCKED | BLOCKED | |
| FAQ `/account/faq` | PASS | BLOCKED | BLOCKED | |
| Emergency `/account/emergency` | PASS | BLOCKED | BLOCKED | |
| Connect My New Stay `/reactivateStay` | PASS | BLOCKED | BLOCKED | |
| Hotel QR `/hotel/play-theatrou` | PASS | BLOCKED | BLOCKED | |
| Payments `/account/payments` | CAPTURED | BLOCKED | BLOCKED | Browser smoke capture only |
| Membership `/account/membership` | CAPTURED | BLOCKED | BLOCKED | |
| Technical Support `/account/technical-support` | CAPTURED | BLOCKED | BLOCKED | |
| My Moment `/myMoment` | CAPTURED | BLOCKED | BLOCKED | |

## Blockers (honest)

1. **Device lab empty** — `adb devices` empty; Windows agent has no Xcode; cannot PASS native routes.
2. **TestFlight** — `eas submit` failed: missing `ascAppId`; preview = Ad Hoc not store.
3. **Cross-device sync** — blocked until APK/IPA installed and same account exercised.
4. **Local Insider** — browser PARTIAL (Workspace/Stripe TEST); do not invent supply; Stripe LIVE OFF.

## Unblock path for CEO

1. Install tip Android APK (or Guest-completion APK if tip still building) on a phone.
2. Install tip iOS Ad Hoc on registered iPhone via Expo build page.
3. Walk every route above; flip BLOCKED → PASS only with screenshot under `artifacts/runtime-proof/browser-phone-parity/phone-*`.
4. Run same-account sync checklist in `CROSS-DEVICE-SYNC.json`.
5. Optional TestFlight: add `ascAppId`, store-distribution build, `eas submit`.
