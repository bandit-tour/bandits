# Guest App completion matrix

**Guest:** https://bandits-two.vercel.app
**Workspace:** https://banditour-workspace.vercel.app
**Generated:** 2026-10-17T13:15:10.434Z

| Route | Status | Notes |
|-------|--------|-------|
| Welcome / Opening intro `/` | **PASS** | Returning guest: intro skipped → Home (expected) |
| Home (Trip brain) `/home` | **PASS** | — |
| Explore container `/explore` | **PASS** | — |
| Local banDits `/bandits` | **PASS** | — |
| Experiences `/experiences` | **PASS** | — |
| Experience detail (editorial) `/experience/exp_costume_warehouse` | **PASS** | — |
| SmartTraveler `/smarttraveler` | **PASS** | — |
| banDiShop `/shop` | **PASS** | — |
| bandiTEAM / Safety alerts `/scam-alerts` | **PASS** | — |
| Hotel hub `/hotelier` | **PASS** | — |
| Local Friend `/localFriend` | **PASS** | — |
| Chat (community tab) `/community` | **PASS** | — |
| Notifications / Inbox `/notifications` | **PASS** | — |
| More / Menu `/menu` | **PASS** | — |
| Profile `/my-profile` | **PASS** | — |
| Settings `/settings` | **PASS** | — |
| Impact / Passport `/impact` | **PASS** | — |
| Travel in a Bottle `/travelBottle` | **PASS** | Mix UI complete; honest empty second-sleep inventory |
| Bottle hotel profile `/bottleHotel/play-theatrou` | **PASS** | — |
| Bookings `/bookings` | **PASS** | — |
| Dream Destinations `/dreamDestinations` | **PASS** | — |
| City Memory `/cityMemory` | **PASS** | — |
| Your Local Insider (Neo) `/premium/d76cb120-018d-4a2e-8b5f-0578a71fd8f9` | **PARTIAL** | Octopus shell; entitlement/checkout WORKSPACE-dependent |
| Account `/account` | **PASS** | — |
| Support / FAQ `/account/faq` | **PASS** | — |
| Emergency support `/account/emergency` | **PASS** | — |
| Connect My New Stay `/reactivateStay` | **PASS** | — |
| Hotel QR entry (PLAY) `/hotel/play-theatrou` | **PASS** | — |

## Journeys
- **bottle_mix_to_empty_or_sample**: BLOCKED
- **error**: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByTestId('bottle-day-2026-11-10')


## Workspace blockers
- Bottle second-sleep provider inventory empty