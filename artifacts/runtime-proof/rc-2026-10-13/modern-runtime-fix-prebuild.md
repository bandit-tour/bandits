# Pre-build report — modern Guest App runtime recovery (approved)

**Branch:** `repair/guest-app-regression`  
**Base app SHA:** `fee6130`  
**Decision:** intro → modern TripHome `/home`  
**Pilot `d8184bc6` @ `6b2a346`:** reference only — not product

## Root cause (modern product)

1. **Post-intro destination wrong for approved product:** tip still sent Enter/Skip to `/bandits` after `fee6130` “restore”; owner approved **modern TripHome `/home`**.
2. **iOS touch risk:** bottle `VideoView` can intercept hits; upper-tab absolute overlay must not remain interactive when Home is active (overlay must unmount on `/home`).
3. **Boot gate:** keep fail-open from intro gate so dark `loading` cannot stick forever (already on tip; retain).

## Planned file changes (minimal)

| File | Change |
|------|--------|
| `app/index.tsx` | `finish` + `Redirect` → `/home`; comment = modern TripHome |
| `components/OpeningIntroScreen.tsx` | Keep full intro; VideoView `pointerEvents="none"`; bottle Skip retained |
| `app/(tabs)/_layout.tsx` | Overlay only when upper tab active; `pointerEvents="auto"` when shown; ensure Home path has **no** overlay mount |
| Ownership doc | Complete source-of-truth report (no product code) |

**Not changing:** `MainBottomNav` (modern 6 tabs), TripHome, Explore/Hotel/LF/Chat/More screens, backends, screenshot QA batches.

## Checks before EAS

- Source assert: post-intro href is `/home`
- Modern nav labels present in `MainBottomNav`
- No pilot nav labels in tip `MainBottomNav`
