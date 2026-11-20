# bandiTour — Permanent Brand Identity Contract

**Standing law:** ONE BRAND · THREE EXPERIENCES · TEN BUSINESS CATEGORIES  
**Status:** Permanent international brand standard  
**Authority:** Founder master directive  
**Last inventory:** 2026-11-20

---

## Brand DNA

Human-first travel universe — local people, extraordinary places, authentic experiences, cinematic storytelling.

Visual identity must feel: **international / premium**, cinematic but accessible, human / warm / culturally curious, **editorial not corporate**, sophisticated without complexity, immediately recognizable.

Three platforms must **not** look identical. They must feel like three experiences of one distinctive international brand.

| Platform | Personality |
|----------|-------------|
| Partner (`banditours.com`) | Premium international hospitality brand — not generic SaaS |
| Workspace | Clear, minimal, human operator OS — photographic ten-category entrance |
| Guest App | APPROVED cinematic traveler product — intro + official touchpoints only; do not redesign internal screens |

---

## 1. Three official assets ONLY

Locate existing originals. **Do not invent. Do not recreate. Do not AI-regenerate.**

| # | Asset | Authoritative filename | Role |
|---|--------|------------------------|------|
| 1 | **Wordmark / logo** | `logo-wordmark-dark-transparent.png` | Official bandiTour wordmark |
| 2 | **Octopus symbol** | `icon-mark-transparent.png` · `mascot-icon.png` | Official octopus (decorative bandana fill is NOT CTA red) |
| 3 | **Bandana-arrow artwork** | `logo-lockup-light-transparent.png` | Bandana-pattern arrows framing the logo — **source of official CTA red** |

**SHA-256 (Partner Platform originals = source of truth):**

| File | SHA-256 |
|------|---------|
| `logo-wordmark-dark-transparent.png` | `FB0D282965AB2F0F4781AF53FB8BEB62CEAC66106B32110C892E697C74474084` |
| `icon-mark-transparent.png` | `17C6365536DE160541DE4CA08A2081FBFE9E3349D4ED59D590F283E6296AD028` |
| `logo-lockup-light-transparent.png` | `6A3C3A2F04BCF36D0602FE8F8288990960186E7D0086079C8DA22E2C731F1D21` |
| `mascot-icon.png` | `5375C590FF01BEA36322F6D3C86F56DCD99E230614ACCA330F9D335B56033CE4` |

---

## 2. Ownership + mirror paths

| Platform | Path | Role |
|----------|------|------|
| **Partner** | `web/public/brand/` | **SOURCE OF TRUTH** |
| **Workspace** | `public/brand/` | Byte-identical mirror |
| **Guest** | `public/assets/brand/` + `assets/images/brand/intro/` | Mirror for intro / official touchpoints only |

Production: `https://banditours.com/brand/<file>` · `https://banditour-workspace.vercel.app/brand/<file>` · `https://bandits-two.vercel.app/assets/brand/<file>`

---

## 3. Colors — BLACK · WHITE · RED

| Token | Hex | Provenance |
|-------|-----|------------|
| `brand.black` | `#0A0A0A` / `#0A0A0B` | Canvas / text |
| `brand.white` | `#FFFFFF` | Paper / text on red |
| **`brand.red`** | **`#E72022`** | **Median true-red sampled from official `logo-lockup-light-transparent.png` bandana-arrow pixels** |
| `brand.redHover` | `#BD1A1C` | ~18% darkened hover of lockup red |

**FORBIDDEN as CTA / brand primary:** octopus bandana fill `#E01850` and pink/fuchsia/magenta family (`#E41A54`, `#DB2777`, `#EC4899`, …); coral `#ff4d3a` as brand primary; per-category teal/purple/green/gold brand palettes; generic orange “B” letter avatars as brand marks.

**OK:** functional status colors (success/error/warning). PLAY Hotel black/gold = PLAY surfaces only.

**Guest App:** do **not** recolor approved internal screens. Official marks on intro + official brand touchpoints only.

---

## 4. Shared design specification

| Element | Spec |
|---------|------|
| Display type | Platform display (Fraunces / Instrument Serif / existing Partner display) — editorial, not generic Inter-only SaaS |
| Body type | Existing platform sans (Outfit / system) — readable, human |
| Primary CTA | `#E72022` fill, `#FFFFFF` label, min height 44–48px, calm radius (8–12px) |
| Secondary CTA | `#E72022` border / text on white |
| Logo on dark | Wordmark or octopus mark as-is |
| Logo on light | Wordmark with `filter: brightness(0)` **or** lockup-light / octopus mark |
| Spacing | Generous editorial whitespace; one job per section |
| Photography | Authentic people / places / experiences — not stock dashboard chrome |
| Copy | Clear inviting language; no public jargon (`partner_id`, PENDING_*, Commerce OS) |
| Category identity | Copy + photography — never a second brand color system |

---

## 5. Communications (every channel)

Registration / verification / welcome / password recovery / notifications / marketing / PDFs / invoices / receipts / social / guest materials:

1. Official octopus or wordmark hosted on Partner `/brand/...`
2. CTA `#E72022` via shared email brand-shell
3. **HTML cannot control Gmail/Apple/Outlook sender avatar** — configure Zoho Mail profile photo with official octopus (`docs/production/EMAIL-SENDER-AVATAR.md`). Status: founder action required until profile photo updated.

---

## 6. Ten business categories

Hotelier · Local banDit · Local Experience · Travel in a Bottle · SmartTraveler · bandiShop · Destination · Creator · Affiliates · Impact  

One visual brand. Category identity = journey content + photography, not a rainbow of brand colors.

---

## 7. Enforcement

`npm run check:brand` in each repo. Fails on missing assets, SHA drift, or pink/fuchsia CTA assignments.

**No brand PASS without production visual verification** (desktop + mobile screenshots of changed experiences).

---

## 8. Contract installation

- Partner: `docs/BRAND_IDENTITY_CONTRACT.md` + `BRAND.md`
- Workspace: `docs/BRAND_IDENTITY_CONTRACT.md` + `BRAND.md`
- Guest: `docs/BRAND_IDENTITY_CONTRACT.md` + `BRAND.md`
