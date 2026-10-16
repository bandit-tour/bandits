# WEB-QA-02 — Experiences content disappeared (OPEN for owner review)

**Status:** Guest App client restored against live Workspace inventory. **Keep OPEN** until owner review.  
**Scope:** Web localhost:8082 only. No EAS. No production deploy. No fake seed.

## Root cause

Experiences inventory **was never deleted**. Workspace still returns **5 published `provider_record` experiences** (`status: Open seats`).

The Guest App browser on `http://localhost:8082` called `https://banditour-workspace.vercel.app/api/public/experiences` **cross-origin**. Workspace CORS rejects that origin → browser `Failed to fetch` → client treated the failure as empty inventory → UI showed **"No published provider experiences yet" / 0 experiences**.

Secondary issues (not the empty page, but degraded richness once fetch works):

- Two records use **asset keys** (`cover-courtyard`, `hands-in-clay`, `street-stop`) instead of HTTPS photo URLs → client maps known keys to approved covers.
- Titles/hosts still carry Workspace session suffixes (`muup4e9h`, etc.) — content hygiene for Workspace.
- All five live rows classify as **Workshops** (clay walks) — other category chips correctly empty for live SoT.
- Editorial DNA (`GUEST_EXPERIENCES`, 16 rows) is **not** mixed into live SoT; only used if transport fails.

### Browser proof (2026-10-16)

```json
{
  "direct": { "error": "Failed to fetch" },
  "proxy": {
    "ok": true,
    "status": 200,
    "count": 5,
    "statuses": ["Open seats", "Open seats", "Open seats", "Open seats", "Open seats"],
    "sources": ["provider_record", "provider_record", "provider_record", "provider_record", "provider_record"]
  }
}
```

## Inventory truth

| Source | Count | Status / notes |
|--------|------:|----------------|
| Workspace `GET /api/public/experiences` | **5** | All `source=provider_record`, `status=Open seats`, bookable seats > 0, €72 |
| Unpublished / draft in public API | **0** | Public endpoint returns only open inventory |
| Guest editorial DNA (`GUEST_EXPERIENCES`) | **16** | Valid covers; **not** shown when live hosts load |
| Hotel / venue listings | N/A | Separate product surface — not Experiences |

### Live provider rows (Workspace)

| id | host | seats | priceCents | photos |
|----|------|------:|-----------:|--------|
| exp_546eba723199 | Kypseli Clay muup4e9h | 5 | 7200 | asset keys → mapped covers |
| exp_c4e12b245418 | Kypseli Clay muupcbe2 | 5 | 7200 | asset keys → mapped covers |
| exp_a3f5c1d62493 | Kypseli Clay muv94okn | 3 | 7200 | Unsplash HTTPS |
| exp_7f56efc96865 | Kypseli Clay muv92kpv | 5 | 7200 | Unsplash HTTPS |
| exp_f031cd6b6b2c | Kypseli Clay muz5c7c3 | 5 | 7200 | Unsplash HTTPS |

**Publication blockers for “richer” catalog (Workspace, not Guest App):** none for these five — they are already published/open. Broader catalog gaps (Nightlife/Art/Fashion/Queer/Food/Music live hosts, clean titles, real Kypseli photography, host emails, reviews) require Workspace content ops — see handoff below.

## Code / API changes (Guest App)

| File | Change |
|------|--------|
| `metro.config.js` | Dev middleware: `/__workspace/*` → Workspace origin (CORS bypass on localhost) |
| `lib/workspace/client.ts` | Web localhost → same-origin `/__workspace` |
| `api/workspace-proxy.js` | Production web same-origin bridge (`?path=/api/...`) |
| `lib/guest-workspace/liveExperiences.ts` | Photo asset-key resolve; skip draft/unpublished; fetch result shape + detail gallery resolve |
| `app/(tabs)/experiences.tsx` | Live SoT only when Workspace answers; editorial DNA only on transport failure; “live hosts” meta |

**Not changed:** unrelated Guest App features, EAS, production deploy, Workspace DB.

## Navigation / category results

| Check | Result |
|-------|--------|
| `/experiences` All | **5 experiences · live hosts** |
| Workshops filter | **5** (all clay walks) |
| Nightlife (and other non-Workshop chips) | **0** — correct for current live inventory |
| Detail `/experience/exp_546eba723199` | Host, €72, Kypseli, 90 min, gallery, **Show dates** CTA |
| Unpublished exposed as bookable | **No** — drafts filtered; public API only returns Open seats |

## Screenshots

| File | What |
|------|------|
| `web-qa-02-experiences-after-live-hosts.png` | After: 5 live host cards |
| `web-qa-02-experience-detail.png` | Detail + host + pricing + Show dates |
| `web-qa-02-nightlife-empty-filter.png` | Category filter truth (0 Nightlife live) |

**Before:** Owner/browser regression state was empty chrome + “No published provider experiences yet” / 0 experiences while Workspace still held the five rows (CORS). Direct browser fetch still fails without proxy (proof above).

## Workspace handoff (remaining blockers — do not fabricate auth)

1. **CORS:** Allow Guest App origins (`http://localhost:8082`, production Guest web) on `/api/public/*`, **or** keep relying on Guest same-origin proxy. Prefer Workspace CORS for native + non-proxied clients.
2. **Photo assets:** Replace asset keys with real HTTPS media for Kypseli clay experiences (current Unsplash/coastal fallbacks are not neighborhood-true).
3. **Title/host hygiene:** Strip session suffixes (`muup4e9h`…); set stable `hostName` / `hostEmail` / `partnerId`.
4. **Category diversity:** Publish real host-led inventory across Nightlife, Art, Fashion, Queer, Food, Music — current public API is 5× Workshops only.
5. **Reviews / ratings:** Still 0 — optional enrichment, not a publication blocker for listing.
6. **Do not** mark draft inventory public without operator approval.

## Acceptance checklist

- [x] Root cause identified (CORS empty client, data still in Workspace)
- [x] Inventory counts by source/status
- [x] Exact Guest App code changes
- [x] After screenshots + category/detail navigation
- [x] Published vs unpublished truth
- [x] Workspace blockers listed without fabricating authorization
- [ ] **Owner review** — WEB-QA-02 remains **OPEN**
