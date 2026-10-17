# Guest App surface inventory (repo-derived)

**Branch tip at deploy:** `repair/guest-app-regression` · **Production:** https://bandits-two.vercel.app  
**Deployment:** `dpl_9nD15uX3P2gqNgM8pYnWrSQ8jhc3`

## Bottom nav (6) — `MainBottomNav` / `lib/appNavigation.ts`

| Tab | Route |
|-----|-------|
| Home | `/home` |
| Explore | `/explore` (discovery container) |
| Hotel | `/hotelier` |
| Local Friend | `/localFriend` |
| Chat | `/community` |
| More | `/menu` |

**Chrome bell:** `/notifications` (not a bottom tab).

## Discovery rail (upper) — `lib/upperTab.ts` `DISCOVERY_LANE_STAY`

| Label | Route |
|-------|-------|
| Local banDits | `/bandits` |
| Experiences | `/experiences` |
| SmartTraveler | `/smarttraveler` |
| bandiTEAM | `/alerts` → redirect `/scam-alerts` |
| banDiShop | `/shop` |

Travel in a Bottle: `/travelBottle` — **More + contextual**, not rail peer.

## More / Menu groups — `app/(tabs)/menu.tsx`

- **My Journey:** City Memory, My Spots, Following, Travel in a Bottle (stay), Impact (after)
- **My Connections:** Notifications, Bookings
- **My Privileges:** Your Local Insider (`/premium/{neo}`), My Moments, Impact
- **Safety & Support:** Safety Alerts, See Reports, Share a Warning, Help
- **My Stay (active):** Hotel modules under `/hotelier/*`
- **Account:** Account, Payments, Language, Privacy
- **Quick actions:** lifecycle-specific (Continue My Stay, Connect My New Stay, etc.)

## Standalone guest routes (stack)

| Area | Routes |
|------|--------|
| Welcome | `/`, `/playWelcome`, `/playIntro`, `/hotel/play-theatrou` (QR) |
| Profile | `/my-profile`, `/profile`, `/settings`, `/quickProfile` |
| Bottle | `/travelBottle`, `/bottleHotel/[slug]`, `/bottle`, `/bottleDiscover`, `/journey/[id]` |
| Experiences | `/experiences`, `/experience/[id]`, `/event/[id]` |
| Octopus | `/premium/[id]` |
| Passport | `/impact`, `/journey/[id]` |
| Trips | `/bookings`, `/dreamDestinations`, `/cityMemory`, `/reactivateStay` |
| Messages | `/community`, `/chat`, `/notifications`, `/inbox` |
| Support | `/account`, `/account/faq`, `/account/emergency`, `/account/technical-support`, `/account/contact-hotel` |
| Local banDits detail | `/bandit/[id]`, `/host/[id]`, `/vibe/[banditId]` |

## Workspace bridge

- Guest rewrites `/__workspace/*` → `https://banditour-workspace.vercel.app/*` (`vercel.json`)
