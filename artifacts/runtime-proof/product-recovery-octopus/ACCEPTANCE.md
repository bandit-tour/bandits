# Octopus Premium €19 — Product recovery O1–O6

**At:** 2026-10-17 · Guest `http://localhost:8082` → Workspace via `/__workspace` (local `:3000`)  
**Stripe:** TEST / treasury · **LIVE OFF**

## Three profile + journey placements (spec)

| # | Component | Surface |
|---|-----------|---------|
| 1 | `BanditHeader` | Progressive journey — `bandit-premium-insights-cta` |
| 2 | `bandit-card-capabilities` / `BanditOrchestraStrip` | Profile chips — `bandit-premium-insights-chip` |
| 3 | `PremiumUnlockModal` | Journey discovery card — `bandit-journey-local-insider` → modal |

## Repairs (Guest)

- **`lib/guest-app/premium-visibility.ts`** — do not cache failed visibility (hidden CTAs for 60s).
- **`app/premium/[id].tsx`** — sales when `showPremiumInsights`; checkout when `commerceOperational`.
- **`app/bandit/[id].tsx`** — Orchestra strip, gated discovery card, modal wiring.
- **`components/BanditHeader.tsx`** — optional parent visibility sync.

## Lukas vs Neo (Workspace)

| Bandit | Without `X-Guest-QA` | With localhost `X-Guest-QA` |
|--------|----------------------|-----------------------------|
| Lukas | `NONE` / no Unlock | `TEST_DEMO` / Unlock + honest TEST copy |
| Neo | `PRODUCTION` | `PRODUCTION` |

See `REPORT.json` → `lukasNeo`.

## O1–O6 (2026-10-17 local)

| Test | Status | Route | Source |
|------|--------|-------|--------|
| O1 Profile journey CTA | **PASS** | `/bandit/{neo}` via Meet Neo | `BanditHeader` · `bandit-premium-insights-cta` |
| O2 Capability chip | **PASS** | same | `BanditOrchestraStrip` / `bandit-card-capabilities` |
| O3 Journey modal | **PASS** | same | `GuestDiscoveryCard` → `PremiumUnlockModal` · €19 |
| O4 No payment bypass | **PASS** | `/premium/{neo}` | Concierge OS only after Commerce ACTIVE |
| O5 TEST checkout | **PASS** | `/premium/{neo}` | `purchaseStayPass` / treasury · not hosted Checkout |
| O6 Entitled reload | **PASS** | `/premium/{neo}` | Workspace entitlements persist |

## Evidence

Screenshots `O1`–`O6` in this folder · machine results in `REPORT.json`.
