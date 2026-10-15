# P0 PHYSICAL FAIL RECOVERY REPORT — post-`4ba6f5a`

**Owner verdict:** RC `4ba6f5a` FAILED physical-device acceptance.  
**Protected baseline:** `6b2a346` (ancestor only).  
**Canonical product:** Guest App in this repo → `bandits-two` when approved.  
**This document tip:** _(filled at commit)_  
**Physical iOS / Android automation:** **NOT VERIFIED** in agent environment.  
**Production:** **NO-GO**

---

## 1. Root causes of recurring “fixed but still broken” failures

| Cause | Why `4ba6f5a` still failed on device | Fix in this recovery |
|-------|--------------------------------------|----------------------|
| **Explore Places API storm** | List pipeline treated *every* Google Places URL as needing live refresh and `Promise.all`’d Place Details for the full feed on every category switch → JS thread freeze | Refresh **only missing** heroes, max 4, **sequential**; EventCard recovers on image error |
| **City Memory → `/hotelier`** | More / Home labeled “City Memory” but routed into Hotel companion / Hotelier-titled stack | New `/cityMemory` traveler memory route; Hotel AFTER_TRIP = pause + link, not memory dump |
| **Upper rail lifecycle swap** | Off-stay rail replaced bandiTEAM with Travel in a Bottle | Locked rail: Local banDits → Experiences → SmartTraveler → bandiTEAM → banDiShop |
| **Chat omitted Mode A moments** | `guest_moment` / local moment threads not in `threadKeyForRow` / Chat merge → “No conversations yet” | Include `guest_moment*` + merge local moment threads into Chat |
| **Image probe ≠ viewport** | HTTP 200 on stored URL ≠ ExpoImage success; concurrent refresh hid the real freeze and left expired URLs skipping per-card recovery when parent “resolved” | Storm removed; cards recover on error; named venues still LOAD_OK at URL layer |
| **TiB fallback stock photo** | Stays without photos fell back to `DEFAULT_BOTTLE_HOTEL.imageUrl` → black/empty cabin UX presented as bookable | `mapWorkspaceBottleStay` returns `null` without real cover photo |
| **Matrix / code PASS ≠ device PASS** | Prior delivery treated inspection + EAS FINISHED as closure | This report separates FIXED / FAILED / BLOCKED; no physical PASS claimed |

---

## 2. Exact implemented fixes (source)

| Area | Files |
|------|--------|
| Explore freeze | `app/(tabs)/explore.tsx` |
| Upper rail | `lib/upperTab.ts` |
| City Memory | `app/cityMemory.tsx`, `menu.tsx`, `TripHomeScreen.tsx`, `bandits.tsx`, `hotelier/index.tsx` |
| Profile City Guide dedupe | `components/BanditHeader.tsx` (overlay kept; duplicate City Guide card removed) |
| Hotel gate / naming | `HotelierAccessGate.tsx`, `hotelier/_layout.tsx`, `hotelier/index.tsx` |
| Chat bottle/moments | `lib/chatThreads.ts`, `lib/guest-moment/store.ts` |
| Shop / ST copy | `shop.tsx`, `smarttraveler.tsx` |
| TiB photos | `lib/guest-workspace/liveBottle.ts`, `travelBottle.tsx` |
| Inventories | `scripts/rc-more-hotel-route-inventory.mjs` → `more-hotel-route-inventory.json` |

---

## 3. More + Hotel action → destination

Machine inventory: `artifacts/runtime-proof/rc-2026-10-15/more-hotel-route-inventory.json`

- **City Memory** → `/cityMemory` (traveler memory) — **not** `/hotelier`
- **Travel in a Bottle** → `/travelBottle` (More / contextual)
- **Hotel modules** → `/hotelier/{module}` with `claimHotelOffer` or stay gate → Connect My New Stay
- **Simulate checkout** removed from guest Hotel home
- Header title **Hotel** (not Hotelier OS)

Device exercise of every Pressable: **NOT VERIFIED** (no attached physical / Maestro in this env).

---

## 4. Image render results (key venues)

| Venue | HTTP probe | Viewport / ExpoImage on device |
|-------|------------|--------------------------------|
| Spook, Ergon House, Kick Cafe, The Brunchers, Tragos, Fixers | **LOAD_OK** (`venue-image-load-probe.json`) | **NOT VERIFIED** physically |
| Neo’s Athens / City Guide / map cards | Pipeline: stored + onError recovery | **NOT VERIFIED** |
| Avioti Fashion ED, BeQueer Athens | Depends on DB rows + Places | Flag incomplete if no durable/media load |
| TiB hotel + cabin | No stock fallback; missing cover → omitted from bookable list | Workspace handoff for missing supplier photos |

**Rule:** HTTP 200 ≠ visual PASS.

---

## 5. Guest-owned requirements status

| Requirement | Status |
|-------------|--------|
| Explore freeze | **FIXED** (code) · device **NOT VERIFIED** |
| Explore categories / venues | **FIXED** (city-wide + chips; storm removed) · device **NOT VERIFIED** |
| More City Memory destination | **FIXED** |
| More actions inventory | **FIXED** (machine list) · full press exercise **FAILED** / not run on device |
| Hotel CTAs / stay gate | **FIXED** (claim + Connect Stay UI) · live PMS **BLOCKED** |
| Hotel ≠ Hotelier OS branding | **FIXED** |
| Upper nav approved order | **FIXED** |
| Home Neo×3 / jargon | **FIXED** (prior + soft banner + single stay row) |
| City Guide overlay keep + remove duplicate card | **FIXED** |
| My Profile photo | **PRESERVED** (`/my-profile`) · device **NOT VERIFIED** |
| SmartTraveler copy | **FIXED** |
| Premium €19 concise + gated | **PRESERVED** · checkout **BLOCKED** Workspace |
| Bottle → Chat | **FIXED** (inbox eligibility + local merge) · two-account **NOT VERIFIED** |
| TiB no photo invent | **FIXED** |
| bandiShop customer demo copy | **FIXED** |
| Viewport photo PASS all listed | **FAILED** / incomplete without device screenshots |

---

## 6. Workspace handoffs (exact)

See `workspace-handoffs.md` + add:

| ID | Need |
|----|------|
| H1 | Stripe TEST entitlement ready for gated Unlock |
| H2 | Octopus Verified ~10 authorized IDs |
| H3 | Real hotel_request / PMS fulfillment |
| H4 | TiB approved multi-photo hotel + second-stay inventory |
| H5 | SmartTraveler redeemable coupons |
| H7 | Publish bottle stays with real `coverPhoto`/`photos` (Guest no longer invents) |

---

## 7. Runtime performance / navigation evidence

| Test | Result |
|------|--------|
| Explore Places concurrency | Reduced to ≤4 sequential missing-hero fetches |
| More/Hotel route inventory script | PASS (`more-hotel-route-inventory.json`) |
| Named venue HTTP probe | PASS |
| Repeated tab loops on device | **NOT VERIFIED** |
| Freeze duration logs | **NOT VERIFIED** (no device logcat/Xcode here) |

---

## 8. Screenshot evidence

| Capture | Status |
|---------|--------|
| Home no Neo×3 | Code-ready · **screenshot NOT CAPTURED** this session |
| City Guide overlay | Retained in code · **NOT CAPTURED** |
| Upper rail order | Code-ready · **NOT CAPTURED** |
| Venue photos in viewport | **NOT CAPTURED** |
| €19 / Profile photo | Prior code · **NOT CAPTURED** |

---

## 9. Device status

| Platform | Status |
|----------|--------|
| iOS physical | **NOT VERIFIED** · prior owner FAIL on `4ba6f5a` |
| Android physical | **NOT VERIFIED** · prior owner FAIL on `4ba6f5a` |

---

## 10. Production / next RC

| Item | Verdict |
|------|---------|
| Production deploy | **NO-GO** |
| New SAME-SHA EAS pair | **HOLD** until guest-owned P0s have feasible pre-device evidence + no Explore freeze in agent web/runtime smoke |
| Install URLs | **Not issued** in this report (recovery code not yet shipped as RC) |

### Acceptance gate for next RC
1. Commit this recovery.  
2. Web/runtime smoke: Explore category switch ×10 without freeze; City Memory ≠ Hotel; Chat lists intro/moment when seeded.  
3. Capture viewport screenshots for Home / Explore venue / City Guide / Profile.  
4. Only then EAS SAME-SHA preview.
