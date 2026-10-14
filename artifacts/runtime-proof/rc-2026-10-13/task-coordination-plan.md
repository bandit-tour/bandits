# Guest App parallel-task coordination plan

**Owner (sole integrator):** Final QA recovery on `repair/guest-app-regression`  
**Written:** 2026-10-14  
**Canonical:** https://bandits-two.vercel.app — **NO production deploy**  
**Baseline `6b2a346`:** historical reference only — **no pilot rollback**  
**Physical device:** **NOT VERIFIED** until owner retest

---

## 1. File ownership map

| Zone | Paths | Owner while Gate 1 open | Other tasks |
|------|-------|-------------------------|-------------|
| **NAV LOCK (exclusive)** | `app/**/bandit*`, `app/moment/**`, travel-stories / `profileMemory` attribution links, `components/AppEscapeNav.tsx`, `app/(tabs)/_layout.tsx`, `components/UpperTabScreens.tsx`, `components/MainBottomNav.tsx`, `app/index.tsx`, `components/OpeningIntroScreen.tsx`, `hooks/useAppBack*`, router redirects in guest chrome | **Integration owner (YOU)** | No edits |
| **Stage1 landed @ `52e878a`** | `app/bandit/[id].tsx`, `app/moment/[id].tsx`, `app/services/bandits.ts`, `lib/guest-workspace/registeredBanditIds.ts`, `lib/guest-workspace/profileMemory.ts` (UUID seed), `app/(tabs)/profile.tsx` (sample banner), `app/(tabs)/bandits.tsx` (skeleton timeout), `components/BanditHeader.tsx` (Stage2 partial) | **Frozen for Gate 1 owner install** | No rewrite |
| **Onboarding audit (6775da89)** | Docs only: `artifacts/.../first-time-guest-onboarding-journal.md` | **AUDIT-ONLY** | Impl **after Gate 1** (Patch A/B/C) |
| **TiB / SmartTraveler (7657aec7)** | Docs: `tib-hotels-smarttraveler-gap-report.md`; live clients `liveBottle.ts`, `liveSmartTraveler.ts`, `travelBottle.tsx`, `smarttraveler.tsx` | **Workspace-BLOCKED** — no Guest inventing media/coupons | Hold |
| **Fix batches P0 (A–I)** | Explore map pad, Between Trips, More/bandiTEAM, Premium/payments copy, bottle video polish | **HOLD** overlapping routes until Gate 1 | Resume Gate 2+ |
| **Stage 3 messaging** | `lib/chatThreads.ts`, `lib/guest-moment/*`, `app/bottleDiscover.tsx`, `app/chat.tsx`, `app/localFriend.tsx`, Notifications vs Chat | **HOLD until Gate 1** (incomplete WIP reverted) | Gate 2 |
| **Stage 4 commerce env** | EAS preview env vars; `lib/octopus-concierge/entitlement.ts` guest-facing strings | **HOLD until Gate 1** (env set OK without nav conflict in Gate 2) | Gate 2 |
| **Matrix / artifacts** | `artifacts/runtime-proof/guest-app-regression-matrix-2026-10-13.md`, this plan, RC notes | **Integration owner** | Additive only |

**Superseded:** Standalone “P0 Story→Local banDit nav” task — **merged into Stage1 @ `52e878a`**. No second nav rewrite.

---

## 2. Dirty tree / conflict risks (now)

| Item | Risk | Action taken |
|------|------|--------------|
| HEAD `52e878a` ahead of origin by 2 | Push optional; builds already uploaded from local SHA | Keep tip for install |
| `M .env` | Secrets — **never commit** | Leave local |
| Incomplete Stage3 WIP: `lib/chatThreads.ts` + `openingIntroChat.ts` | Would collide with Gate1 narrative / Chat | **Reverted / deleted** — tree clean for Gate 1 |
| Untracked proof artifacts / `.expo-check-*` | Noise only | Do not commit |
| Parallel agents editing NAV LOCK | Overwrite risk | **STOP** — sole owner rule |

---

## 3. Work already completed

### Stage 1 CODE PASS @ `52e878af3ea84f6bdb79186109972cb08be9450e`

- Story → Open Local banDit: real registered UUIDs; hide CTA if unresolved  
- `getBanditById` rejects non-UUID; error/loading screens have Back + Home (`AppEscapeNav`)  
- Tabs `overflow: 'hidden'`  
- Local banDits 8s skeleton timeout  
- Profile SAMPLE banner (partial Part F honesty)  
- Stage2 partial: Neo personal photos only; map left of gallery; Octopus → Your Local Insider  

Evidence: `artifacts/runtime-proof/rc-2026-10-14/stage1-attribution-verify.json`

### SAME-SHA EAS preview @ `52e878a` — **FINISHED**

| Platform | Build ID | Status | Detail page | Install artifact |
|----------|----------|--------|-------------|------------------|
| **iOS** | `5a1ad004-7a64-4e8d-b0c0-9eb39c8d8150` | **FINISHED** | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/5a1ad004-7a64-4e8d-b0c0-9eb39c8d8150 | https://expo.dev/artifacts/eas/-ymv9nd-2-vab5AywTDgy8MbzKSSbQzFajgplsiOPpg.ipa |
| **Android** | `8b5f2fd3-74dc-4ff2-96e7-ac8c7e3b8093` | **FINISHED** | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/8b5f2fd3-74dc-4ff2-96e7-ac8c7e3b8093 | https://expo.dev/artifacts/eas/lAHzgMwfFAbVZTzTeYqipcUrIN26ndgDHeXGtzBMgV4.apk |

Login: `banditeam121275`  
Commit on both builds: `52e878af3ea84f6bdb79186109972cb08be9450e`  
**Physical: NOT VERIFIED**

### Audits (no Guest inventing)

- Onboarding journal: `first-time-guest-onboarding-journal.md` — **AUDIT-ONLY** until Gate 3  
- TiB / SmartTraveler: `tib-hotels-smarttraveler-gap-report.md` — **Workspace-BLOCKED**

---

## 4. Integration order — ONE controlled sequence

```text
Gate 1 (NOW)  → Owner install @ 52e878a iOS+Android
              → Acceptance A–E (Story↔banDit Back/Home; tabs; no dead-end)
              → CODE/browser checks OK; PHYSICAL = owner
              → NO Stage3–5 code; NO onboarding impl; NO batch overlap

Gate 2        → After Gate1 owner-ready (or explicit unblock)
              → Stages 3–5 + non-overlapping fix batches
              → EAS preview env Workspace/Orchestra URLs
              → Guest-facing hide env-var errors; no LIVE Stripe
              → If new commits → SAME-SHA iOS+Android rebuild

Gate 3        → Onboarding impl ONLY after Gate1
              → Empty Travel stories for ordinary guests
              → Gate PLAY resetLifecycleToDemoActiveStay
              → Verified sign-in before Reply/save (preserve bottle session)
              → Do not invent journal events

HOLD forever (until Workspace) → TiB hotel multi-photo inventory + ST coupons
```

---

## 5. First release gate (Gate 1) — Back/Home/nav

Owner must retest on **both** builds (@ `52e878a`):

| ID | Check | Pass means |
|----|-------|------------|
| A | Profile → Travel stories → Story → **Back** → Profile | Stack back works |
| B | Story → valid Local banDit → **Back** → Story → **Back** → Profile | Nested back works |
| C | Story → unavailable / bad id → recoverable error → **Back** + **Home** | No dead-end |
| D | Bottom tabs Home / Explore / Hotel / LF / Chat / More respond | Modern shell |
| E | No stuck full-screen trap without escape | Overlay/touch OK |

**GO for Gate 1 owner retest:** YES (builds FINISHED)  
**GO for production:** **NO**  
**GO for LIVE Stripe:** **NO**  
**Physical PASS:** **NOT VERIFIED** until owner

---

## 6. Next single action

**Stop coding Stages 3–5.** Deliver Gate 1 install pair to owner for physical A–E retest.  
Integration owner waits for owner PASS (or explicit unblock) before Gate 2.

Optional (docs only, no nav rewrite): update matrix row with FINISHED build URLs — already reflected here.
