# Image pipeline root-cause repairs — execution report

**Baseline ancestor:** `6b2a346` (preserved)  
**Parent tip before this commit:** `8b33def`  
**Production:** **NO-GO**  
**SAME-SHA EAS:** **HOLD** until Explore navigation/empty-feed freeze is also closed  
**iPhone status:** **NOT VERIFIED**  
**Android status:** **NOT VERIFIED**

Evidence: this folder + `venue-image-load-probe.json` (viewport-selection probe, not device PASS).

---

## Defect → fix

| # | Root cause | Code changes |
|---|------------|--------------|
| 1 | Live hero ignored when stale stored Google URL existed | `selectViewportVenueHeroUri` — live first; Explore + City Guide use it |
| 2 | Recovery only for null / narrow Google hosts | `eventNeedsLivePlacesHeroRecovery` — missing / ephemeral / Google-derived / non-durable |
| 3 | Recovery stopped after 4 | Sequential batches of 4 **until queue empty**; `liveRecoveryDoneIds` prevents infinite re-queue |
| 4 | Failed URLs retried forever | `failedHeroUris` + EventCard `onHeroUriFailed`; failed URIs stripped from live lists |
| 5 | Native map strict / preview no error | Native already `strict=false`; web skipGoogle fixed; MapPlacePreview `onError` + parent callback |
| 6 | EventCard skipped Places on any parent https; white spacer | Skip only preserved durable heroes; Loading/unavailable text instead of empty spacer |
| 7 | Spot/Event detail weak Places recovery | Spot refreshes on any stale URI; Event detail recovers on empty/stale + onError advance |
| 8 | `/media?key=` treated as permanent | `isEphemeralPlacesMediaUrl` docs + selection never preserves ephemeral as approved durable |
| 9 | Probe = HTTP 200 on DB URL | `scripts/rc-venue-image-load-probe.mjs` selects viewport URI + live refresh; does not claim device PASS |
| 10 | TiB black empty hero | `BottleHero` with `onError` + “Photo pending from hotel partner”; no stock fabrication (`liveBottle` still returns null without cover) |
| 11 | BanditHeader venue extras | Portraits-only preserved (explicit comment); venue imagery stays on Explore/City Guide/spot |

New helper: `lib/venueHeroRecovery.ts`  
Also: `getSpotDetailHeroUri` can use durable merge CDN URLs when row gallery is ephemeral.

---

## Named venues — viewport-selected URI (probe)

Probe prefers live Places refresh when stored `image_url` is ephemeral. Avioti/BeQueer stored HTTP **400**; live refresh **VIEWPORT_OK**.

| Venue | Stored ephemeral? | Selection | Final probe |
|-------|-------------------|-----------|-------------|
| Spook / Ergon / Kick / Brunchers / Tragos / Fixers | yes (often HTTP 200 stale) | `live_places_refresh` | VIEWPORT_OK |
| Avioti Fashion ED | yes (HTTP 400) | `live_places_refresh` | VIEWPORT_OK |
| BeQueer Athens | yes (HTTP 400) | `live_places_refresh` | VIEWPORT_OK |

**Not claimed PASS from probe alone.**

---

## Running-app screenshots (web Metro)

| Surface | Result | Evidence |
|---------|--------|----------|
| City Guide | 14 loaded images; Brunchers/Tragos/Fixers/Avioti/BeQueer names present; Places heroes visible | `02-city-guide.png` |
| Spot detail (The Brunchers) | Gallery 1/9 with real Places photo | `03-spot-detail.png` |
| Explore warm | After home→explore warm: `place:8`, `noPlaces:false` (still some “Loading photo…” during drain) | `01b-explore-warm.png`, `explore-warm.json` |
| Explore cold | Can still flash empty / “No places found” before data — **OPEN** (nav freeze risk) | `01-explore-venues.png` |

Failure/recovery: EventCard / Spot / City Guide log paths retained; suite console sample in `runtime-verify.json`.

---

## Acceptance vs owner bar

| Requirement | Status |
|-------------|--------|
| Visible photographs on City Guide / spot | **web DEMOTED OK** |
| No infinite Loading on City Guide after failed recovery | **code: Photo unavailable** |
| No permanent white spacer on EventCard | **code fixed** |
| No TiB black empty fabrication | **code fixed** |
| Explore always first paint with photos | **OPEN** (cold empty still observed) |
| iPhone / Android render | **NOT VERIFIED** |
| Device PASS | **NO** |
| Prepare SAME-SHA EAS | **NOT YET** — navigation smoke still required |
