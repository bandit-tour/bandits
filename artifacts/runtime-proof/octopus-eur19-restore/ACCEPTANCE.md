# Octopus Stay Pass €19 — production restore evidence

**Guest:** https://bandits-two.vercel.app  
**Workspace:** https://banditour-workspace.vercel.app (via `/__workspace` on Guest web)  
**Stripe:** TEST / treasury · **LIVE OFF**

## Mandatory screenshots

| File | Requirement |
|------|-------------|
| `O1-profile-journey-cta.png` | Profile journey — Premium / Your Local Insider entries |
| `eur19-purchase-screen.png` | Full €19 sales screen (`local-insider-sales-screen`) |
| `O5-test-payment-entitlement.png` | TEST payment confirm (server treasury — not hosted checkout.stripe.com) |
| `five-request-unlock.png` | Entitled guest — request allowance visible |
| `paid-task-screen.png` | Concierge OS after paid unlock |
| `O4-no-bypass-unpaid.png` | Unpaid guest — sales gate, no Concierge OS |
| `unpaid-api-bypass.json` | API `concierge_request` rejected with Premium required |

## O1–O6

See `REPORT.json`. Do not mark O1–O6 PASS unless €19 sales + checkout confirm on production URLs.
