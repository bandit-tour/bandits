# Guest App source-control closure — 2026-11-26

## Production serving now
- URL: https://bandits-two.vercel.app
- Deployment: dpl_GaGEB4PpKeQvBtHSrLG8T4KP7tWV
- Product: bandiTour Guest App (SafeKey NOT present)
- Commit: 95a28c82c8f0f2187c98749eec63afafe432e144 (production/guest-app)

## Why this tree won
1. Live production before this closure matched f72c38a (repair/guest-app-regression) — commit 10:09 UTC, deploy 10:16 UTC (dpl_BZof4Fy6…).
2. That tip already contained brand intro + Explore photo recovery + iOS/Android Expo identity.
3. Places fail-closed guard was missing there; ported from octopus WIP and deployed.
4. Legitimate deploy-guest product fixes (live-publish honesty, hotel white-label, Athens recovery scripts) cherry-picked.

## Rejected as canonical
- Documents/bandits: SafeKey package, contaminated Vercel link (neutralized)
- GitHub main: SafeKey history — do not deploy
- recovery 6b2a346: ancestor only
- octopus 64e105d: behind maps-fix tip; used as Places-guard source only
- deploy-guest 28e10f8: valuable commits reconciled; not the production tip

## Backups
C:\Users\blonj\bandits-source-backups-20261126\ (git bundles + META; nothing deleted)

## Platforms
ios/android package: com.yuvaldafni.bandits (same Expo app.json)
