# Product recovery — Travel in a Bottle (T1–T12)

**Date:** 2026-10-17  
**Guest:** `http://localhost:8082`  
**Workspace:** `http://localhost:3000`  
**Constraint:** No LIVE Stripe · no fake bookings · no prod deploy · Mix form preserved · Octopus/Experiences untouched

## P0 fix (owner FAIL)

| Before | After |
|--------|--------|
| View hotel → `/hotel/{slug}` → QR flip / “message in a bottle” | View hotel → `/bottleHotel/{slug}` → Bottle first-hotel detail |

**Sources:** `app/(tabs)/travelBottle.tsx` (`onViewHotel`), new `app/bottleHotel/[slug].tsx`, `lib/guest-workspace/hotelBottleListing.ts`.

## Architecture map

| Product | Route | Role |
|---------|-------|------|
| Travel in a Bottle | `/travelBottle`, `/bottleHotel/[slug]`, `/journey/[id]` | First hotel + second sleep + Mix |
| Hotel tab (in-stay) | `/hotelier` | Services / concierge while checked in |
| QR hotel entry | `/hotel/*` | Messaging / flip / unlock — **not** Bottle discovery |
| Experiences / Octopus | unchanged | Parallel lanes — not modified this pass |

## T1–T12 results

| ID | Status | Route | Shot | Reason |
|----|--------|-------|------|--------|
| T1 | **PASS** | `/travelBottle` | `T01-mix-entry-form.png` | Mix entry (destination, dates, travelers, CTA) preserved |
| T2 | **PASS** | `/travelBottle` | `T02-athens-hotel-discovery.png` | Athens boutique chips (PLAY, NYX, partner) |
| T3 | **PASS** | `/travelBottle` | `T03-dates-guests.png` | Dates + travelers controls |
| T4 | **PASS** | `/travelBottle` | `T04-select-play.png` | Select PLAY hotel panel |
| T5 | **PASS** | `/bottleHotel/play-theatrou` | `T05-view-hotel-route.png` | View Hotel no longer opens QR messaging |
| T6 | **PASS** | `/bottleHotel/play-theatrou` | `T06-play-hotel-detail.png` | PLAY detail: gallery, rooms/amenities/address/policies/rates honesty · Workspace · LIVE |
| T7 | **PASS** | `/bottleHotel/nyx-athens` | `T07-nyx-hotel-detail.png` | NYX · Not published on Workspace (honest) |
| T8 | **PASS** | `/hotelier` | `T08-hotel-services-boundary.png` | Hotel services still opens Hotel tab |
| T9 | **BLOCKED** | `/travelBottle` | `T09-external-stays.png` | 0 verified `provider_record` second sleeps; no fabricated supply |
| T10 | **BLOCKED** | `/travelBottle` | `T10-mix-engine.png` | Mix engine live-only; cannot invent matches without supply |
| T11 | **PASS** | `/hotel/play-theatrou` | `T11-qr-hotel-entry-intact.png` | QR messaging product intact on `/hotel/*` |
| T12 | **PASS** | `/travelBottle` | `T12-product-boundaries.png` | Bottle ≠ Experiences catalog / Octopus |

Machine-readable: `RESULT.json` · runner: `run-proof.mjs`.

## Gaps remaining (Workspace-owned)

- Hotel `roomTypes`, address, authorized rates, amenities, policies — bind when config publishes (Guest UI ready; PLAY has no roomTypes/photos in durable store).
- Second-sleep inventory — host onboarding in Workspace; Guest lists only verified rows.
- Stock Unsplash URLs in tenant config are stripped (no scraped/stock gallery).
