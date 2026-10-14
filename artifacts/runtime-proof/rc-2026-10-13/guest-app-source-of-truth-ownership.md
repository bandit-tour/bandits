# Guest App — source of truth & deployment ownership

**Date:** 2026-10-14 · **No deploy / no bug-batch implementation this file**

## 1. Is this Cursor `bandits` repo the source of truth for PLAY Theatrou Guest App on bandits-two.vercel.app?

**YES — confirmed.**

| Evidence | Value |
|----------|--------|
| `package.json` name | `bandits` |
| `app.json` expo name / slug | `bandiTour` / `bandits` |
| EAS | `owner: banditeam121275`, `projectId: 02867d6d-fb41-4f54-80ad-aae3d6831060` → `@banditeam121275/bandits` |
| Associated domains / Android intent hosts | `bandits-two.vercel.app`, `bandit-tours.vercel.app` |
| `EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL` (.env.example) | `https://bandits-two.vercel.app/hotel/play-theatrou` |
| Git remote | `http://github.com/bandit-tour/bandits.git` |
| `vercel.json` | Expo web `dist` SPA + `/api/*` rewrites for this app |
| Internal proofs | `tmp/guest-shell-proof`, unlock proofs alias **bandits-two.vercel.app** → Vercel project **bandits** under `bandiexchas-projects` |

**Wrong product note:** EAS build `d8184bc6` @ `6b2a346` was pilot UI rollback — **not** this modern Guest App.

Branch for modern work: `repair/guest-app-regression` (baseline `6b2a346` = reference only).

## 2. Shared database / backend / APIs (no secrets)

| System | Role | Host / origin (non-secret) |
|--------|------|----------------------------|
| **Supabase** | Primary Guest App DB/auth | `zubcakeamyfqatdmleqx.supabase.co` (from audits / configured URL host) |
| **banditour-workspace** | Workspace APIs (unlock, lifecycle, reflection, traveler) | `https://banditour-workspace.vercel.app` (`EXPO_PUBLIC_WORKSPACE_URL`) |
| **Orchestra OS / Commerce** | Separate OS snapshots / commerce — **do not duplicate inside banDiTour** | `EXPO_PUBLIC_ORCHESTRA_OS_URL` (optional; client in `lib/orchestra/*`) |
| **Stripe / entitlements** | Workspace-owned | Via Workspace / Orchestra commerce helpers — not a second Guest App |

Client wrappers: `lib/workspace/actions.ts` (`postGuestReflection`, collections, hotel_request, traveler services), `lib/orchestra/*` (subscribe/publish only).

## 3. Workspace Guest App capabilities that look thin/missing in this banits UI

From `lib/workspace/actions.ts` + phase-16 docs under `c:\Users\blonj\banditour workspace system` (read-only; Workspace app dir not under Documents):

| Capability | In banits repo | Gap |
|------------|----------------|-----|
| Reflection API client | Present (`postGuestReflection` / `fetchGuestReflection`) | **UI bindings incomplete** (QA-19 / GUEST-INT-1.0) — Journey / Composer / Maya / OwnerQA shells **not** mounted as full Workspace Guest surfaces |
| Spot collections / traveler services / hotel_request | API actions present | Product UI partial / Workspace-dependent |
| Live Orchestra subscribe | Present | OS itself stays external |

**Do not rebuild a second Guest App** — bind/fix this one; leave Orchestra OS separate.

## 4. Deploy & device test path (constraints)

| Channel | Target | How |
|---------|--------|-----|
| **Web production** | https://bandits-two.vercel.app | Vercel project **bandits** (`bandiexchas-projects`); build = `npm run build` → `dist` per `vercel.json` |
| **Native preview** | EAS `@banditeam121275/bandits` profile `preview` / internal | Owner login `banditeam121275` for install pages |
| **Constraint** | **NO production deploy** until owner verifies modern runtime | Screenshot/UI bug batches remain queued |

iPhone/Android can install EAS internal builds; web QA on bandits-two after explicit deploy approval only.

## 5. Preserve

Working modern features, user data (Supabase), Workspace/Orchestra integrations, screenshot QA matrix, and repair branch history. **No rebuild of another Guest App. No pilot UI rollback.**

## 6. Queued bug batches (NOT started this turn)

Premium/Neo · Explore map clip · More/bandiTEAM/Bottle nav · Between Trips Home trap · Octopus payments · persistent traveler · Moments/bottle/chat · Local Friend distinction · bottle video · SmartTraveler copy — **queued for controlled batches after ownership + modern runtime recovery**.
