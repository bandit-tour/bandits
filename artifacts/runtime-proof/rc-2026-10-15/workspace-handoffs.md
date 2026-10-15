# Workspace handoffs — Guest App RC 15 Oct 2026

Guest App does **not** fabricate entitlement, Octopus Verified lists, published hotel inventory, or payment authorization.

## H1 — Commerce origins (EAS preview)

| Field | Value |
|-------|--------|
| Required | `EXPO_PUBLIC_WORKSPACE_URL=https://banditour-workspace.vercel.app` |
| Required | `EXPO_PUBLIC_ORCHESTRA_OS_URL=https://banditour-workspace.vercel.app` |
| Guest change | `eas.json` preview `env` embeds both (this RC) |
| Still Workspace | Stripe TEST checkout + webhook entitlement; **no LIVE** |

## H2 — Octopus Verified (~10 candidates)

| Field | Value |
|-------|--------|
| Guest | Renders badge only when `fetchBanditPremiumVisibility` / Workspace API authorizes |
| Workspace | Publish authorized bandit IDs (~10); Guest must not invent badges |
| Status | **BLOCKED** until Prisma / premium API returns non-Neo set |

## H3 — Hotel request / stay services

| Field | Value |
|-------|--------|
| Guest | CTAs call `claimHotelOffer` → Workspace `hotel_request`; on failure show Connect My New Stay |
| Workspace | Real PMS / stay-scoped request APIs for ordinary verified stays |
| Status | **BLOCKED** for live fulfillment |

## H4 — TiB hotel multi-photo

| Field | Value |
|-------|--------|
| Status | **BLOCKED** — inventory / galleries owned by Workspace; Guest must not invent stock |

## H5 — SmartTraveler coupons

| Field | Value |
|-------|--------|
| Guest | Privilege-first copy; demo listings labeled sample when live fetch fails |
| Workspace | Publish redeemable coupons for partner hotels |
| Status | **BLOCKED** for redeemable inventory |

## H6 — GUEST-INT-1.0 transfer package

| Field | Value |
|-------|--------|
| Status | **BLOCKED** — package not present in Guest repo tree |
