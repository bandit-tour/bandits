# Owner live regressions — P0-A / P0-B / P0-C

**At:** 2026-10-17T17:15Z (local)  
**Guest tip (pinned, not redeployed this turn):** `2bbf93b` · `dpl_99CN4rd8` · https://bandits-two.vercel.app  
**Workspace alias:** https://banditour-workspace.vercel.app · join git `e315570`  
**Stripe LIVE:** OFF  
**Octopus sibling:** restoring €19 purchase screen — Guest `--prod` held to avoid alias race.

## Code corrections (uncommitted Guest)

| Track | Fix |
|-------|-----|
| **P0-A Experiences** | Bookable cards always show Workspace price (or honest “Price on request”). Editorial cards labeled **Inspiration · not bookable** + Explore — no invented €72 reuse, no Book CTA. |
| **P0-B SmartTraveler** | Guest claim CTA returns Workspace `claim.id` as show-at-door code; merchant join hint; editorial no longer framed as the product. Subscription price still owner-TBD (`SMARTTRAVELER_PRICE_OWNER_APPROVED`). |
| **P0-C Bottle** | Hotel search; Discoverable vs Participating labels; known boutique local galleries no longer wiped when Workspace not LIVE; host onboarding CTA → `/join`. |

## Live supply (honest)

| Surface | Prod API | Guest impact |
|---------|----------|--------------|
| Experiences | `count:1` · `exp_36947a59d888` · `priceCents:7200` EUR | One bookable paid card; editorial DNA remains inspiration-only |
| SmartTraveler | `count:0` businesses | Redeemable merchant network empty until a published `partner_record` + offer; editorial separately labeled |
| Bottle stays | `count:0` verified | Mix correctly returns zero; host join path live on Workspace |
| Hotels | PLAY LIVE; NYX/ALUMA `not found or not LIVE` | Discoverable in-app profiles (authorized white-label) selectable for planning |

## External blockers (not inventable)

1. ≥2 bookable Experience providers (Create-First publish).
2. ≥1 publicEligible SmartTraveler merchant with live offer (+ owner-approved subscription tariff for business billing).
3. Verified Bottle nature-host inventory for Mix matches.
4. NYX/ALUMA Workspace LIVE configs for participating inventory (rates/rooms).
5. Guest production redeploy after Octopus sibling lands (coordinate `dpl_99CN4rd8`).

## Evidence paths

- `experiences/API-public-experiences.json`
- `smarttraveler/API-public-smarttraveler.json`
- `smarttraveler/API-partners-join.json`
- `bottle/API-public-bottle-stays.json`
- `bottle/API-*-config.json`
- This `STATUS.md`

Browser screenshots of the **new** Guest UI require a local/preview build or post-Octopus deploy — not claimed PASS from tip alone.
