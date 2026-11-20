# Brand Global Visual Acceptance — 2026-11-20

## Deployments (READY)

| Platform | Deploy ID | URL |
|----------|-----------|-----|
| Workspace | `dpl_NYC6vQfsp4paMiRnx5YsKuuBLJnS` | https://banditour-workspace.vercel.app |
| Partner | `dpl_A7zMESsmdZiWVE1hrDyDDry9Krtw` | https://banditours.com |
| Guest | `dpl_CZmpNmujnRDK6K3Jj7gHB2eyf4M4` | https://bandits-two.vercel.app |

Official CTA red (from bandana-arrow lockup): **`#E72022`**. Forbidden CTA pink: `#E01850`.

## Screenshot matrix

| Surface | Desktop | Mobile | Verdict |
|---------|---------|--------|---------|
| Guest intro `?intro=1` | `bandits/artifacts/runtime-proof/brand-global-20261120/guest-intro-after-desktop.png` | `.../guest-intro-after-mobile.png` | **PASS** official wordmark + octopus on intro; internal screens untouched. PLAY gold CTA on intro is cinematic exception (not lockup-red product chrome). |
| Partner home | `partner-platform/.../brand-global-20261120/partner-home-after-desktop.png` | `.../partner-home-after-mobile.png` | **PASS** octopus + wordmark + red "Find your place". |
| Partner Join Hotelier `/choose/hotels` | `.../partner-join-hotelier-desktop.png` | `.../partner-join-hotelier-mobile.png` | **FAIL** official logo present, but primary CTAs still **blue** ("Book a demo" / "See the magic") — not `#E72022`. |
| Partner Join Local banDit `/choose/bandit` | `.../partner-join-bandit-desktop.png` | `.../partner-join-bandit-mobile.png` | See shot — brand shell expected. |
| Partner register | `.../partner-register-desktop.png` | `.../partner-register-mobile.png` | See shot. |
| Workspace entrance | `workspace/.data/brand-acceptance-shots/workspace-entrance-after-desktop.png` | `.../workspace-entrance-after-mobile.png` | **PASS** photographic 10-category grid; CTAs lockup red; official marks. |
| Email verification HTML | `.../email-verification-desktop.png` (+ mobile) | same folder | **PASS** octopus + `#E72022` Verify button. Preview only (not live inbox). |
| Inbox sender avatar | — | — | **FAIL / FOUNDER ACTION** — Zoho profile photo not settable via deploy. HTML cannot control Gmail avatar. |

## Before / after

| Surface | Before | After |
|---------|--------|-------|
| Workspace entrance | `.data/brand-acceptance-shots/workspace-entrance-before-desktop.png` | `workspace-entrance-after-desktop.png` |
| Guest intro | `artifacts/runtime-proof/intro-branding-20261120/intro-before-*.png` (prior 535816e) | `brand-global-20261120/guest-intro-after-*.png` |

## Automated checks

All three repos: `npm run check:brand` → PASS at deploy time.

## Overall brand verdict

**CONDITIONAL PASS — not full PASS.**

- Shared assets + contract + lockup red `#E72022` + Workspace entrance + Guest intro marks + email HTML shell: shipped and visually verified.
- **Blockers for full PASS:** (1) Partner Hotelier Join page still uses blue primary CTAs; (2) Zoho sender avatar still requires founder upload; (3) real inbox screenshot of a delivered verification email not captured this pass (HTML preview only).

Guest internal product screens: **frozen / not redesigned**.
