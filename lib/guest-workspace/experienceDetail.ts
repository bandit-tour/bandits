/**
 * Experience detail enrichment — gallery, itinerary, reviews, availability,
 * meeting point, host bio, things-to-know. Listing cards stay on GuestExperience;
 * detail route merges this overlay by id.
 *
 * Image law: every gallery / host / itinerary URI must be a working https cover.
 * Invalid URIs are stripped; listings without a valid cover never resolve.
 */

import {
  GUEST_EXPERIENCES,
  isValidExperienceImageUrl,
  type GuestExperience,
} from "@/lib/guest-workspace/productWorlds";

export type ExperienceItineraryStep = {
  id: string;
  title: string;
  description: string;
  durationLabel: string;
  imageUrl: string;
};

export type ExperienceReview = {
  id: string;
  authorName: string;
  authorPhotoUrl: string;
  rating: number;
  dateLabel: string;
  text: string;
};

export type ExperienceAvailabilitySlot = {
  id: string;
  label: string;
  timeRange: string;
  spotsLeft: number;
  priceCents: number;
  language: string;
  startsAtIso: string;
};

export type ExperienceHostProfile = {
  id: string;
  name: string;
  photoUrl: string;
  expertise: string;
  bio: string;
  credentials: string[];
  yearsHosting: number;
  languages: string[];
  banditId?: string;
  messageViaLocalFriend?: boolean;
};

export type ExperienceMeetingPoint = {
  label: string;
  address: string;
  description: string;
  lat: number;
  lng: number;
  directionsHint: string;
};

export type ExperienceThingsToKnow = {
  guestRequirements: string[];
  accessibility: string[];
  cancellation: string;
  whatToBring: string[];
  ageRequirements: string;
  hostResponsibility: string;
  safety: string[];
};

export type ExperienceCoreFacts = {
  meetingArea: string;
  duration: string;
  languages: string[];
  groupSize: string;
  setting: "Outdoor" | "Indoor" | "Indoor & outdoor";
  accessibilityNote?: string;
};

export type ExperienceDetail = GuestExperience & {
  shortDescription: string;
  reviewCount: number;
  gallery: string[];
  hostProfile: ExperienceHostProfile;
  coreFacts: ExperienceCoreFacts;
  itinerary: ExperienceItineraryStep[];
  reviews: ExperienceReview[];
  availability: ExperienceAvailabilitySlot[];
  meeting: ExperienceMeetingPoint;
  thingsToKnow: ExperienceThingsToKnow;
  cancellationPolicyShort: string;
  commerceProductId: string | null;
  commerceWorkspaceId: string;
};

const img = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const DIVINE: ExperienceHostProfile = {
  id: "host_divine",
  name: "Divine Athena",
  photoUrl: img("photo-1488426862026-3ee34a7d66df", 400),
  expertise: "Drag · costume archives · queer Athens nightlife",
  bio: "Divine Athena has raided Athens costume warehouses for fifteen years — theatre surplus, carnival leftovers, and looks that never made the stage. She hosts for guests who want backstage, not a boutique.",
  credentials: ["Drag performer · Athens circuit", "Costume archive access", "English & Greek"],
  yearsHosting: 6,
  languages: ["English", "Greek"],
  banditId: "bandit_divine",
  messageViaLocalFriend: true,
};

const LEONIDAS: ExperienceHostProfile = {
  id: "host_leonidas",
  name: "Chef Leonidas",
  photoUrl: img("photo-1560250097-0b93528c311a", 400),
  expertise: "Market shopping · private kitchen · seasonal Greek",
  bio: "Leonidas cooks what you choose at Varvakios — no fixed menu. The market is the brief; the kitchen is the show.",
  credentials: ["Private chef · 11 years", "Market-to-table only", "English & Greek"],
  yearsHosting: 5,
  languages: ["English", "Greek"],
  banditId: "bandit_leonidas",
  messageViaLocalFriend: true,
};

const MARA: ExperienceHostProfile = {
  id: "host_mara",
  name: "Mara Vlachou",
  photoUrl: img("photo-1529626455594-4ff0802cfb7e", 400),
  expertise: "Sustainable remake · pattern hacking · one-of-ones",
  bio: "Mara turns dead garments into new shapes — cut, rebuild, finish. Fashion as salvage, not consumption.",
  credentials: ["Remake atelier · Psyrri", "Zero-waste practice", "English & Greek"],
  yearsHosting: 4,
  languages: ["English", "Greek"],
  banditId: "bandit_mara",
  messageViaLocalFriend: true,
};

const NYX: ExperienceHostProfile = {
  id: "host_nyx",
  name: "DJ Nyx",
  photoUrl: img("photo-1539571696357-5a69c17a67c6", 400),
  expertise: "Club booth · vinyl digging · night programming",
  bio: "Nyx plays Gazi and the basements that don’t post flyers. Guests get real booth time — cues, blends, and a mini-set that counts.",
  credentials: ["Resident DJ · Athens nights", "Vinyl crate guide", "English & Greek"],
  yearsHosting: 7,
  languages: ["English", "Greek"],
  banditId: "bandit_nyx",
  messageViaLocalFriend: true,
};

const IRIS_CURATOR: ExperienceHostProfile = {
  id: "host_iris_curator",
  name: "Iris Papadimitriou",
  photoUrl: img("photo-1573496359142-b8d87734a5a2", 400),
  expertise: "Indie galleries · studios · pop-ups",
  bio: "Iris skips the museum circuit. She maps artist-run spaces, studio visits, and openings that still feel like the neighborhood.",
  credentials: ["Independent curator", "Studio network · Exarcheia", "English & Greek"],
  yearsHosting: 8,
  languages: ["English", "Greek"],
  banditId: "bandit_iris_curator",
  messageViaLocalFriend: true,
};

const KEYS: ExperienceHostProfile = {
  id: "host_keys",
  name: "Kostas “Keys”",
  photoUrl: img("photo-1500648767791-00dcc994a43e", 400),
  expertise: "Insider nightlife · door culture · spontaneous routes",
  bio: "Keys knows which doors open on which nights. No Google list — just a route that shifts with the room.",
  credentials: ["Nightlife fixer · 9 years", "Cover & guest-list access", "English & Greek"],
  yearsHosting: 9,
  languages: ["English", "Greek"],
  banditId: "d7f053c0-a4c5-4f70-a82c-037d82005808",
  messageViaLocalFriend: true,
};

const THEO: ExperienceHostProfile = {
  id: "host_theo",
  name: "Theo Ink",
  photoUrl: img("photo-1506794778202-cad84cf45f1d", 400),
  expertise: "Flash nights · illustration · fine-line ink",
  bio: "Theo draws a fresh flash sheet every week and tattoos it the same night. Guests pick from art that didn’t exist last Monday.",
  credentials: ["Illustrator & tattooer", "Flash-night host", "English & Greek"],
  yearsHosting: 5,
  languages: ["English", "Greek"],
};

const DANAE: ExperienceHostProfile = {
  id: "host_danae",
  name: "Danae Scent",
  photoUrl: img("photo-1580489944761-15a19d654956", 400),
  expertise: "Natural perfume · Athens notes · small-batch blend",
  bio: "Danae builds fragrances from the city’s smell-map — mastic, hot stone, night jasmine — then bottles your blend.",
  credentials: ["Perfume lab · Kolonaki", "Natural materials", "English & Greek"],
  yearsHosting: 4,
  languages: ["English", "Greek"],
};

const NIKOS_FRAME: ExperienceHostProfile = {
  id: "host_nikos_frame",
  name: "Nikos Frame",
  photoUrl: img("photo-1492562080023-ab3db95bfbce", 400),
  expertise: "After-midnight street photography",
  bio: "Nikos shoots when Athens empties — neon, alleys, people who only appear late. Guests leave with frames that don’t look like daytime tourism.",
  credentials: ["Documentary photographer", "Night routes", "English & Greek"],
  yearsHosting: 6,
  languages: ["English", "Greek"],
  banditId: "2f5f4057-4f09-463f-8c08-d66d13caea1a",
  messageViaLocalFriend: true,
};

const YIAYIA: ExperienceHostProfile = {
  id: "host_yiayia",
  name: "Yiayia Eleni",
  photoUrl: img("photo-1594744803329-e58b31de8bf5", 400),
  expertise: "Sunday lunch · home kitchen · family recipes",
  bio: "Eleni cooks the way she always has — dough, pot, table. Guests are temporary grandchildren for one Sunday.",
  credentials: ["Home cook · Kypseli", "Family recipes", "Greek · basic English"],
  yearsHosting: 3,
  languages: ["Greek", "English"],
};

const DAPHNE: ExperienceHostProfile = {
  id: "host_daphne",
  name: "Daphne K.",
  photoUrl: img("photo-1531123897727-8f129e1688ce", 400),
  expertise: "Silver bench · saw · file · finish",
  bio: "Daphne runs a working Psyrri bench. Guests design and leave wearing a piece that didn’t exist that morning.",
  credentials: ["Jeweller · 10 years", "Materials included", "English & Greek"],
  yearsHosting: 7,
  languages: ["English", "Greek"],
};

const SPRAY: ExperienceHostProfile = {
  id: "host_spray",
  name: "Spray Lena",
  photoUrl: img("photo-1548142813-c348350df52b", 400),
  expertise: "Legal walls · mural · street lettering",
  bio: "Lena paints walls the city still allows. Guests get cans, a section, and a mark that lasts until the next coat.",
  credentials: ["Street artist · Athens", "Legal wall access", "English & Greek"],
  yearsHosting: 5,
  languages: ["English", "Greek"],
};

const CHLOE: ExperienceHostProfile = {
  id: "host_chloe_rack",
  name: "Chloe Rack",
  photoUrl: img("photo-1487412720507-e7ab37603c6f", 400),
  expertise: "Vintage styling · backstreet racks · greek labels",
  bio: "Chloe hunts military, 90s greek labels, and leather you’ll wear — never the tourist mall.",
  credentials: ["Stylist · vintage buyer", "Backstreet map", "English & Greek"],
  yearsHosting: 4,
  languages: ["English", "Greek"],
};

const ANDREAS_OVEN: ExperienceHostProfile = {
  id: "host_andreas_oven",
  name: "Andreas Oven",
  photoUrl: img("photo-1463453091185-61582044d556", 400),
  expertise: "Night bakeries · warm bread · quiet Athens",
  bio: "Andreas knows which ovens still run after midnight. Guests taste while the city sleeps.",
  credentials: ["Bakery fixer", "Night routes", "English & Greek"],
  yearsHosting: 3,
  languages: ["English", "Greek"],
};

const BLUE: ExperienceHostProfile = {
  id: "host_blue",
  name: "Mr. Blue Notes",
  photoUrl: img("photo-1507591064344-4c6ce005b128", 400),
  expertise: "Jazz collecting · listening rooms · basement sets",
  bio: "Blue collects pressings that never made Spotify playlists. Guests hear them in his room, then catch a tiny live set downstairs.",
  credentials: ["Collector · 20 years", "Basement venue access", "English & Greek"],
  yearsHosting: 6,
  languages: ["English", "Greek"],
  banditId: "bandit_blue",
  messageViaLocalFriend: true,
};

const DEFAULT_THINGS: ExperienceThingsToKnow = {
  guestRequirements: [
    "Arrive 5 minutes early at the meeting point",
    "Valid ID if requested by the host",
  ],
  accessibility: ["Ask your host about step-free access for this venue"],
  cancellation:
    "Free cancellation up to 24 hours before start. Within 24 hours, the experience is non-refundable.",
  whatToBring: ["Phone charged", "Light layer"],
  ageRequirements: "Ages 18+ unless noted",
  hostResponsibility:
    "Your host leads the session, manages timing, and stays reachable for the duration.",
  safety: [
    "Follow host guidance in venues and on streets",
    "Emergency support via bandiTour Local Friend if needed",
  ],
};

function slot(
  id: string,
  label: string,
  timeRange: string,
  spotsLeft: number,
  priceCents: number,
  language: string,
  startsAtIso: string,
): ExperienceAvailabilitySlot {
  return { id, label, timeRange, spotsLeft, priceCents, language, startsAtIso };
}

function review(
  id: string,
  authorName: string,
  authorPhotoUrl: string,
  rating: number,
  dateLabel: string,
  text: string,
): ExperienceReview {
  return { id, authorName, authorPhotoUrl, rating, dateLabel, text };
}

function step(
  id: string,
  title: string,
  description: string,
  durationLabel: string,
  imageUrl: string,
): ExperienceItineraryStep {
  return { id, title, description, durationLabel, imageUrl };
}

type Overlay = Omit<ExperienceDetail, keyof GuestExperience> & { title?: string };

/** Rich overlays keyed by GuestExperience.id — unique photography throughout. */
const DETAIL_BY_ID: Record<string, Overlay> = {
  exp_costume_warehouse: {
    shortDescription:
      "Theatrical warehouse, impossible looks, try-on with a drag queen. Backstage Athens — not a boutique crawl.",
    reviewCount: 64,
    gallery: [
      img("photo-1558769132-cb1aea458c5e"),
      img("photo-1508807526345-15e9b5f4eaff"),
      img("photo-1509631179647-0177331693ae"),
      img("photo-1522335789203-aabd1fc54bc9"),
      img("photo-1580618672591-eb180b1a973f"),
      img("photo-1515886657613-9f3515b0c78f"),
    ],
    hostProfile: DIVINE,
    coreFacts: {
      meetingArea: "Warehouse door · Metaxourgeio",
      duration: "2.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 6 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("cw1", "Meet at the warehouse", "Divine unlocks the door and sets the vibe — this is archive, not retail.", "15 min", img("photo-1558769132-cb1aea458c5e", 700)),
      step("cw2", "Raid the racks", "Pull looks from theatre surplus and carnival leftovers. Nothing is behind glass.", "45 min", img("photo-1508807526345-15e9b5f4eaff", 700)),
      step("cw3", "Try-on & transformation", "Full try-on with guidance — silhouette, attitude, the photograph that proves it.", "50 min", img("photo-1522335789203-aabd1fc54bc9", 700)),
      step("cw4", "Backstage toast", "Welcome drink, stories from the Athens drag circuit, soft goodbyes.", "25 min", img("photo-1580618672591-eb180b1a973f", 700)),
    ],
    reviews: [
      review("cwr1", "Alex M.", img("photo-1500648767791-00dcc994a43e", 120), 5, "August 2026", "Felt like stealing a night from a theatre. Divine is hilarious and generous."),
      review("cwr2", "Priya S.", img("photo-1534528741775-53994a69daeb", 120), 5, "July 2026", "Not a shopping tour. Actual warehouse. I left different."),
    ],
    availability: [
      slot("cwa1", "Tonight", "19:30–22:00", 4, 8900, "English", "2026-08-08T19:30:00+03:00"),
      slot("cwa2", "Sat 9 Aug", "19:30–22:00", 5, 8900, "English", "2026-08-09T19:30:00+03:00"),
    ],
    meeting: {
      label: "Warehouse door · Metaxourgeio",
      address: "Unmarked warehouse · Metaxourgeio, Athens",
      description: "Look for the pink tape on the side door. Divine waits with a small bandiTour card.",
      lat: 37.9852,
      lng: 23.7208,
      directionsHint: "From PLAY · ~12 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["Comfortable base clothes for try-on", "Closed shoes"],
      ageRequirements: "Ages 18+",
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_market_chef: {
    shortDescription:
      "Market → shop → private kitchen → dinner. You choose the produce; a chef cooks it. Not a restaurant crawl.",
    reviewCount: 52,
    gallery: [
      img("photo-1488459716781-31db52582fe9"),
      img("photo-1542838132-92c53300491e"),
      img("photo-1556910103-1c02745aae4d"),
      img("photo-1606787366850-de6330128bfc"),
      img("photo-1466637574441-749b8f19452f"),
      img("photo-1504674900247-0877df9cc836"),
    ],
    hostProfile: LEONIDAS,
    coreFacts: {
      meetingArea: "Varvakios main gate",
      duration: "4 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 4 guests",
      setting: "Indoor & outdoor",
    },
    itinerary: [
      step("mc1", "Market briefing", "Leonidas maps stalls worth your money — fish, greens, cheese — then you decide.", "20 min", img("photo-1488459716781-31db52582fe9", 700)),
      step("mc2", "Shop together", "Buy what dinner will become. Credit included; curiosity encouraged.", "50 min", img("photo-1542838132-92c53300491e", 700)),
      step("mc3", "Kitchen cook", "Private kitchen. You help or watch — he cooks your haul into a full meal.", "90 min", img("photo-1556910103-1c02745aae4d", 700)),
      step("mc4", "Dinner at the table", "Eat what you shopped. Wine pair. Stories from markets that still matter.", "60 min", img("photo-1606787366850-de6330128bfc", 700)),
    ],
    reviews: [
      review("mcr1", "Hannah L.", img("photo-1494790108377-be9c29b29330", 120), 5, "August 2026", "Best meal of the trip — because we chose every ingredient."),
      review("mcr2", "Omar R.", img("photo-1472099645785-5658abf4ff4e", 120), 5, "June 2026", "Zero tourist-restaurant energy. Pure market-to-table."),
    ],
    availability: [
      slot("mca1", "Tomorrow", "10:00–14:00", 3, 12500, "English", "2026-08-09T10:00:00+03:00"),
      slot("mca2", "Sun 10 Aug", "10:00–14:00", 4, 12500, "English", "2026-08-10T10:00:00+03:00"),
    ],
    meeting: {
      label: "Varvakios main gate",
      address: "Varvakios Central Market · Athinas, Athens",
      description: "Meet Leonidas at the main gate — chef whites folded under one arm, bandiTour card in the other.",
      lat: 37.9808,
      lng: 23.7265,
      directionsHint: "From PLAY · ~10 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      guestRequirements: [...DEFAULT_THINGS.guestRequirements, "Share dietary needs 24h ahead"],
      whatToBring: ["Appetite", "Comfortable shoes for the market"],
      ageRequirements: "Ages 14+ · under 16 with an adult",
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_destroy_clothes: {
    shortDescription:
      "Bring a garment you’d throw away. Cut, rebuild, leave with a one-of-one remake.",
    reviewCount: 41,
    gallery: [
      img("photo-1558171813-4c088753af8f"),
      img("photo-1525507119028-ed4c629a60a3"),
      img("photo-1489987707025-afc232f7ea0f"),
      img("photo-1445205170230-053b83016050"),
      img("photo-1594938298603-c8148c4dae35"),
    ],
    hostProfile: MARA,
    coreFacts: {
      meetingArea: "Remake atelier · Psyrri",
      duration: "3 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 5 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("dc1", "Bring the victim", "Show Mara the garment. Decide what dies and what gets reinvented.", "20 min", img("photo-1525507119028-ed4c629a60a3", 700)),
      step("dc2", "Destroy with purpose", "Cut, unpick, reverse — salvage becomes material.", "40 min", img("photo-1489987707025-afc232f7ea0f", 700)),
      step("dc3", "Rebuild", "Pattern hack and stitch a new silhouette. One of one.", "80 min", img("photo-1558171813-4c088753af8f", 700)),
      step("dc4", "Finish & wear", "Final presses, photos, and you leave wearing the remake.", "30 min", img("photo-1445205170230-053b83016050", 700)),
    ],
    reviews: [
      review("dcr1", "Jules K.", img("photo-1529626455594-4ff0802cfb7e", 120), 5, "July 2026", "Destroyed a boring blazer. Left with something I’d actually wear."),
    ],
    availability: [
      slot("dca1", "Sat 9 Aug", "14:00–17:00", 5, 9800, "English", "2026-08-09T14:00:00+03:00"),
      slot("dca2", "Sun 10 Aug", "14:00–17:00", 4, 9800, "English", "2026-08-10T14:00:00+03:00"),
    ],
    meeting: {
      label: "Remake atelier · Psyrri",
      address: "Atelier courtyard · Psyrri, Athens",
      description: "Ring the brass bell. Mara meets you with scissors already open.",
      lat: 37.9778,
      lng: 23.7241,
      directionsHint: "From PLAY · ~5 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      guestRequirements: [
        ...DEFAULT_THINGS.guestRequirements,
        "Bring one clean garment you are willing to permanently alter",
      ],
      whatToBring: ["Garment to remake", "Closed shoes", "Hair tie if needed"],
      ageRequirements: "Ages 16+",
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_dj_tonight: {
    shortDescription:
      "Real booth. Real decks. Learn the cues, then play a mini-set. Nightlife-first.",
    reviewCount: 38,
    gallery: [
      img("photo-1571330735066-03aaa9429d89"),
      img("photo-1470229722913-7c0e2dbbafd3"),
      img("photo-1514525253161-7a46d19cd819"),
      img("photo-1511379938547-c1f69419868d"),
      img("photo-1470225620780-dba8ba36b745"),
    ],
    hostProfile: NYX,
    coreFacts: {
      meetingArea: "Booth entrance · Gazi",
      duration: "2 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 2 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("dj1", "Booth orientation", "Nyx walks the mixer, levels, and cue headphones — no classroom slides.", "20 min", img("photo-1571330735066-03aaa9429d89", 700)),
      step("dj2", "Build a short stack", "Pick tracks, mark cues, rehearse one blend.", "40 min", img("photo-1511379938547-c1f69419868d", 700)),
      step("dj3", "Your mini-set", "The room is yours for a short set. Nyx stays on support.", "40 min", img("photo-1470229722913-7c0e2dbbafd3", 700)),
      step("dj4", "Debrief at the bar", "What worked, what to practice, soft exit into the night.", "20 min", img("photo-1514525253161-7a46d19cd819", 700)),
    ],
    reviews: [
      review("djr1", "Sam T.", img("photo-1539571696357-5a69c17a67c6", 120), 5, "August 2026", "Actual club booth. Hands shaking. Worth every euro."),
    ],
    availability: [
      slot("dja1", "Tonight", "22:00–00:00", 2, 11000, "English", "2026-08-08T22:00:00+03:00"),
      slot("dja2", "Sat 9 Aug", "22:00–00:00", 2, 11000, "English", "2026-08-09T22:00:00+03:00"),
    ],
    meeting: {
      label: "Booth entrance · Gazi",
      address: "Side booth door · Gazi, Athens",
      description: "Nyx meets you at the staff door — look for the neon ‘BOOTH’ tape.",
      lat: 37.9772,
      lng: 23.7145,
      directionsHint: "From PLAY · ~14 min walk or short taxi",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["USB with 6–10 tracks (optional)", "Closed shoes"],
      ageRequirements: "Ages 18+",
      accessibility: ["Booth has steps · not wheelchair accessible"],
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_white_cube: {
    shortDescription:
      "Indie galleries, studios, and pop-ups a curator actually visits — no museum tour.",
    reviewCount: 47,
    gallery: [
      img("photo-1536924940846-227afb31e2a5"),
      img("photo-1547891654-e66ed7ebb968"),
      img("photo-1513364776144-60967b0f800f"),
      img("photo-1579783902614-a3fb3927b6a5"),
      img("photo-1541961017774-22349e4a1262"),
    ],
    hostProfile: IRIS_CURATOR,
    coreFacts: {
      meetingArea: "First gallery door · Exarcheia",
      duration: "3 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 6 guests",
      setting: "Indoor & outdoor",
    },
    itinerary: [
      step("wc1", "Gallery one", "Iris opens with a space that rarely makes tourist lists.", "35 min", img("photo-1536924940846-227afb31e2a5", 700)),
      step("wc2", "Studio visit", "Meet a working artist mid-process — questions welcome.", "50 min", img("photo-1513364776144-60967b0f800f", 700)),
      step("wc3", "Pop-up or project room", "Whatever is live that week — Iris adjusts the route.", "40 min", img("photo-1547891654-e66ed7ebb968", 700)),
      step("wc4", "Closing drink", "Talk through what you saw over one drink nearby.", "30 min", img("photo-1579783902614-a3fb3927b6a5", 700)),
    ],
    reviews: [
      review("wcr1", "Elena V.", img("photo-1573496359142-b8d87734a5a2", 120), 5, "July 2026", "Finally an art night that wasn’t the Acropolis museum gift shop."),
    ],
    availability: [
      slot("wca1", "Fri 8 Aug", "17:00–20:00", 6, 7500, "English", "2026-08-08T17:00:00+03:00"),
      slot("wca2", "Sat 9 Aug", "17:00–20:00", 5, 7500, "English", "2026-08-09T17:00:00+03:00"),
    ],
    meeting: {
      label: "First gallery door · Exarcheia",
      address: "Independent gallery · Exarcheia, Athens",
      description: "Iris waits at the first door on the route — small black notebook, bandiTour card.",
      lat: 37.9865,
      lng: 23.7342,
      directionsHint: "From PLAY · ~16 min walk",
    },
    thingsToKnow: DEFAULT_THINGS,
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_dont_google: {
    shortDescription:
      "Phone away. Spontaneous insider route through doors that don’t list themselves.",
    reviewCount: 71,
    gallery: [
      img("photo-1516450360452-9312f5e86fc7"),
      img("photo-1492684223066-81342ee5ff30"),
      img("photo-1533174072545-7a4b6ad7a6c3"),
      img("photo-1504502350688-00f5d59bbdeb"),
      img("photo-1429962714451-bb934ecdc4ec"),
    ],
    hostProfile: KEYS,
    coreFacts: {
      meetingArea: "PLAY rooftop stairs",
      duration: "3.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 6 guests",
      setting: "Indoor & outdoor",
    },
    itinerary: [
      step("dg1", "Phone away", "Keys collects the route promise — no googling, no screenshots of doors.", "10 min", img("photo-1516450360452-9312f5e86fc7", 700)),
      step("dg2", "First door", "Wherever the night is actually happening — basement, courtyard, or club.", "50 min", img("photo-1492684223066-81342ee5ff30", 700)),
      step("dg3", "Second room", "Shift with the energy. Cover handled when needed.", "60 min", img("photo-1533174072545-7a4b6ad7a6c3", 700)),
      step("dg4", "Afters or soft exit", "One last stop — or a quiet walk back when the night peaks.", "40 min", img("photo-1504502350688-00f5d59bbdeb", 700)),
    ],
    reviews: [
      review("dgr1", "Maya C.", img("photo-1438761681033-6461ffad8d80", 120), 5, "August 2026", "I still don’t know the names of the places. That’s the point."),
    ],
    availability: [
      slot("dga1", "Tonight", "21:30–01:00", 5, 9500, "English", "2026-08-08T21:30:00+03:00"),
      slot("dga2", "Sat 9 Aug", "21:30–01:00", 6, 9500, "English", "2026-08-09T21:30:00+03:00"),
    ],
    meeting: {
      label: "PLAY rooftop stairs",
      address: "PLAY Theatrou · Psyrri, Athens",
      description: "Keys meets you on the rooftop stairs at 21:25 — black shirt, silver keyring.",
      lat: 37.9782,
      lng: 23.7245,
      directionsHint: "Inside your hotel",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      guestRequirements: [...DEFAULT_THINGS.guestRequirements, "Willingness to put your phone away"],
      ageRequirements: "Ages 21+",
      whatToBring: ["ID", "Cash for optional drinks", "Comfortable shoes"],
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_tattoo_flash: {
    shortDescription:
      "Pick from tonight’s flash sheet — drawn that week by an Athens illustrator — and leave with fresh ink.",
    reviewCount: 29,
    gallery: [
      img("photo-1611501275019-9b5cda994e8d"),
      img("photo-1581833971358-2c8b550f87b3"),
      img("photo-1522337660859-02fbefca4702"),
      img("photo-1513542789411-b6a5d4f31634"),
      img("photo-1452860606245-08befc0ff44b"),
    ],
    hostProfile: THEO,
    coreFacts: {
      meetingArea: "Studio bell · Exarcheia",
      duration: "2 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 4 guests (by appointment)",
      setting: "Indoor",
    },
    itinerary: [
      step("tf1", "Flash sheet reveal", "Theo pins this week’s drawings. You choose one.", "20 min", img("photo-1513542789411-b6a5d4f31634", 700)),
      step("tf2", "Placement & prep", "Size, placement, stencil — consent and clarity first.", "25 min", img("photo-1522337660859-02fbefca4702", 700)),
      step("tf3", "Ink session", "Flash tattooed same night. Focused, clean, unhurried.", "60 min", img("photo-1581833971358-2c8b550f87b3", 700)),
      step("tf4", "Aftercare", "Kit, instructions, and a photo of the flash before it heals.", "15 min", img("photo-1452860606245-08befc0ff44b", 700)),
    ],
    reviews: [
      review("tfr1", "Rio A.", img("photo-1506794778202-cad84cf45f1d", 120), 5, "June 2026", "Flash felt personal — drawn that week, not a shop wall of clichés."),
    ],
    availability: [
      slot("tfa1", "Thu 7 Aug", "19:00–21:00", 4, 14000, "English", "2026-08-07T19:00:00+03:00"),
      slot("tfa2", "Thu 14 Aug", "19:00–21:00", 4, 14000, "English", "2026-08-14T19:00:00+03:00"),
    ],
    meeting: {
      label: "Studio bell · Exarcheia",
      address: "Illustration studio · Exarcheia, Athens",
      description: "Ring once. Theo opens when the machine is ready.",
      lat: 37.9869,
      lng: 23.7351,
      directionsHint: "From PLAY · ~15 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      guestRequirements: [
        "Sober for the session",
        "No fresh sunburn on placement area",
        "Request mode — Theo confirms after dietary/health notes",
      ],
      ageRequirements: "Ages 18+ with ID",
      whatToBring: ["ID", "Loose clothing for placement"],
    },
    cancellationPolicyShort: "Free cancellation · 48 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_vinyl_dig: {
    shortDescription:
      "Crate-dig the bins DJs raid — then spin two finds on a listening station.",
    reviewCount: 33,
    gallery: [
      img("photo-1519677100203-a0e668c92439"),
      img("photo-1619983081563-430f63602796"),
      img("photo-1493225457124-a3eb161ffa5f"),
      img("photo-1487180144351-b8472da7d491"),
      img("photo-1511671782779-c97d3d27a1d4"),
    ],
    hostProfile: NYX,
    coreFacts: {
      meetingArea: "Record basement · Monastiraki",
      duration: "2.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 4 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("vd1", "Basement briefing", "Nyx maps the crates — greek funk, rebetiko, oddball 12\"s.", "15 min", img("photo-1519677100203-a0e668c92439", 700)),
      step("vd2", "Dig", "Hands in the bins. Pull candidates. Debate loudly.", "60 min", img("photo-1619983081563-430f63602796", 700)),
      step("vd3", "Listen & spin", "Two finds on the station. Learn what to listen for.", "45 min", img("photo-1493225457124-a3eb161ffa5f", 700)),
      step("vd4", "Take one home", "Record credit included — leave with something you’d actually play.", "20 min", img("photo-1487180144351-b8472da7d491", 700)),
    ],
    reviews: [
      review("vdr1", "Chris P.", img("photo-1463453091185-61582044d556", 120), 5, "May 2026", "Found a reissue I didn’t know existed. Nyx is a crate whisperer."),
    ],
    availability: [
      slot("vda1", "Sat 9 Aug", "12:00–14:30", 4, 6800, "English", "2026-08-09T12:00:00+03:00"),
    ],
    meeting: {
      label: "Record basement · Monastiraki",
      address: "Basement record shop · Monastiraki, Athens",
      description: "Stairs down. Nyx is already in the funk section.",
      lat: 37.9764,
      lng: 23.7259,
      directionsHint: "From PLAY · ~9 min walk",
    },
    thingsToKnow: DEFAULT_THINGS,
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_fragrance: {
    shortDescription:
      "Smell Athens in notes — then blend a personal scent to take home.",
    reviewCount: 44,
    gallery: [
      img("photo-1594035910387-fea47794261f"),
      img("photo-1547887537-6158d64c35b3"),
      img("photo-1587017539504-67cfbddac569"),
      img("photo-1553062407-98eeb64c6a62"),
    ],
    hostProfile: DANAE,
    coreFacts: {
      meetingArea: "Perfume lab · Kolonaki",
      duration: "2 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 5 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("fr1", "Athens smell-map", "Mastic, hot stone, night jasmine — learn the city’s notes.", "25 min", img("photo-1547887537-6158d64c35b3", 700)),
      step("fr2", "Blend", "Build your formula with Danae’s guidance.", "50 min", img("photo-1594035910387-fea47794261f", 700)),
      step("fr3", "Bottle & name", "Fill, label, take home a formula card.", "30 min", img("photo-1587017539504-67cfbddac569", 700)),
    ],
    reviews: [
      review("frr1", "Nora B.", img("photo-1580489944761-15a19d654956", 120), 5, "July 2026", "I still smell Athens when I open the bottle."),
    ],
    availability: [
      slot("fra1", "Sun 10 Aug", "11:00–13:00", 5, 9200, "English", "2026-08-10T11:00:00+03:00"),
    ],
    meeting: {
      label: "Perfume lab · Kolonaki",
      address: "Small lab · Kolonaki, Athens",
      description: "Second floor. Smell hits you before the doorbell.",
      lat: 37.9789,
      lng: 23.7451,
      directionsHint: "From PLAY · ~18 min metro/walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["Unperfumed skin if possible"],
      ageRequirements: "Ages 16+",
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_street_midnight: {
    shortDescription:
      "Empty alleys, neon bleed, late people — shoot with a photographer who works after midnight.",
    reviewCount: 36,
    gallery: [
      img("photo-1492691527719-9d1e07e534b4"),
      img("photo-1516035069371-29a1b244cc32"),
      img("photo-1477959858617-67f85cf4f1df"),
      img("photo-1493552152660-f915ab47ae9d"),
      img("photo-1470225620780-dba8ba36b745"),
    ],
    hostProfile: NIKOS_FRAME,
    coreFacts: {
      meetingArea: "Kerameikos tram stop",
      duration: "2.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 4 guests",
      setting: "Outdoor",
    },
    itinerary: [
      step("sm1", "Meet after midnight", "Settings check, intent, and the first alley.", "15 min", img("photo-1516035069371-29a1b244cc32", 700)),
      step("sm2", "Neon & empty streets", "Shoot light, texture, and the people who only appear late.", "70 min", img("photo-1492691527719-9d1e07e534b4", 700)),
      step("sm3", "Contact sheet share", "Review frames, edit tips, soft goodbye as the city wakes.", "30 min", img("photo-1477959858617-67f85cf4f1df", 700)),
    ],
    reviews: [
      review("smr1", "Lee J.", img("photo-1492562080023-ab3db95bfbce", 120), 5, "August 2026", "My only Athens photos that don’t look like daytime tourism."),
    ],
    availability: [
      slot("sma1", "Tonight", "00:15–02:45", 4, 7900, "English", "2026-08-09T00:15:00+03:00"),
    ],
    meeting: {
      label: "Kerameikos tram stop",
      address: "Kerameikos tram · Athens",
      description: "Nikos waits under the stop light with a small camera bag.",
      lat: 37.9786,
      lng: 23.7189,
      directionsHint: "From PLAY · ~11 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["Camera or phone", "Comfortable shoes", "Light layer"],
      ageRequirements: "Ages 18+",
      accessibility: ["Uneven pavement · night walking"],
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_yiayia_lunch: {
    shortDescription:
      "Her kitchen. Her pace. Roll dough, stir the pot, eat at her table.",
    reviewCount: 88,
    gallery: [
      img("photo-1556911220-e15b29be8c8f"),
      img("photo-1466637574441-749b8f19452f"),
      img("photo-1414235077428-338989a2e8c0"),
      img("photo-1504674900247-0877df9cc836"),
    ],
    hostProfile: YIAYIA,
    coreFacts: {
      meetingArea: "Apartment door · Kypseli",
      duration: "3.5 hours",
      languages: ["Greek", "English"],
      groupSize: "Up to 4 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("yl1", "Welcome at the door", "Aprons on. Coffee. The plan is lunch — nothing rushed.", "20 min", img("photo-1556911220-e15b29be8c8f", 700)),
      step("yl2", "Cook together", "Dough, pot, salad — her recipes, your hands.", "90 min", img("photo-1466637574441-749b8f19452f", 700)),
      step("yl3", "Sunday table", "Eat what you made. Stories. Second helpings mandatory.", "70 min", img("photo-1414235077428-338989a2e8c0", 700)),
      step("yl4", "Recipe notes", "Leave with handwritten notes and leftovers if she insists.", "20 min", img("photo-1504674900247-0877df9cc836", 700)),
    ],
    reviews: [
      review("ylr1", "Sophie W.", img("photo-1594744803329-e58b31de8bf5", 120), 5, "June 2026", "I cried at the table. In a good way."),
    ],
    availability: [
      slot("yla1", "Sun 10 Aug", "11:30–15:00", 4, 8500, "Greek", "2026-08-10T11:30:00+03:00"),
    ],
    meeting: {
      label: "Apartment door · Kypseli",
      address: "Residential building · Kypseli, Athens",
      description: "Third floor. Eleni opens when she smells you’ve arrived.",
      lat: 37.9912,
      lng: 23.7368,
      directionsHint: "From PLAY · ~20 min metro/bus",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      guestRequirements: ["Share allergies 48h ahead", "Request confirmation required"],
      ageRequirements: "Ages 12+ · under 16 with an adult",
      whatToBring: ["Appetite", "Comfortable clothes"],
    },
    cancellationPolicyShort: "Free cancellation · 48 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_silver_bench: {
    shortDescription:
      "Sketch, saw, and finish a silver piece — leave wearing something new.",
    reviewCount: 55,
    gallery: [
      img("photo-1617038260897-41a1f14a8ca0"),
      img("photo-1515562141207-7a88fb7ce338"),
      img("photo-1535632066927-ab7c9ab60908"),
      img("photo-1565193566173-7a0ee3dbe261"),
    ],
    hostProfile: DAPHNE,
    coreFacts: {
      meetingArea: "Bench studio · Psyrri",
      duration: "2.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 4 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("sb1", "Design", "Sketch a simple form Daphne can help you finish today.", "25 min", img("photo-1515562141207-7a88fb7ce338", 700)),
      step("sb2", "Saw & file", "Hands on the bench — noise, silver dust, focus.", "70 min", img("photo-1617038260897-41a1f14a8ca0", 700)),
      step("sb3", "Finish & wear", "Polish, string or clasp, leave wearing it.", "35 min", img("photo-1535632066927-ab7c9ab60908", 700)),
    ],
    reviews: [
      review("sbr1", "Ingrid M.", img("photo-1531123897727-8f129e1688ce", 120), 5, "July 2026", "I wear the ring every day. Still smells like the studio."),
    ],
    availability: [
      slot("sba1", "Sat 9 Aug", "11:00–13:30", 4, 10500, "English", "2026-08-09T11:00:00+03:00"),
    ],
    meeting: {
      label: "Bench studio · Psyrri",
      address: "Jewellery bench · Psyrri, Athens",
      description: "Ground floor studio. Daphne is already at the bench.",
      lat: 37.9775,
      lng: 23.7238,
      directionsHint: "From PLAY · ~5 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["Closed shoes", "Hair tied back"],
      ageRequirements: "Ages 16+",
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_graffiti_wall: {
    shortDescription:
      "Legal wall. Real cans. Paint a section with an Athens street artist.",
    reviewCount: 31,
    gallery: [
      img("photo-1459908676235-d5f02a50184b"),
      img("photo-1515405295579-ba7b45403062"),
      img("photo-1460661419201-fd4cecdf8a8b"),
      img("photo-1578301978162-7aae4d755744"),
      img("photo-1549490349-8643362247b5"),
    ],
    hostProfile: SPRAY,
    coreFacts: {
      meetingArea: "Wall gate · Metaxourgeio",
      duration: "2.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 6 guests",
      setting: "Outdoor",
    },
    itinerary: [
      step("gw1", "Wall briefing", "Legal wall rules, letters, and color plan.", "20 min", img("photo-1459908676235-d5f02a50184b", 700)),
      step("gw2", "Paint", "Cans, mask, gloves — your section under Lena’s eye.", "90 min", img("photo-1515405295579-ba7b45403062", 700)),
      step("gw3", "Document", "Photos of the piece before the city claims it.", "20 min", img("photo-1460661419201-fd4cecdf8a8b", 700)),
    ],
    reviews: [
      review("gwr1", "Tomo H.", img("photo-1548142813-c348350df52b", 120), 5, "May 2026", "Messy, loud, perfect. Still checking if the wall is up."),
    ],
    availability: [
      slot("gwa1", "Sat 9 Aug", "16:00–18:30", 6, 7200, "English", "2026-08-09T16:00:00+03:00"),
      slot("gwa2", "Today", "16:00–18:30", 6, 7200, "English", "2026-08-08T16:00:00+03:00"),
    ],
    meeting: {
      label: "Wall gate · Metaxourgeio",
      address: "Legal wall compound · Metaxourgeio, Athens",
      description: "Lena waits at the gate with spare masks.",
      lat: 37.9848,
      lng: 23.7212,
      directionsHint: "From PLAY · ~13 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["Clothes you can paint in", "Closed shoes"],
      ageRequirements: "Ages 16+",
      accessibility: ["Outdoor uneven ground"],
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_vintage_hunt: {
    shortDescription:
      "A stylist walks backstreet racks — military, 90s greek labels, leather you’ll wear.",
    reviewCount: 49,
    gallery: [
      img("photo-1487222477894-8943e31ef7b2"),
      img("photo-1552374196-1ab2a1c593e8"),
      img("photo-1617127365659-c47fa864d8bc"),
      img("photo-1504198458649-3128b932f49e"),
      img("photo-1556905055-8f358a7a47b2"),
    ],
    hostProfile: CHLOE,
    coreFacts: {
      meetingArea: "PLAY lobby",
      duration: "3 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 5 guests",
      setting: "Indoor & outdoor",
    },
    itinerary: [
      step("vh1", "Style brief", "What you want to find — silhouette, era, budget.", "15 min", img("photo-1487222477894-8943e31ef7b2", 700)),
      step("vh2", "Backstreet stop one", "Racks Chloe actually buys from.", "50 min", img("photo-1552374196-1ab2a1c593e8", 700)),
      step("vh3", "Stop two & three", "Military, labels, leather — edit as you go.", "70 min", img("photo-1617127365659-c47fa864d8bc", 700)),
      step("vh4", "Styling notes", "How to wear what you found — then soft goodbye.", "20 min", img("photo-1504198458649-3128b932f49e", 700)),
    ],
    reviews: [
      review("vhr1", "Ana R.", img("photo-1487412720507-e7ab37603c6f", 120), 5, "August 2026", "Skipped every tourist mall. Found a jacket I’ll keep for years."),
    ],
    availability: [
      slot("vha1", "Tomorrow", "15:00–18:00", 5, 6500, "English", "2026-08-09T15:00:00+03:00"),
    ],
    meeting: {
      label: "PLAY lobby",
      address: "PLAY Theatrou · Psyrri, Athens",
      description: "Chloe meets you in the lobby with a tote already half full of possibilities.",
      lat: 37.9782,
      lng: 23.7245,
      directionsHint: "Inside your hotel",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      whatToBring: ["Budget for purchases", "Comfortable shoes"],
      ageRequirements: "Ages 16+",
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_bakery_night: {
    shortDescription:
      "When ovens still run and the city is quiet — warm bread with night bakers.",
    reviewCount: 27,
    gallery: [
      img("photo-1509440159596-0249088772ff"),
      img("photo-1555507036-ab1f4038808a"),
      img("photo-1549931319-a545dcf3bc73"),
      img("photo-1495474472287-4d71bcdd2085"),
    ],
    hostProfile: ANDREAS_OVEN,
    coreFacts: {
      meetingArea: "Bakery alley · Psyrri",
      duration: "1.5 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 8 guests",
      setting: "Indoor & outdoor",
    },
    itinerary: [
      step("bn1", "Quiet alley meet", "Andreas times it for warm trays.", "10 min", img("photo-1509440159596-0249088772ff", 700)),
      step("bn2", "Oven side", "Watch the pull, taste koulouri and whatever just landed.", "40 min", img("photo-1555507036-ab1f4038808a", 700)),
      step("bn3", "Loaf to take", "Leave with warm bread while Athens sleeps.", "20 min", img("photo-1549931319-a545dcf3bc73", 700)),
    ],
    reviews: [
      review("bnr1", "Paul D.", img("photo-1507591064344-4c6ce005b128", 120), 5, "July 2026", "Best midnight snack of my life. Bakers waved like we belonged."),
    ],
    availability: [
      slot("bna1", "Tonight", "23:45–01:15", 8, 3900, "English", "2026-08-08T23:45:00+03:00"),
    ],
    meeting: {
      label: "Bakery alley · Psyrri",
      address: "Side alley bakery · Psyrri, Athens",
      description: "Smell the butter before you see Andreas.",
      lat: 37.9779,
      lng: 23.7252,
      directionsHint: "From PLAY · ~7 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      ageRequirements: "Ages 12+",
      whatToBring: ["Appetite", "Cash optional for extra pastries"],
    },
    cancellationPolicyShort: "Free cancellation · 12 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },

  exp_jazz_collector: {
    shortDescription:
      "A collector’s listening room, rare pressings, then a tiny basement live set.",
    reviewCount: 42,
    gallery: [
      img("photo-1514933651103-005eec06c04b"),
      img("photo-1429962714451-bb934ecdc4ec"),
      img("photo-1514525253161-7a46d19cd819"),
      img("photo-1492684223066-81342ee5ff30"),
    ],
    hostProfile: BLUE,
    coreFacts: {
      meetingArea: "Unmarked door · Exarcheia",
      duration: "3 hours",
      languages: ["English", "Greek"],
      groupSize: "Up to 6 guests",
      setting: "Indoor",
    },
    itinerary: [
      step("jc1", "Listening room", "Rare pressings on Blue’s system — headphones optional, reverence required.", "50 min", img("photo-1514933651103-005eec06c04b", 700)),
      step("jc2", "Stories from the crates", "How these records found Athens — and why they stay.", "30 min", img("photo-1429962714451-bb934ecdc4ec", 700)),
      step("jc3", "Basement live set", "Tiny set downstairs. No flyers. One drink included.", "70 min", img("photo-1514525253161-7a46d19cd819", 700)),
    ],
    reviews: [
      review("jcr1", "Daniel F.", img("photo-1507591064344-4c6ce005b128", 120), 5, "June 2026", "Felt like a secret society for people who still care about pressings."),
    ],
    availability: [
      slot("jca1", "Fri 8 Aug", "21:00–00:00", 6, 8800, "English", "2026-08-08T21:00:00+03:00"),
      slot("jca2", "Fri 15 Aug", "21:00–00:00", 6, 8800, "English", "2026-08-15T21:00:00+03:00"),
    ],
    meeting: {
      label: "Unmarked door · Exarcheia",
      address: "Unmarked door · Exarcheia, Athens",
      description: "Blue knocks twice from the inside when you’re on time.",
      lat: 37.9871,
      lng: 23.7338,
      directionsHint: "From PLAY · ~17 min walk",
    },
    thingsToKnow: {
      ...DEFAULT_THINGS,
      ageRequirements: "Ages 18+",
      whatToBring: ["Quiet curiosity", "ID"],
    },
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  },
};

function filterValidUrls(urls: string[]): string[] {
  return urls.filter((u) => isValidExperienceImageUrl(u));
}

function enrichFallback(base: GuestExperience): Overlay {
  const host: ExperienceHostProfile = {
    id: `host_${base.id}`,
    name: base.host,
    photoUrl: img("photo-1438761681033-6461ffad8d80", 400),
    expertise: `${base.category} host · ${base.area}`,
    bio: base.story,
    credentials: [`Host · ${base.area}`],
    yearsHosting: 3,
    languages: ["English"],
  };

  return {
    shortDescription: base.story,
    reviewCount: Math.max(12, Math.round(base.rating * 20)),
    gallery: filterValidUrls([base.imageUrl]),
    hostProfile: host,
    coreFacts: {
      meetingArea: base.meetingPoint,
      duration: base.duration,
      languages: host.languages,
      groupSize: `Up to ${Math.max(base.seatsLeft + 2, 6)} guests`,
      setting: base.category === "Workshops" ? "Indoor" : "Indoor & outdoor",
    },
    itinerary: [
      step("x1", `Meet · ${base.meetingPoint}`, "Orientation and welcome from your host.", "10 min", base.imageUrl),
      step("x2", `${base.area} exploration`, base.story, "60 min", base.imageUrl),
      step("x3", "Shared finish", "Wind down together — photos, questions, soft goodbye.", "20 min", base.imageUrl),
    ],
    reviews: [
      review(
        `${base.id}_r1`,
        "Guest",
        img("photo-1494790108377-be9c29b29330", 120),
        5,
        "Recently",
        `Loved ${base.title} with ${base.host}. Felt local and unexpected.`,
      ),
    ],
    availability: [
      slot(
        `${base.id}_av1`,
        base.when.split("·")[0]?.trim() || "Upcoming",
        base.when.includes("·") ? base.when.split("·")[1]!.trim() : base.duration,
        base.seatsLeft,
        base.priceCents,
        "English",
        new Date().toISOString(),
      ),
    ],
    meeting: {
      label: base.meetingPoint,
      address: `${base.meetingPoint} · ${base.area}, Athens`,
      description: `Meet your host at ${base.meetingPoint}.`,
      lat: 37.9755,
      lng: 23.7348,
      directionsHint: base.distance,
    },
    thingsToKnow: DEFAULT_THINGS,
    cancellationPolicyShort: "Free cancellation · 24 hours",
    commerceProductId: "prd_exp_sunrise",
    commerceWorkspaceId: "local-experiences",
  };
}

export function getExperienceDetail(id: string): ExperienceDetail | undefined {
  const base = GUEST_EXPERIENCES.find((e) => e.id === id);
  if (!base) return undefined;
  if (!isValidExperienceImageUrl(base.imageUrl)) return undefined;

  const overlay = DETAIL_BY_ID[id] ?? enrichFallback(base);
  const { title: overlayTitle, ...rest } = overlay;
  const gallery = filterValidUrls(rest.gallery.length ? rest.gallery : [base.imageUrl]);
  if (!gallery.length) return undefined;

  const itinerary = rest.itinerary
    .map((s) => ({ ...s, imageUrl: isValidExperienceImageUrl(s.imageUrl) ? s.imageUrl : gallery[0]! }))
    .filter((s) => isValidExperienceImageUrl(s.imageUrl));

  const hostPhoto = isValidExperienceImageUrl(rest.hostProfile.photoUrl)
    ? rest.hostProfile.photoUrl
    : gallery[0]!;

  return {
    ...base,
    ...rest,
    title: overlayTitle ?? base.title,
    gallery,
    itinerary,
    hostProfile: { ...rest.hostProfile, photoUrl: hostPhoto },
    imageUrl: gallery[0]!,
  };
}

export function getExperienceById(id: string): GuestExperience | undefined {
  const exp = GUEST_EXPERIENCES.find((e) => e.id === id);
  if (!exp || !isValidExperienceImageUrl(exp.imageUrl)) return undefined;
  return exp;
}

/** Resolve Experience host identity from the catalog (not Local banDit Supabase IDs). */
export function getExperienceHostById(hostId: string): {
  host: ExperienceHostProfile;
  experienceIds: string[];
} | undefined {
  const id = String(hostId || "").trim();
  if (!id) return undefined;
  const experienceIds: string[] = [];
  let host: ExperienceHostProfile | undefined;
  for (const base of GUEST_EXPERIENCES) {
    const detail = getExperienceDetail(base.id);
    if (!detail) continue;
    const h = detail.hostProfile;
    if (h.id === id || h.banditId === id) {
      host = h;
      experienceIds.push(base.id);
    }
  }
  if (!host) return undefined;
  return { host, experienceIds };
}
