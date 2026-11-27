# Guest App — Canonical Source Control (LOCKED 2026-11-26)

## Canonical

| Field | Value |
|-------|--------|
| Local working directory | `C:\Users\blonj\guest-explore-maps-fix` |
| GitHub repository | `https://github.com/bandit-tour/bandits` |
| Production branch | `production/guest-app` |
| Production baseline commit (was live before Places guard) | `f72c38a9ec8d331b60f42c4cbff47d0511943acd` |
| Vercel project | `bandits` (`prj_V9Fsr4pTjyGvIgalyD3JOUN0l2Dw`) |
| Production alias | `https://bandits-two.vercel.app` |

## Permanent deployment guard

Enforced by `scripts/assert-guest-canonical-deploy.mjs` on every `npm run build` / Vercel `buildCommand`.

Rejects:

- GitHub `main` / `master` (SafeKey-contaminated)
- Incorrect git remotes (not `bandit-tour/bandits`)
- Incorrect Vercel project IDs / names
- SafeKey-contaminated trees (`package.json` name `safekey`, Documents\bandits)
- Missing `CANONICAL.md` / non-Expo product trees

Production branch required when `VERCEL_ENV=production`.

## Do NOT deploy from

| Path | Reason |
|------|--------|
| `C:\Users\blonj\Documents\bandits` | Contaminated with SafeKey (`package.json` name `safekey`); previously linked to this Vercel project |
| `main` on GitHub | Currently SafeKey history — not Guest App |
| Random folder without this file | Risk of wrong product on production |

## Other trees (preserved as backups — not deleted)

| Tree | Role |
|------|------|
| `deploy-guest-5d0b09a` @ `28e10f8` | Reconciliation review branch; Athens recovery scripts reconciled into canonical |
| `Documents\bandits-recovery-6b2a346` @ `6b2a346` | Older iOS QA ancestor — archival |
| `Documents\bandits-octopus-10` @ `64e105d` + WIP | Octopus WIP; Places financial guard sourced from here |
| `bandits-source-backups-20261126\` | Git bundles + META for all trees |

## Cross-system notice

Partner Platform and Workspace System rules point here:

- Partner: `.cursor/rules/guest-app-canonical.mdc` + `web/src/lib/guest-app-canonical.ts`
- Workspace: `.cursor/rules/guest-app-canonical.mdc` + `src/lib/guest-app/architecture-lock.ts`

## Platforms

- Web: Expo export → `dist` (Vercel)
- iOS / Android: same Expo app (`com.yuvaldafni.bandits`) via `app.json` / `app.config`

## Google Places

Fail-closed via `lib/placesFinancialGuard.ts` (Case 78008922). No live Places until explicit founder re-enable.

## Stripe

Stripe LIVE remains OFF for Guest App commercial rails until founder enablement.
