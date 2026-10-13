# P0 device blockers — fix + rebuild evidence

**Branch:** `repair/guest-app-regression`  
**Baseline ancestor:** `6b2a346` (preserved)  
**Failed RC:** `dcd786a`  
**Fix commit:** `fee613065defea1f2b45492515b4f9e6c121d461`  
**Physical devices:** **NOT VERIFIED** (no adb device; no owner retest yet)

## Root causes

### iOS (P0-A)
- Post-intro / redirect went to `/home` (TripHomeScreen) instead of approved `/bandits` → “new app experience”.
- Native gate could remain on dark `loading` if AsyncStorage hung → nothing clickable.
- Bottle step used `VideoView` with no Skip; native video can intercept touches on iOS.

**Files:** `app/index.tsx`, `components/OpeningIntroScreen.tsx`

### Android (P0-B)
- More tab mounts `app/(tabs)/menu.tsx` (rewritten vs baseline).
- Crash vectors addressed without removing destinations: emoji/VS16 (e.g. 🛎️), Yoga `%` width + `gap`, Pressable `transform` + elevation, ExpoImage decode, uncaught lifecycle refresh.
- No device logcat available (no adb device attached this session) — root cause is code-traced, not logcat-confirmed.

**Files:** `app/(tabs)/menu.tsx`, `lib/guest-lifecycle/useGuestLifecycle.ts`

## Same-SHA EAS preview builds

| Platform | Build ID | Artifact |
|----------|----------|----------|
| Android | `6bed5ee6-28d7-4bec-8cd5-480dadef0197` | https://expo.dev/artifacts/eas/84XPR1doHOsmdkB5H4MTudbj-0dgcfIimvDSjm2EEYE.apk |
| iOS | `46050ddd-7cd5-46b8-aa94-afbe632c1c19` | https://expo.dev/artifacts/eas/LucdJfVCsW6eiZ2jDSxeaZYHTMQMweqXm8wy4Km5148.ipa |

Both report `gitCommitHash=fee613065defea1f2b45492515b4f9e6c121d461`.

## Owner retest only
1. Intro opens + progresses  
2. First tap after Enter works on Guest App  
3. More opens repeatedly + navigate away/back  

No production deploy.
