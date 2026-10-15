# Emergency native recovery report — 15 Oct 2026

> **Appended:** Build-to-source discrepancy audit + Hotel/Profile P0 inventory — see `build-to-source-discrepancy-audit.md` (same folder). Owner must stop testing `dcd786a`.

**Branch:** `repair/guest-app-regression`  
**Tip at diagnosis start:** `ca72b87` (docs) · product Gate1: `52e878a`  
**Recovery product SHA:** `cfdd68d` (P0) · EAS gitCommitHash **`02e9fe1`** (docs tip; SAME-SHA both platforms)  
**Baseline protected:** `6b2a346` (historical only — no pilot rollback)  
**Customer:** https://bandits-two.vercel.app — **NO production deploy**  
**Workspace:** https://banditour-workspace.vercel.app  
**Physical:** **NOT VERIFIED** in this environment (no attached iPhone/Android console)  
**Verdict:** **NO-GO** for production · builds/static tests ≠ product proof

---

## 0. Which SHA did the owner fail?

| Claim | Evidence |
|-------|----------|
| Owner cites **`dcd786a`** | Explicit in this emergency brief |
| Matrix label for `dcd786a` | **Broken RC — do not use for owner retest** (`guest-app-regression-matrix-2026-10-13.md`) |
| Gate1 install pair | iOS `5a1ad004…` + Android `8b5f2fd3…` @ **`52e878a`** FINISHED 14 Oct — **physical NOT VERIFIED**; no evidence owner installed them |
| Lineage | `dcd786a` ⊂ ancestor of `52e878a` ⊂ tip. `dcd786a` **lacks** fee6130 More harden, 278be08 intro→`/home`+overlay, 52e878a Story→banDit Back/Home + `overflow:hidden` |

**Conclusion:** Highest-likelihood failure identity = **stale broken RC `dcd786a`**, not Gate1 `52e878a`. Must still harden tip and ship a **new SAME-SHA recovery pair** so owner cannot confuse builds; require delete-app reinstall.

---

## 1. P0 failure diagnosis (slow / freeze / eject)

| Symptom | Likely mechanism on `dcd786a` | Status on `52e878a` / tip | Device |
|---------|------------------------------|---------------------------|--------|
| Slow / freeze / eject | Pre-fee6130 More emoji/Yoga crash vectors; missing iOS `overflow:hidden` hit-bleed; heavy Explore first paint | Partially mitigated: More harden (`fee6130`), overflow restored (`52e878a`), intro→`/home` (`278be08`) | **NOT VERIFIED** |
| iPhone More eject | Unsafe Text/emoji / layout / Pressable transform on More | Hardened in fee6130; recovery replaces spa `💆` → `✦`; logout → `/home` | Code mitigated · **NOT VERIFIED** |
| Android Explore freeze | Large FlatList + hero resolve + `InteractionManager.runAfterInteractions` deferring nav | **Recovery:** immediate bandit nav (no InteractionManager defer); city-wide fetch when no `banditId` | **NOT VERIFIED** |
| Dead bottom taps | Native stack covering tab bar without `overflow:hidden` | Restored on `52e878a` | **NOT VERIFIED** |
| Intro missing | AsyncStorage `opening_intro` skip across reinstalls | Same keys — delete app required | Expected |

**Instrumentation:** No device logcat/Xcode in agent env. Code + git + prior diagnosis (`ios-touch-diagnosis-278be08.md`) only.

---

## 2. Navigation audit (More / Explore / Hotel)

| Surface | Expected | `dcd786a` risk | Tip action |
|---------|----------|----------------|------------|
| More → Profile / Account / Safety / Stay modules | Push routes; no crash | Emoji/Yoga eject | Spa `💆`→`✦`; logout → `/home`; nav log on menu.go |
| Explore → categories / spots / map | City venues by category (not Local-banDit-only unless `?banditId=`) | Heavy list freeze | Immediate nav (no InteractionManager defer); keep city-wide default |
| Hotel → stay / Between Trips | Hotel companion; Between Trips only after checkout | Home trap / wrong Back to `/bandits` | Between Trips on Hotel; Home escape → `/home`; Home soft banner only (no AfterTripHome trap) |
| Bottom tabs | Home\|Explore\|Hotel\|LF\|Chat\|More | Hit-bleed | Keep `overflow:hidden` |

---

## 3. Screenshot defect matrix (owner backlog)

| Area | Classification | Notes |
|------|----------------|-------|
| Story→banDit dead-end | **CODE FIXED @ 52e878a** — runtime NOT VERIFIED | UUID attribution + Back/Home |
| Neo photos / map left / Octopus | **CODE PARTIAL @ 52e878a** | Personal gallery only; map beside photos |
| Explore map clip | OPEN / prior pad | Re-check on recovery build |
| Sample Travel stories | PARTIAL honesty banner | Gate3: empty for ordinary guests |
| TiB hotel multi-photo | **Workspace-BLOCKED** | No invent |
| SmartTraveler coupons | **Workspace-BLOCKED** | Privilege-only; simplify €19 messaging without LIVE CTA |
| Bottle → Chat | PARTIAL | Gate2 |
| Double-sided opening | PARTIAL | Gate2 |

---

## 4. Prior 19-item QA vs tested build

| QA set | vs `dcd786a` (owner fail) | vs `52e878a` (Gate1) |
|--------|---------------------------|----------------------|
| QA-01…19 matrix | Mostly **OPEN / unproven** on that RC | Many **CODE FIXED — RUNTIME NOT VERIFIED** |
| S1-A1/A2/A3/F | **Absent** on dcd786a | Present in code |
| Physical PASS | **FAIL** (owner) | **NOT VERIFIED** |

Do **not** mark PASS from Gate1 code alone.

---

## 5. Data / imagery audit

- Neo: real `image_url` + `face_image_url` in Supabase (proven anon session earlier).  
- Explore venues: live `getEvents` + recommendation heroes; null ≠ PASS.  
- TiB hotel galleries: Workspace config hero-only — **BLOCKED**.  
- No invented photos in recovery.

---

## 6. Bottle / Chat QR → conversation

Path: QR → `resolveGuestBottleOpening` → `/bottleDiscover` → Chat params / `guest_moment` thread.  
Mode B ocean mapping exists; Mode A durable chat **PARTIAL**.  
`guest_moment` Chat listing incomplete on tip (Stage3 HOLD reverted) — **OPEN for Gate2**.

---

## 7. iOS / Android parity

| Platform | Gate1 build @ 52e878a | Owner fail cite |
|----------|----------------------|-----------------|
| iOS | `5a1ad004…` FINISHED | More eject (likely old RC) |
| Android | `8b5f2fd3…` FINISHED | Explore freeze (likely old RC) |

Separate: agent **cannot** claim physical parity. New recovery builds required after P0 tip fixes.

---

## 8. Exact commits / config / evidence

| SHA | Role |
|-----|------|
| `6b2a346` | Protected baseline / historical |
| `dcd786a` | Owner-cited FAIL · broken AAPT RC · **do not retest** |
| `fee6130` | Android More harden (but intro briefly → `/bandits`) |
| `278be08` | Intro → `/home` + overlay unmount |
| `52e878a` | Stage1 Story→banDit + overflow + escapes |
| `ca72b87` | Coordination docs only |
| `cfdd68d` | **Emergency P0 recovery** (product code) |
| `02e9fe1` | Docs tip · **EAS SAME-SHA** iOS+Android |

EAS login: `banditeam121275` · preview profile.

| Platform | Build detail | Artifact | Status |
|----------|--------------|----------|--------|
| Android | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/2984ce18-987a-4d5f-a9d0-30140be4dbbf | https://expo.dev/artifacts/eas/bM2WRDQBD6TsQ5lqetqQXXUUiMUZQo-rv1wbA9p8GEo.apk | **FINISHED** @ `02e9fe1` |
| iOS | https://expo.dev/accounts/banditeam121275/projects/bandits/builds/07278794-6886-49f1-bd90-69d63993c799 | https://expo.dev/artifacts/eas/9Gchf2rktttq64GoA9NB8kZ74Vy-yk0vODQrVJ1KZEk.ipa | **FINISHED** @ `02e9fe1` |

Build FINISHED ≠ physical PASS.

---

## 9. Workspace blockers + API requirements

| Need | Owner |
|------|-------|
| Hotel multi-image / inventory for TiB | Workspace public hotel config |
| SmartTraveler coupons / discount codes | Workspace rejects coupons — privilege only |
| Commerce TEST checkout | Set `EXPO_PUBLIC_WORKSPACE_URL` + `EXPO_PUBLIC_ORCHESTRA_OS_URL` = `https://banditour-workspace.vercel.app` in EAS preview; **no LIVE Stripe**; no env strings in guest UX |
| Octopus Verified sampling (~10) | Workspace auth |

---

## 10. Controlled next-release plan

1. **STOP** treating `dcd786a` as current product.  
2. Land **minimal P0 tip fixes** (this recovery commit) — **DONE in code** (see §11).  
3. SAME-SHA iOS+Android preview from **new HEAD** — see matrix when EAS FINISHED.  
4. Owner: **delete app** → install both → A–E + More/Explore/Hotel smoke.  
5. Gate2+: messaging, onboarding empty journal, PLAY demo-stay gate — after physical recovery PASS.  
6. No prod deploy · no LIVE Stripe · no Guest App rebuild · no Orchestra strings in customer UX.

### Owner test steps (after new builds)

1. Delete existing `com.yuvaldafni.bandits` (clears intro + session).  
2. Install **new** iOS + Android pair (same SHA — see matrix).  
3. Cold open → intro appears → Enter → Home.  
4. Tap each bottom tab (Explore, Hotel, LF, Chat, More) — must navigate within 1s feel.  
5. More → Profile → Travel story → Open Local banDit → Back → Home.  
6. Explore → change category → open a venue → Back (Android: no multi-second freeze).  
7. Hotel → any stay module or Between Trips → ← Home.  
8. Report FAIL with **build detail URL + platform**, not commit guess alone.

---

## 11. P0 code landed this recovery (awaiting SAME-SHA EAS)

| Fix | Files | Intent |
|-----|-------|--------|
| Home never traps in full Between Trips | `TripHomeScreen.tsx` | Soft banner + CTAs; Between Trips stays on Hotel |
| Hotel ← Home → `/home` | `hotelier/index.tsx` | Escape from Hotel/Between Trips |
| Explore bandit press immediate | `explore.tsx` | Drop `InteractionManager` defer (Android freeze feel) |
| More spa emoji harden + logout `/home` | `menu.tsx` | iPhone More eject residual + session route |
| Guest escapes → `/home` | `localFriend`, `bottleDiscover`, `quickProfile`, `hotel/.../experience` | Auth/route stability off pilot `/bandits` shell |

**Physical:** still **NOT VERIFIED**. Do not claim PASS from this table alone.

**EAS:** BOTH platforms **FINISHED** @ `02e9fe1` — Android APK + iOS IPA linked in §8. Physical **NOT VERIFIED**.
