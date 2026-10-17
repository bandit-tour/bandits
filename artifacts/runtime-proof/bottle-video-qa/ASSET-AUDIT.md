# Travel in a Bottle — ocean video asset audit (17 Oct 2026)

## Owner requirement
Live-action (or clearly intended) footage of a **bottle thrown into the sea**, playing **only while Mix search is pending** on Travel in a Bottle.

**Explicit rejects (not the Mix ocean master):** PLAY hotel branding (`play-intro.mp4`), cyan CGI (`local-friend-bottle.mov` / museum `banditour-travel-in-a-bottle.MOV`), floating-bottle / hologram UI concepts, hotel QR promos, Sora lifestyle composites, “city inside bottle” marketing clips.

---

## Guest App video files inspected

| Path | Size | Codec | Duration | What the frames actually show |
|------|------|-------|----------|-------------------------------|
| `public/videos/play-intro.mp4` | 7,527,839 | H.264 Main 1920×1080 + AAC | 17.8s | PLAY hotel branding intro: black title card, red octopus “plaY” logos. **Not ocean.** |
| `assets/videos/play-intro.mp4` | same bytes | same | Duplicate of public copy. |
| `assets/images/local-friend-bottle.mov` | 397,856 | H.264 Baseline 568×320 + AAC | 7.2s | 3D CGI bottle + scroll on pale cyan studio background. **Not live ocean / sea throw.** |

Frame evidence in this folder: `recovery-play-intro-*.jpg`, `recovery-local-friend-bottle-*.jpg`, prior `play-t*.jpg`, `local-friend-t*.jpg`, `mov-t*.jpg` (when present).

## Code currently wires the wrong clip for web Mix
- `lib/openingIntroAssets.ts` → `BOTTLE_VIDEO_WEB_URI = '/videos/play-intro.mp4'`
- Comments claim “ocean bottle throw” — **incorrect** relative to pixel content.
- Native Mix uses `local-friend-bottle.mov` (CGI), also not sea footage.
- **Do not rewire Mix or claim video PASS** until a verified ocean master exists and is proven during a real Mix search run.

## Why Chrome showed a spinner + “Searching sleeping stays…”
That exact copy exists **only** in the `prefers-reduced-motion: reduce` branch of `TravelBottleMixLoading.web.tsx`.  
Reduced-motion fallback must be preserved; it is not a substitute for finding the ocean master.

## HTTP status of current web asset (not the content issue)
`GET http://localhost:8082/videos/play-intro.mp4` → `200`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`, Range `206` OK.

---

## FINAL source-asset recovery pass (17 Oct 2026 — pre–new-video request)

### Search scope (machine paths)
| Location | Result |
|----------|--------|
| `C:\Users\blonj\Documents\bandits` (+ git history / LFS) | **Only** `play-intro.mp4`, `local-friend-bottle.mov`, and `lib/public/Local Bandits – Your Personal Athens Insider (1).MP4` ever tracked. **No ocean throw file in any commit.** |
| `C:\Users\blonj\banditour workspace system` | Code workspace only; **no** bottle/ocean video masters (only unrelated `node_modules` zip). |
| `C:\Users\blonj\banDit` | **No** `.mp4` / `.mov` assets. |
| `C:\Users\blonj\bandiTour-future-labs` | **No** video files. |
| `C:\Users\blonj\bandiTour partner platform` | Brand + knowledge clips only (see rejects below). |
| `C:\Users\blonj\ibottle` (repo + `Desktop\ibottle`) | iBottle / Smart Cap / hotel hologram + city-inside-bottle; **no sea-throw master.** |
| `Desktop\athens banditour` (MVP, partner film packages, branding app) | Large film library; **no file whose name or sampled frames show bottle thrown into open sea.** |
| `Desktop\the unpublished museum\media banditour` | Duplicates / cousins of guest rejects (CGI bottle, hotel QR poster video). |
| `Downloads`, `Videos`, `OneDrive` | Duplicates of ibottle/partner Sora exports; **no WeTransfer / zip archives** matching ocean throw on this machine. |
| `cooliglo studio` | No banDiTour ocean throw masters (only unrelated extension cache / other IP). |

### Candidates found — all **REJECTED** for Mix ocean master

| Exact path | Duration | Verdict |
|------------|----------|---------|
| `C:\Users\blonj\Documents\bandits\public\videos\play-intro.mp4` | 17.8s | **REJECT** — PLAY branding (preserve master; do not overwrite). |
| `C:\Users\blonj\Documents\bandits\assets\images\local-friend-bottle.mov` | 7.2s | **REJECT** — cyan CGI studio bottle. |
| `C:\Users\blonj\Desktop\the unpublished museum\media banditour\banditour-travel-in-a-bottle.MOV` | 7.2s | **REJECT** — same CGI bottle + scroll (568×320); not ocean. |
| `C:\Users\blonj\Desktop\the unpublished museum\media banditour\banditour-bottle.MP4` | 6.2s | **REJECT** — hotel QR / PLAY “Scan your stay” composite (1024×1536). |
| `C:\Users\blonj\bandiTour partner platform\web\public\knowledge\videos\travel-in-bottle.mp4` | 8.0s | **REJECT** — SHA256 prefix `F70CB46855BEBA95`; chef + banDiTour QR bottle street promo (duplicate of `bandiTour_city_inside_bottle_202606092345.mp4`). |
| `C:\Users\blonj\bandiTour partner platform\web\public\knowledge\videos\city-in-bottle.mp4` | 8.0s | **REJECT** — SHA256 prefix `4120EE5CA009DC0A`; chef portrait / city-inside concept (duplicate of `…2341.mp4`). |
| `C:\Users\blonj\ibottle\apps\web\public\assets\intro\video-2026.mp4` | 10.1s | **REJECT** — hotel-room hologram UI bottle (duplicate of `VIDEO-2026-06-09-21-35-12.mp4`). |
| `C:\Users\blonj\ibottle\apps\web\public\assets\travel-in-a-bottle\video-hotel.mp4` | 10.1s | **REJECT** — same bytes as `video-2026.mp4`. |
| `C:\Users\blonj\Desktop\ibottle\bandiTour_city_inside_bottle_202606092341.mp4` (+ Downloads / partner brand copies) | 8.0s | **REJECT** — city-inside / chef promo. |
| `C:\Users\blonj\Downloads\Sora_touches_bottle_amber_light_202607072153.mp4` (+ partner `video- hero` copies) | — | **REJECT** — Sora hotel-suite magic-bottle composite. |
| `C:\Users\blonj\Downloads\BandiTour_bottle_in_global_settings_202607072153.mp4` | — | **REJECT** — CGI bottle in global montage. |
| `C:\Users\blonj\Downloads\BandiTour_Bottle_on_stone_plinth_202607072151.mp4` | — | **REJECT** — product hero / plinth still-life. |
| `Desktop\athens banditour\travel in a bottle travel with a concious\` | — | **N/A** — eight PNG mood boards only; no video. |
| `Desktop\ibottle\scene-*.PNG` | — | **N/A** — PLAY Smart Cap storyboard frames; no ocean throw storyboard. |

### Frame verification artifacts (this pass)
Extracted JPEG stills under `artifacts/runtime-proof/bottle-video-qa/`:

- `recovery-play-intro-t*.jpg`
- `recovery-local-friend-bottle-t*.jpg`
- `recovery-museum-travel-in-a-bottle-t*.jpg`
- `recovery-museum-banditour-bottle-t*.jpg`
- `recovery-ibottle-phone-video-t*.jpg`
- `recovery-city-inside-bottle-t*.jpg`
- `recovery-sora-touches-bottle-t*.jpg`
- `recovery-bottle-global-settings-t*.jpg`
- `recovery-bottle-stone-plinth-t*.jpg`
- `recovery-knowledge-travel-in-bottle-t4.jpg`
- `recovery-knowledge-city-in-bottle-t4.jpg`
- `recovery-ibottle-video-2026-t5.jpg`

None of the above show open water, a shore, or a bottle **being thrown into the sea**.

### Git / LFS conclusion
- **Git LFS:** no tracked ocean master in `bandits`.
- **History:** commit `6fa33c8` intentionally **reused** `play-intro.mp4` / `local-friend-bottle.mov` as temporary Mix feedback — confirming the repo never contained a distinct ocean file.

---

## Verdict: **SOURCE MISSING**

The **original live-action (or approved live-action) “bottle thrown into the ocean / sea” master is not present** anywhere searched on this machine under any alternate filename discovered in this pass.

### Exact asset required from owner / creative (before new engineering)
Deliver one **master file** (working name suggestion only — not invented footage):

| Field | Requirement |
|-------|-------------|
| **Content** | Continuous clip: hand (or clear human action) **throws** a banDiTour / message bottle **into open sea** — visible water surface, splash or entry, natural light; **no** PLAY octopus title card, **no** cyan CGI studio, **no** floating hologram UI, **no** hotel QR hero. |
| **Format** | H.264 + AAC in `.mp4` (or ProRes/DNx `.mov` source + web mezzanine); min **720p**, prefer **1080p**; **3–15 s** loop-friendly; no burned-in PLAY promo unless separately approved. |
| **Delivery path** | Owner-supplied path or upload; if wired into guest app later use a **new** file e.g. `public/videos/bottle-ocean-mix.mp4` — **do not replace** `public/videos/play-intro.mp4`. |
| **Proof gate** | ffprobe duration + frame grabs at 15%/50%/85% in this folder; then real Mix search on web **with motion allowed** and reduced-motion branch unchanged. |

**Video PASS:** **NOT claimed.** **Mix rewire:** **NOT performed** this pass.
