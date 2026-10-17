# Experiences P1 — Closure

**Verdict: PASS** (2026-10-17)  
**Track:** price display consistency (listing → detail → checkout)  
**No Stripe LIVE / real charges. No pricing UI rebuild.**

## Runtime

| Service | Port | Status |
|---------|------|--------|
| Workspace (`next dev`) | `:3000` | Up (restarted after hung PID) |
| Guest Expo web | `:8082` | Up (left running) |
| Disk free at proof | — | ~4.8 GB |

## API diagnosis (`/__workspace/api/public/experiences`)

| Phase | HTTP | Content-Type | Body | Cause |
|-------|------|--------------|------|-------|
| Before | timeout | — | — | Hung Node on `:3000` (PID 28464). Metro proxies to `:3000`; upstream never answered → client `json()` failed (non-JSON). Fresh Workspace had bound `:3001` with good JSON, unused by proxy. |
| After | **200** | `application/json` | `{ ok, count:1, experiences:[{ id, priceCents:7200, priceBasis:"per_experience", …}] }` | Killed hung process; Workspace restarted on `:3000`. Proxy + direct match. |

**Fix class:** infrastructure / process only — not Guest pricing UI.

## Price source of truth (no mocks)

| Field | Workspace API | UI (fresh screenshots) |
|-------|---------------|------------------------|
| Amount | `priceCents: 7200` | **€72** |
| Currency | (no field; Guest `formatEuro` → €) | **EUR (€)** |
| Basis | `priceBasis: "per_experience"` | **per experience** / **/ experience** |
| Id | `exp_honesty_real` | Kypseli courtyard clay morning |

Matches across listing, detail sticky bar, and checkout date sheet.

## Evidence (fresh)

- `01-listing.png` — 13:02
- `02-detail.png` — 13:03
- `03-checkout-sheet.png` — 13:03
- `EVIDENCE.json` — proof harness exit 0
- Harness: `node scripts/proof-experiences-price.mjs`

CDN honesty hosts remapped to fallback cover so live card stayed mounted.

## PASS / FAIL / BLOCKED

| Check | Result |
|-------|--------|
| Listing prices from Workspace | **PASS** |
| Currency (€/EUR) consistency | **PASS** |
| priceBasis consistency | **PASS** |
| Listing = detail = checkout | **PASS** |
| No Coming soon spam | **PASS** |
| Non-bookable samples honest | **PASS** |
| Tab nav not blocked (~1.5s) | **PASS** |
| Proxy returns JSON | **PASS** (after restart) |
| No Stripe LIVE | **PASS** |
| Pricing UI rebuild | **N/A** (not done; not required) |

## Commit status

**Not committed** (per instructions).  
HEAD: `a7ebab3dad4b6677c77e5b0f9829d1a249552fa1`  
Guest App uncommitted work **preserved** (experiences, experience detail, metro proxy, workspace client, lifecycle/octopus, etc., plus this artifact folder). See `REPORT.json` → `commitStatus.relevantUncommitted`.

## Close

Experiences P1 price track closed on fresh browser evidence against live Workspace via `__workspace` proxy.
