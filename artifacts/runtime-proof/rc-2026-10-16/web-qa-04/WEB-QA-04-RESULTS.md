# WEB-QA-04 — banDiShop location & customer copy

**Status:** OPEN pending owner approval  
**Base HEAD:** `48a9850b93cc7099438e9039bbd4e930d41b1024`  
**Working tree:** uncommitted shop / product / shopGeo changes (no prod, no EAS)

## Changed files
- `app/(tabs)/shop.tsx` — location modes, copy, single-mount route, manual fallback
- `app/product/[id].tsx` — Directions, sample buy/message guard, save, error surface
- `lib/guest-workspace/shopGeo.ts` — Athens origin, manual picks, directions URLs, customer labels

## Acceptance matrix

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Near me with location granted | **PASS** | Origin `Near you`; distances e.g. `515 m from You`; `web-qa-04-shop-near-me-granted.png` |
| 2 | Location denied → manual fallback (not silent hotel) | **PASS** | “Choose an area” + neighbourhood chips; `web-qa-04-shop-manual-fallback.png` |
| 3 | From my hotel (PLAY Theatrou pin) | **PASS** | Origin `From Your hotel`; radius 1–25 km; `web-qa-04-shop-hotel-mode.png` |
| 4 | Distance filters + closest-first sort | **PASS** | 5 km → 24 finds; 1 km → 22 finds; haversine sort |
| 5 | Directions → real pickup coords | **PASS** | Opens `https://www.google.com/maps/dir/?api=1&destination=37.9775,23.7248` (Psyrri pin for `lst_table`) |
| 6 | Product detail / contact / booking | **PASS** (sample) / **BLOCKED** (live checkout) | Detail photo+price+seller; Message/Buy blocked for preview; Workspace live listings count **0** |
| 7 | No internal diagnostic copy | **PASS** | Removed `GPS not used` and `Sample local finds…`; customer preview line retained |

## Inventory truth
- Workspace `GET /api/public/shop/listings` → **0** published partner listings (browser via `/__workspace`).
- Guest shows editorial preview catalog with **Preview only — not open to buy yet** (non-purchasable; no payment path).

## Notes
- Visual grid / imagery / filters preserved (owner design approval).
- Shop route returns `null` (same pattern as Experiences) so UpperTabScreens is the single mount — fixes double UI fighting location state.
- Live Buy/Reserve against real Workspace inventory remains **BLOCKED** until partners publish listings.
