# FINAL OWNER REQUIREMENT-BY-REQUIREMENT MATRIX — 15 Oct 2026

**Branch:** `repair/guest-app-regression`  
**Product tip (this RC):** `d33cb57`  
**Protected baseline (ancestor only):** `6b2a346` — not product target; no pilot rollback  
**Canonical Guest App:** this Expo repo only (`@banditeam121275/bandits`)  
**Production deploy:** **NOT DONE · NO-GO**  
**Physical iPhone / Android:** **NOT VERIFIED** in this environment (no false PASS)

Status tags:
- **IMPLEMENTED** — guest-owned code/data correction present in tip
- **WORKSPACE-BLOCKED** — external commerce / inventory / auth; handoff documented
- **RUNTIME CODE** — automated or script evidence this session
- **PHYSICAL NOT VERIFIED** — never claim device PASS here

Workspace handoffs: `workspace-handoffs.md` (same folder).

---

## A. Discrepancy-audit / emergency backlog

| ID | Original requirement | Exact implemented correction | Commit / file evidence | Automated / runtime | iOS | Android | Remaining blocker |
|----|----------------------|------------------------------|------------------------|---------------------|-----|---------|-------------------|
| **A1** | Home: one primary featured banDit; no Neo×3 (hero + lane + City Guide/routes) | Featured hero kept; lane **excludes** featured id; Home “What’s next” no longer duplicates City Guide/routes for featured | `components/TripHomeScreen.tsx`, `components/ExploreBanditLane.tsx` (`excludeBanditId`) | Code inspection | NOT VERIFIED | NOT VERIFIED | None guest-owned |
| **A2** | City Guide / map as **corner overlay on banDit photo** | Absolute `cityGuideOnPhoto` control on mobile + desktop gallery; map preview + “+ City Guide” | `components/BanditHeader.tsx` (`testID=bandit-city-guide-on-photo`) | Code inspection | NOT VERIFIED | NOT VERIFIED | None guest-owned |
| **A3** | Octopus Verified beyond Neo (~10) | Guest still renders badge **only** from Workspace visibility API; no fabricated list | `lib/guest-app/premium-visibility.ts`, BanditHeader | N/A invent | NOT VERIFIED | NOT VERIFIED | **WORKSPACE-BLOCKED** H2 |
| **A4** | Concise €19 / Your Local Insider: headline, price, ≤3 benefits, one CTA, guest-safe errors, checkout gated | Sales page collapsed to 3 benefits + single unlock CTA; gated when `state===unavailable`; guest-safe commerce copy | `app/premium/[id].tsx`, `lib/octopus-concierge/entitlement.ts`, `lib/workspace/client.ts`, `eas.json` preview env | Code inspection | NOT VERIFIED | NOT VERIFIED | Stripe TEST / LIVE = **WORKSPACE-BLOCKED** H1 |
| **A5** | Venue heroes visible (Spook, Ergon, Kick, Brunchers, Tragos, Fixers, …) | DB Places photo refresh (94 stale rows); Explore live-refresh now includes Google/non-durable URLs (not only missing) | `scripts/refresh-stale-places-photos.mjs` run; `app/(tabs)/explore.tsx`; probe `venue-image-load-probe.json` | **RUNTIME PASS** named 6: HTTP 200 + bytes | NOT VERIFIED | NOT VERIFIED | Ephemeral Places URLs will expire again — refresh script / live path |
| **A6** | QR bottle → Chat (not Notifications-only) | Intro finish seeds Chat-visible mystery thread; bottleDiscover → Chat params / moment thread | `lib/openingIntroChat.ts`, `app/index.tsx`, `app/bottleDiscover.tsx` | Code path | NOT VERIFIED | NOT VERIFIED | Two-account physical proof still required |
| **A7** | P0 nav: More eject, Explore freeze, stale bandiTEAM header | Prior More/Explore harden retained; header title cleared on blur; bandiTEAM pane only sets header when `tabActive`; `/my-profile` unique route | `hooks/useAppBackScreenOptions.tsx`, `app/bandiTeam/index.tsx`, `components/UpperTabScreens.tsx`, `app/my-profile.tsx` (prior `6e3befd`) | Code inspection | NOT VERIFIED | NOT VERIFIED | None guest-owned |
| **P0-1** | Hotel tab actions work or explain stay gate | Module + item CTAs call `claimHotelOffer`; failure → Connect My New Stay | `app/(tabs)/hotelier/[module].tsx`, `item/[itemId].tsx` | Code inspection | NOT VERIFIED | NOT VERIFIED | Live PMS = **WORKSPACE-BLOCKED** H3 |
| **P0-2** | More → My Profile + photo upload, no eject | Unique `/my-profile` with ImagePicker + avatar API; Menu → `/my-profile` | `app/my-profile.tsx`, `app/(tabs)/menu.tsx` | Prior `6e3befd` + this tip | NOT VERIFIED | NOT VERIFIED | None guest-owned |

---

## B. QA-01 … QA-19 (master matrix)

| ID | Original requirement | Exact implemented correction | Evidence | Automated / runtime | iOS | Android | Remaining blocker |
|----|----------------------|------------------------------|----------|---------------------|-----|---------|-------------------|
| **QA-01** | Neo Premium CTA + Octopus only when authorized; valid photos | Badge from visibility API; personal gallery; City Guide overlay | BanditHeader, premium-visibility | Code | NOT VERIFIED | NOT VERIFIED | Octopus list **WORKSPACE** |
| **S1-A2** | Story → Local banDit Back/Home | UUID attribution + escape nav (prior Gate1) | `profileMemory`, `bandit/[id]` | Prior CODE PASS | NOT VERIFIED | NOT VERIFIED | None |
| **S1-A1** | iOS touch/nav Back/Home/Menu | `overflow:hidden`, escape headers (prior) | `(tabs)/_layout`, useAppBack | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **S1-A3** | Local banDits skeleton timeout | 8s timeout → retry (prior) | bandits screen | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **S1-F** | Profile demo-as-real | Sample journal **off** unless `EXPO_PUBLIC_SHOW_SAMPLE_JOURNAL=1`; empty authentic journal | `app/(tabs)/profile.tsx` | Code | NOT VERIFIED | NOT VERIFIED | None |
| **QA-02** | Explore map card clip | Prior `+72` map pad retained | `explore.tsx` | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **QA-03** | bandiTEAM rail / More / checkout invite | Rail order `upperTab`; header stale fix; menu Safety → bandiTEAM | `lib/upperTab.ts`, menu, hub | Code | NOT VERIFIED | NOT VERIFIED | None |
| **QA-04** | Between Trips Home escape | Soft banner on Home; Hotel/AfterTrip escapes → `/home` (recovery) | TripHomeScreen, hotelier | Prior `cfdd68d` + tip | NOT VERIFIED | NOT VERIFIED | None |
| **QA-05** | Connect My New Stay | Menu + Hotel failure CTAs → `/reactivateStay` | menu, hotelier module/item | Code | NOT VERIFIED | NOT VERIFIED | Verified unlock API trust = Workspace |
| **QA-06** | Moments mystery-first + consent | Reveal before Chat (prior + retained) | `bottleDiscover.tsx` | Code | NOT VERIFIED | NOT VERIFIED | Physical two-account |
| **QA-07** | Local Friend social / bottle / Chat | Existing LF + BottleSubmitVideo wiring | `localFriend.tsx`, BottleSubmitVideo | Asset present (.mov 397KB) | NOT VERIFIED | NOT VERIFIED | None |
| **QA-08** | Bottle QR → Chat persistence | Discover → chat thread; intro Chat seed | bottleDiscover, openingIntroChat | Code | NOT VERIFIED | NOT VERIFIED | Durable Mode A edge cases |
| **QA-09** | Bottle throw video | Assets + once-play contract | `.mov` + `play-intro.mp4` (7.5MB) | Asset PASS | NOT VERIFIED | NOT VERIFIED | None |
| **QA-10** | SmartTraveler no FULL_STAY guest sales copy | Exclusive-discount subtitle; demo inventory labeled sample | `smarttraveler.tsx` | Code scan | NOT VERIFIED | NOT VERIFIED | Coupons **WORKSPACE** H5 |
| **QA-11** | Venue heroes card === detail + visible | Gallery-first + Places refresh + Explore live refresh for Google URLs | eventVenueGallery, explore, probe | **Named venues LOAD_OK** | NOT VERIFIED | NOT VERIFIED | Ongoing Places expiry |
| **QA-12** | Carousels no black slides | Failed URI filter in BanditHeader (prior) | BanditHeader | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **QA-13** | First-load Local banDits / Explore | Cache + safe nav; Explore no InteractionManager defer | explore, banditsHomeCache | Prior recovery | NOT VERIFIED | NOT VERIFIED | None |
| **QA-14** | Ask Me / Local Friend delivery | Traveler session JWT path (prior) | resolveTravelerSession | Prior | NOT VERIFIED | NOT VERIFIED | Session edge cases |
| **QA-15** | Distinct badges Inbox ≠ Chat | unreadCount vs chatUnreadCount (prior) | AppState / nav | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **QA-16** | Select/Delete Notifications + Chat | Select modes (prior) | notifications / chat | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **QA-17** | Your Local Insider / Concierge / payments | Concise €19 UX + guest-safe + EAS Workspace URLs; checkout gated until commerce | premium/[id], entitlement, eas.json | Code | NOT VERIFIED | NOT VERIFIED | **WORKSPACE** Stripe TEST |
| **QA-18** | Stay-specific vs persistent | Lifecycle caps (prior) | guest-lifecycle/access | Prior | NOT VERIFIED | NOT VERIFIED | None |
| **QA-19** | GUEST-INT-1.0 UI bindings | Not in Guest tree | search paths empty | N/A | NOT VERIFIED | NOT VERIFIED | **WORKSPACE-BLOCKED** H6 |

---

## C. Intro / Explore / Profile (Oct 15 order)

| ID | Requirement | Correction | Evidence | Auto | iOS | Android | Blocker |
|----|-------------|------------|----------|------|-----|---------|---------|
| **C1** | Intro → TripHome `/home` | finish → `router.replace('/home')` + Chat seed | `app/index.tsx` | Code | NOT VERIFIED | NOT VERIFIED | Delete-app for re-show |
| **C2** | Explore venue-first by category | City-wide events + `filterEventsByExploreCategory`; hide blank heroes | `explore.tsx` | Code | NOT VERIFIED | NOT VERIFIED | None |
| **C3** | Profile photo add/change | `/my-profile` ImagePicker + upload | `my-profile.tsx` | Code | NOT VERIFIED | NOT VERIFIED | None |
| **C4** | Pull-to-refresh on Profile journal | `usePremiumRefreshControl` on tabs profile ScrollView | `app/(tabs)/profile.tsx` | Code | NOT VERIFIED | NOT VERIFIED | None |

---

## D. Workspace-blocked commercial (explicit)

| Item | Guest stance | Handoff |
|------|--------------|---------|
| Octopus Verified × ~10 | No unearned badges | H2 |
| Stripe TEST checkout + entitlement | CTA gated / human errors | H1 |
| LIVE payments | **NO-GO** | — |
| Hotel live fulfillment | Connect My New Stay on fail | H3 |
| TiB hotel multi-photo inventory | No invent | H4 |
| SmartTraveler redeemable coupons | Privilege copy only | H5 |
| GUEST-INT-1.0 package | Missing from tree | H6 |

---

## E. Release candidate (SAME-SHA)

| Field | Value |
|-------|--------|
| Build profile | EAS `preview` (internal) |
| Env embedded | `EXPO_PUBLIC_WORKSPACE_URL` + `EXPO_PUBLIC_ORCHESTRA_OS_URL` → Workspace |
| iOS detail | _(filled when EAS FINISHED)_ |
| Android detail | _(filled when EAS FINISHED)_ |
| gitCommitHash | Must match tip SHA on both |
| Physical | **NOT VERIFIED** |
| Production | **NO-GO** without approval |

### Owner install (after this RC FINISHED)

1. Delete installed app (clears intro + stale `dcd786a`).  
2. Expo login `banditeam121275`.  
3. Install **this** SAME-SHA pair only.  
4. Report with build URL + platform + SHA.

---

## F. Acceptance honesty

| Claim | Status |
|-------|--------|
| Guest-owned backlog implemented or precisely blocked | **YES** (this matrix) |
| Zero unresolved guest-owned items without a row above | **YES** |
| Physical PASS | **NOT CLAIMED** |
| Production deploy | **NOT DONE** |
| Competing Guest App implementations | **None created** |
