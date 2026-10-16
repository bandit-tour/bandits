# WEB-QA-05 — Expo Web runtime crash (P0)

## Exact error (Expo Metro)

```
ERROR  TypeError: Duplicate declaration "useUpperTabHost"
    at File.buildCodeFrameError (.../@babel/core/.../file.js:189:12)
```

**Failing route / module:** `/smarttraveler` → `app/(tabs)/smarttraveler.tsx`  
**Symptom:** Full-screen Expo red/pink Uncaught Error overlay (Babel transform failure during HMR / module load).

## Root cause

A bad edit briefly introduced **two** `import { useUpperTabHost } from "@/contexts/UpperTabHostContext"` declarations in `smarttraveler.tsx` (one mid-file during a botched insert, one at top). Babel rejects duplicate bindings → Metro surfaces the pink runtime overlay and replaces the Guest App UI.

Intent of the change was correct (match Explore/Bandits: don’t double-mount when `UpperTabScreens` hosts the rail), but the duplicate import was fatal.

## Fix

- Single top-level `useUpperTabHost` import
- `SmartTravelerRoute` returns `null` when upper-rail host is enabled
- Also moved maps `Linking` helpers out of `shopGeo` into `lib/maps/openDirections.ts` (keeps geo module clean; preserves Directions on product detail)

## Verification

- `app/(tabs)/smarttraveler.tsx` Metro bundle → 200, no TransformError
- Browser `/smarttraveler` → SmartTraveler UI, no Uncaught overlay
- HTTP smoke: `/`, explore, hotelier, experiences, smarttraveler, alerts, shop, menu, bandits, product, experience detail, report, localFriend, community → all 200

## Evidence

- Expo log: `terminals/667794.txt` (`Duplicate declaration "useUpperTabHost"`)
- Screenshot: `web-qa-05-smarttraveler-after-fix.png`
- HTTP: `http-smoke.json`
