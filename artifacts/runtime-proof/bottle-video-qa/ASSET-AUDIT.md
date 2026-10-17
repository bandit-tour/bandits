# Travel in a Bottle — ocean video asset audit (17 Oct 2026)

## Owner requirement
Live-action (or clearly intended) footage of a bottle thrown into the sea, playing only while Mix search is pending.

## Guest App video files inspected

| Path | Size | Codec | Duration | What the frames actually show |
|------|------|-------|----------|-------------------------------|
| `public/videos/play-intro.mp4` | 7,527,839 | H.264 Main 1920×1080 + AAC, 17.8s | PLAY hotel branding intro: black title card, red octopus “plaY” logos. **Not ocean.** |
| `assets/videos/play-intro.mp4` | same bytes | same | Duplicate of public copy. |
| `assets/images/local-friend-bottle.mov` | 397,856 | H.264 Baseline 568×320 + AAC, 7.2s | 3D CGI bottle + scroll on pale cyan studio background. Bottle tilts/falls in abstract blue — **not live ocean / sea throw.** |

Frame evidence in this folder: `play-t*.jpg`, `local-friend-t*.jpg`, `mov-t*.jpg`.

## Code currently wires the wrong clip for web Mix
- `lib/openingIntroAssets.ts` → `BOTTLE_VIDEO_WEB_URI = '/videos/play-intro.mp4'`
- Comments claim “ocean bottle throw” — **incorrect** relative to pixel content.
- Native Mix uses `local-friend-bottle.mov` (CGI), also not sea footage.

## Why Chrome showed a spinner + “Searching sleeping stays…”
That exact copy exists **only** in the `prefers-reduced-motion: reduce` branch of `TravelBottleMixLoading.web.tsx`.  
So the owner’s browser had reduced-motion enabled (common when Windows animation effects are off). Even with motion allowed, the wired MP4 is PLAY branding, not the ocean throw.

## Broader search (sibling repos)
Searched `bandiTour partner platform` brand / knowledge videos (`travel-in-bottle.mp4`, `city-in-bottle.mp4`, `VIDEO-2026-06-09-21-35-12.mp4`, `bandiTour_hero_film.mp4` samples). Found hotel QR-bottle lifestyle, holographic bottle UI, product stills — **no live-action bottle-into-sea clip**.

## Blocker
**The original ocean bottle throw video is not present in the Guest App repository or its git history under any current video path.**  
Cannot re-encode or play footage that is not in the tree. Owner must supply the original ocean master (or its path/URL in brand storage) before Mix can show that visual.

## HTTP status of current web asset (not the content issue)
`GET http://localhost:8082/videos/play-intro.mp4` → `200`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`, Range `206` OK.
