# CEO Mobile Testing — Execution Status

**At:** 2026-10-17T17:00Z  
**Branch tip:** `2bbf93beee6944e17b16ec98c5c2649772db8e5d` (`repair/guest-app-regression`)  
**Stripe LIVE:** OFF for web deploy (`EXPO_PUBLIC_FF_PAYMENTS_LIVE=false` patched for `dpl_99CN…`). Native EAS preview env does **not** set this flag; not claimed OFF on device binaries without install verify.  
**Physical-device PASS:** none claimed (no attached devices).

---

## 1. Profile crash fix committed?

**YES.**

| Field | Value |
| --- | --- |
| SHA (short) | `605cb4c` |
| SHA (full) | `605cb4cafed4e6445ca5c65d490de922a4c93328` |
| Message | `fix(profile): restore PROFILE_STAY import to stop /profile crash` |
| Ancestor of tip | Yes (`605cb4c` ⊂ `2bbf93b`) |

Lifecycle Home/More fix also committed: `2bbf93beee6944e17b16ec98c5c2649772db8e5d` — `fix(menu): align More tab with pre-arrival lifecycle`.

---

## 2. Corrected Web deployed and tested?

**YES — tip redeployed this session and probed.**

| Field | Value |
| --- | --- |
| URL | https://bandits-two.vercel.app |
| Deploy ID | `dpl_99CN4rd8ZZSUk6XDbpNjNFyFEdNY` |
| Inspect | https://vercel.com/bandiexchas-projects/bandits/99CN4rd8ZZSUk6XDbpNjNFyFEdNY |
| Created | 2026-10-17 19:46:15 +0300 |
| Tip at deploy | `2bbf93b` (includes `605cb4c` + More lifecycle) |

### `/profile` browser probe

| Check | Result |
| --- | --- |
| Playwright runtime | **PASS** — no `PROFILE_STAY is not defined`; body starts `Profile · Guest · bandiTour…` |
| Evidence | `profile-playwright.json`, `profile-browser.png` |
| Bundle fetch | **PASS** — entry `entry-d174aff87e994034a5b326fed5c5dbb0.js` contains `PROFILE_STAY` (`profile-probe.json`) |

---

## 3. NEW Android APK + iOS IPA from corrected tip (not vc19/bn43)?

**YES — fresh EAS preview builds on tip `2bbf93b` (not recycled `c9b6bf7` vc19/bn43).**

Prefer latest tip binaries:

### Android (prefer)

| Field | Value |
| --- | --- |
| Build ID | `d9ceb6f8-28d8-4b70-845a-a1e080a27d7d` |
| versionCode | **21** (not 19) |
| Commit | `2bbf93beee6944e17b16ec98c5c2649772db8e5d` |
| APK | https://expo.dev/artifacts/eas/EQtdE1_rFXpz_Z78As2O4CwDRphrQZBu8X480AHU3fA.apk |
| Page | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/d9ceb6f8-28d8-4b70-845a-a1e080a27d7d |
| Status | FINISHED |

### iOS (prefer)

| Field | Value |
| --- | --- |
| Build ID | `2385fbe6-06a2-4201-8a7c-9bcb23cd5775` |
| buildNumber | **45** (not 43) |
| Commit | `2bbf93beee6944e17b16ec98c5c2649772db8e5d` |
| IPA | https://expo.dev/artifacts/eas/mL1yftlhdkw2xmCmUk5Cx8cRUxbMjrAjNQ83sQPsTM0.ipa |
| Page | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/2385fbe6-06a2-4201-8a7c-9bcb23cd5775 |
| Distribution | Ad Hoc / internal; provisioned UDID `00008110-0019248C0A9A401E` |
| Status | FINISHED |

### Also finished this session (same tip; older autoIncrement)

| Platform | Build ID | Ver | Artifact |
| --- | --- | --- | --- |
| Android | `e0b28d36-1920-4fb0-a868-1982ec52c187` | vc20 | https://expo.dev/artifacts/eas/5owGmyjd1N6Ds8SiWvNwna8qpQSyZbjMOvgy8a3rVbc.apk |
| iOS | `0a2db204-dcef-4486-b122-d8da3a9e57e5` | bn44 | https://expo.dev/artifacts/eas/uBGjugxQahVB8R-Q8ycpjQ_oCk9UIwFCRjU_V9zDUhM.ipa |

**Superseded (do not use for CEO tip install):** vc19 `33c3a52e-…` / bn43 `2c023dd7-…` @ `c9b6bf7`.

---

## 4. Installable on intended physical devices?

**NOT VERIFIED on this agent — install path only.**

| Surface | State |
| --- | --- |
| `adb devices` | empty (`List of devices attached` with no rows) |
| Android installability | APK URL ready; **no device/emulator attached** → cannot install or smoke |
| iOS UDID | `00008110-0019248C0A9A401E` on Ad Hoc profile (credentials list) |
| iOS installability | IPA URL ready; **no Xcode / device lab on this Windows agent** → cannot confirm install |

---

## 5. Physical-device tests still blocked — why

| Test | Status | Why |
| --- | --- | --- |
| Android install + Profile / Home / More @ tip vc21 | **BLOCKED** | `adb devices` empty |
| iOS Ad Hoc install + Profile / Home / More @ tip bn45 | **BLOCKED** | no physical iPhone session on agent; needs UDID `00008110-0019248C0A9A401E` |
| Native parity matrix rows (phone) | **BLOCKED** | depend on above installs |
| Cross-device sync | **BLOCKED** | same device lab gap |

Web `/profile` is **PASS**. Native routes are **not** PASS.

---

## 6. Uncommitted WIP outside the builds?

**Yes — no dirty `app/` / `components/` / `lib/`.** Tip builds match committed tip. Remaining WIP:

### Modified (tracked)

- `.env` — includes `EXPO_PUBLIC_FF_PAYMENTS_LIVE=true` locally (not what was used for web deploy; restored after deploy)

### Untracked (non-artifact, material)

- `STRIPE-TEST-BOOKING.json`
- `scripts/inspect-prod-bundle.mjs`
- `scripts/probe-prod-experiences-eur72.mjs`
- `scripts/proof-local-insider-acceptance-ak.mjs`
- `scripts/proof-local-insider-browser-shots.mjs`
- `scripts/proof-local-insider-commercial-ak.mjs`
- `scripts/proof-notification-classes.mjs`
- `scripts/proof-octopus-ai-execution.mjs`
- `scripts/proof-octopus-concierge-e2e.mjs`
- `scripts/proof-travel-bottle-hotel.mjs`
- `scripts/proof-travel-bottle-product.mjs`
- `scripts/runtime-proof/`
- `tmp-eas-*.json`, `tmp-entry.js`, `tmp-explore-verify/`, `tmp-vercel-inspect.json`, `tmp-ws*.json`
- `dist-rc-web/`

### Untracked artifacts (proof/captures; not in native binary)

- Many under `artifacts/**` including this folder `artifacts/runtime-proof/ceo-device-test-recovery/`
- `artifacts/exp-dna/`, `hotelier-fix/`, `image-pass/`, `list-cards/`, `profile-hero/`, experiences-price extras, etc.

---

## Completed this session (approved steps that were missing)

1. Confirmed profile fix commit `605cb4c`.
2. Redeployed tip web → `dpl_99CN4rd8ZZSUk6XDbpNjNFyFEdNY` with Stripe LIVE OFF for that build.
3. Playwright + bundle probe `/profile` → **PASS**.
4. Fresh EAS preview Android + iOS from tip `2bbf93b` → prefer **vc21 / bn45**.
5. Lifecycle More fix already at tip (`2bbf93b`); no further code commit required.
6. Device install/QA still blocked (honest adb empty).
