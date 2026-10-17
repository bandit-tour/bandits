# Install links — browser↔phone parity

## Prefer tip builds (`c9b6bf7` — Guest completion + profile fix + concierge voice)

| Platform | Build ID | Artifact |
|----------|----------|----------|
| **Android APK** 1.0.2 (19) | `33c3a52e-da11-4871-95b2-d59bdfb4795b` | https://expo.dev/artifacts/eas/Q73wklYQQsl5FkGRb7F3AA3xEsl68I-6jR3WAVILJrE.apk |
| Android page | same | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/33c3a52e-da11-4871-95b2-d59bdfb4795b |
| **iOS Ad Hoc IPA** 1.0.2 (43) | `2c023dd7-0931-4fbb-a1f8-cd46fffb0e6a` | https://expo.dev/artifacts/eas/PnvW_DVKzYohWfAf01r4PYB4quTfILMf91-PtOk_tVM.ipa |
| iOS page | same | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/2c023dd7-0931-4fbb-a1f8-cd46fffb0e6a |

iOS Ad Hoc only on UDID `00008110-0019248C0A9A401E`.

## Fallback — Guest completion only (`a1ec0c0`)

| Platform | Build ID | Artifact |
|----------|----------|----------|
| Android 1.0.2 (17) | `ad11e51b-aa36-4dc2-9b2f-1860e8a6623b` | https://expo.dev/artifacts/eas/Dn6yagonhBZVenv-fAfki-cHufME24LV-LxfBvfzPDE.apk |
| iOS 1.0.2 (41) | `62213240-b99f-494e-85a3-80d43f303f2b` | https://expo.dev/artifacts/eas/mW_uKQVCjenMk2WuF-q4qydD5U_XjpyDklxEDck_S3A.ipa |

## TestFlight

**BLOCKED** — `eas submit` needs `ascAppId` in `eas.json` `submit.production`; preview profile is internal Ad Hoc, not App Store.
