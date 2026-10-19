/**
 * Guest Workspace product worlds — seeded from the Workspace Guest App catalog.
 * Expo Guest App consumes this so upper tabs show live content (never placeholders).
 */

import {
  ATHENS_NEIGHBORHOOD_COORDS,
  PLAY_THEATROU_ORIGIN,
} from "@/lib/guest-workspace/shopGeo";

export type GuestExperience = {
  id: string;
  title: string;
  /** Filter chip (Workshops, Nightlife, Art, Fashion, Queer, Food, Music). */
  category: string;
  /** Card eyebrow — e.g. "Fashion / Queer Athens / Shopping". */
  categoryLabel?: string;
  duration: string;
  area: string;
  distance: string;
  rating: number;
  story: string;
  when: string;
  priceCents: number;
  /** Supplier-published unit — omitted when Workspace did not publish a basis. */
  priceBasis?: ExperiencePriceBasis;
  /** ISO currency from Workspace (defaults to EUR display only when API sends it). */
  currency?: string;
  seatsLeft: number;
  host: string;
  meetingPoint: string;
  included: string[];
  /** Required cover — listing is never rendered without a valid https URL. */
  imageUrl: string;
  availableToday: boolean;
  bookingMode: "instant" | "request";
  featured?: boolean;
  popularThisWeek?: boolean;
  /**
   * Editorial / inspiration DNA — browseable, never Workspace-bookable.
   * Live host inventory must leave this unset/false.
   */
  previewOnly?: boolean;
  /** Display-only example EUR — never sent to Commerce / Stripe. */
  priceIllustrative?: boolean;
};

/** Guest App editorial DNA ids (`exp_*`) — inspiration only, not live inventory. */
export function isEditorialExperienceId(id: string | null | undefined): boolean {
  const raw = String(id || "").trim();
  if (!/^exp_[a-z0-9_]+$/i.test(raw)) return false;
  // Workspace live listings use exp_<hex> — must stay bookable, never editorial DNA.
  if (/^exp_[0-9a-f]{8,}$/i.test(raw)) return false;
  return true;
}

/** Shown under illustrative card/detail prices — never implies bookability. */
export const EXAMPLE_PRICE_PREVIEW_LABEL = "Example price · Preview";

/** Mark a seed listing as preview (no Reserve/Pay, not counted as live). */
export function asEditorialPreview(exp: GuestExperience): GuestExperience {
  const basis =
    exp.priceBasis ?? defaultIllustrativePriceBasis(exp.category);
  const cents =
    exp.priceCents > 0
      ? exp.priceCents
      : illustrativeExperiencePriceCents(exp.id, exp.category).cents;
  return {
    ...exp,
    previewOnly: true,
    priceIllustrative: true,
    priceCents: cents,
    priceBasis: basis,
    currency: exp.currency || "EUR",
    availableToday: false,
    seatsLeft: 0,
    bookingMode: "request",
  };
}

/** Portrait-friendly Unsplash URL — 4:5 crop for marketplace cards. */
export function experienceCover(photoId: string, w = 900): string {
  const id = photoId.replace(/^photo-/, "");
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${Math.round((w * 5) / 4)}&q=80`;
}

/**
 * SmartTraveler category chips — curated independent local finds.
 * Not a discount marketplace; place-first discovery.
 */
export const SMART_TRAVELER_FILTER_CHIPS = [
  "All",
  "Fashion",
  "Vintage",
  "Second Hand",
  "Jewellery",
  "Art",
  "Galleries",
  "Books",
  "Design",
  "Records",
  "Makers",
  "Cafés",
  "Bars",
  "Food",
] as const;

export type SmartTravelerFilterChip = (typeof SMART_TRAVELER_FILTER_CHIPS)[number];

/** Private guest privilege — never the identity of the listing. */
export type SmartTravelerGuestPrivilege = {
  id: string;
  /** Short line under the card (e.g. "Studio visit · 15 min"). */
  label: string;
  /** Full detail on the place page. */
  detail: string;
  /** Kind for editorial framing — not a coupon type. */
  kind:
    | "private access"
    | "gift"
    | "drink"
    | "meet maker"
    | "reserved item"
    | "studio visit"
    | "secret menu"
    | "member price"
    | "priority table"
    | "small discount";
};

/**
 * Curated independent place — Hidden local businesses discovered through people.
 * Lead with the place; guest privilege is secondary.
 */
export type SmartTravelerPartner = {
  id: string;
  businessName: string;
  /** e.g. Independent jewellery studio */
  typeLabel: string;
  /** Neighbourhood for cards (e.g. Exarchia) */
  neighborhood: string;
  /** Full location line for maps / directions */
  location: string;
  hours: string;
  /** One-line banDit description on the card */
  banditLine: string;
  /** Curator attribution — e.g. "banDit pick" */
  curator: string;
  /** Owner / maker story (detail) */
  story: string;
  /** Why banDit chose it */
  whyVisit: string;
  /** What to look for inside */
  lookFor: string;
  signatureProduct: string;
  /** Unique hero — never reuse across listings */
  imageUrl: string;
  /** Extra editorial frames for detail gallery */
  gallery: string[];
  filterTags: Exclude<SmartTravelerFilterChip, "All">[];
  guestPrivilege?: SmartTravelerGuestPrivilege;
  /**
   * Legacy offer/coupon shapes — kept for older callers.
   * Prefer `guestPrivilege` for new UI.
   */
  offers: {
    id: string;
    title: string;
    detail: string;
    benefitType: string;
    hotelBenefit?: boolean;
    expiringToday?: boolean;
    saved?: boolean;
    /** Workspace-issued merchant redemption code (stable on listing). */
    uniqueCode?: string;
  }[];
  coupons: {
    id: string;
    title: string;
    detail: string;
    expiringToday?: boolean;
    saved?: boolean;
  }[];
};

export function partnerMatchesSmartTravelerFilter(
  partner: SmartTravelerPartner,
  filter: SmartTravelerFilterChip,
): boolean {
  if (filter === "All") return true;
  const tags = partner?.filterTags;
  if (!Array.isArray(tags)) return false;
  return tags.includes(filter);
}

/** Marketplace discovery badges — compact overlays on cards / detail. */
export type ShopBadge =
  | "Local maker"
  | "Vintage"
  | "New"
  | "Guest deal"
  | "Pickup nearby";

export type ShopFulfillment = "pickup" | "delivery" | "both";

export type ShopListing = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  /** Matches banDiShop category chips (Vintage, Art, Fashion, …). */
  category: string;
  condition: string;
  /** Neighborhood label under the card (e.g. Psyrri). */
  neighborhood: string;
  pickupArea: string;
  /** Real fulfillment pin — required for Nearby publish. */
  lat: number;
  lng: number;
  /** Pickup street address (seller fulfillment location). */
  pickupAddress: string;
  /** Canonical partner / seller identity (SmartTraveler × shop = same partner_id). */
  partnerId: string;
  sellerId: string;
  /** Discovery radius eligibility is computed client-side from origin. */
  distanceMinutes: number;
  /** Short distance line for cards — recomputed from origin when possible. */
  distanceLabel: string;
  sellerName: string;
  shopName: string;
  sellerRating: number;
  imageUrl: string;
  /** Extra gallery frames for product detail (unique URIs). */
  gallery: string[];
  availability: string[];
  badges?: ShopBadge[];
  fulfillment: ShopFulfillment;
  fulfillmentNote: string;
  /** Separate from discovery radius — only when seller offers local delivery. */
  deliveryRadiusKm?: number;
  stock?: number;
  featured?: boolean;
  limitedEdition?: boolean;
  collection?: string;
};

export const SHOP_CATEGORY_CHIPS = [
  "All",
  "Vintage",
  "Local Design",
  "Art",
  "Books",
  "Fashion",
  "Jewelry",
  "Home",
  "Food & Drink",
  "Handmade",
  "Photography",
  "Music",
  "Gifts",
  "Experiences",
] as const;

export type ShopCategoryChip = (typeof SHOP_CATEGORY_CHIPS)[number];

/** One side of a Travel in a Bottle paired journey (hotel or second stay). */
export type BottleStay = {
  name: string;
  nights: number;
  /** City for hotel; location label for second stay */
  city?: string;
  location?: string;
  emoji: string;
  imageUrl: string;
  /** Second-stay type: Forest Tree House, Beach Villa, Sailboat, etc. */
  type?: string;
  /** Host / property identity (second stay). */
  host?: string;
  /** Availability line for the matched night(s). */
  availability?: string;
  /** Extra photography for the second-stay detail gallery. */
  gallery?: string[];
  /** Guest rating (second stay). */
  rating?: number;
  /** Key attributes shown on cards, e.g. "🌲 Forest". */
  attributes?: string[];
};

/**
 * Paired journey matching — hotel + second sleeping experience = one curated trip.
 * Travel in a Bottle is trip planning / combining stays — not outdoor browsing,
 * and not primarily “extend your stay.”
 */
export type BottleMatch = {
  id: string;
  hotel: BottleStay;
  second: BottleStay;
  filterTags: string[];
  /** e.g. "From €196" */
  priceLabel: string;
  /** Short journey narrative */
  story: string;
  /** Primary CTA — "View journey" */
  cta: string;
  /** Secondary CTA — "Check availability" */
  availabilityCta: string;
  travelTime: string;
  distance: string;
  departure: string;
  /** Explicit total when hotel + second nights should be labeled (e.g. 5-night journey). */
  journeyNights?: number;
  /**
   * Inventory provenance. `sample` = labeled demo fixtures (never real reservations).
   * `provider_record` = Workspace verified sleeping stays.
   */
  inventorySource?: "provider_record" | "sample";
};

/** @deprecated Use BottleMatch */
export type BottleJourney = BottleMatch;

export const BOTTLE_FILTER_CHIPS = [
  "Mountains",
  "Sea",
  "Nature",
  "Luxury",
  "Wine",
  "Romantic",
  "Family",
  "Adventure",
  "Pet Friendly",
  "Remote Work",
] as const;

export type BottleFilterChip = (typeof BOTTLE_FILTER_CHIPS)[number];

/** Cities available for pre-trip planning. */
export const BOTTLE_PLAN_CITIES = ["Athens", "Attica coast", "Peloponnese"] as const;

/** Hotels selectable when planning before check-in. */
export const BOTTLE_PLAN_HOTELS = [
  { id: "play-theatrou", name: "PLAY Theatrou", city: "Athens" },
  { id: "nyx-athens", name: "NYX Athens", city: "Athens" },
  { id: "aluma-athens", name: "Athens hospitality partner", city: "Athens" },
] as const;

/** Suggested date windows for light pre-trip planning. */
export const BOTTLE_PLAN_DATES = [
  { id: "this-weekend", label: "This weekend", hotelNights: 2 },
  { id: "next-week", label: "Next week · 3 nights", hotelNights: 3 },
  { id: "long-weekend", label: "Long weekend · 4 nights", hotelNights: 3 },
  { id: "custom", label: "Flexible dates", hotelNights: 3 },
] as const;

/** Default hotel side when guest is at PLAY (overridden at runtime via white-label). */
export const DEFAULT_BOTTLE_HOTEL: BottleStay = {
  name: "PLAY Theatrou",
  nights: 3,
  city: "Athens",
  emoji: "🏨",
  imageUrl:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80",
};

export function journeyTotalNights(match: BottleMatch): number {
  return match.journeyNights ?? match.hotel.nights + match.second.nights;
}

export function journeyNightsLabel(match: BottleMatch): string {
  const n = journeyTotalNights(match);
  return `${n}-night journey`;
}

export type ImpactCause = {
  id: string;
  name: string;
  family: string;
  guestDescription: string;
  organizationName: string;
  imageLabel: string;
};

/** True when a cover/gallery URI is renderable — empty/broken = do not list. */
export function isValidExperienceImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/unavailable|placeholder|null|undefined|about:blank/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Listings without a valid cover never reach the marketplace grid. */
export function experiencesWithValidCover(list: GuestExperience[]): GuestExperience[] {
  return list.filter((e) => isValidExperienceImageUrl(e.imageUrl));
}

/**
 * bandiTour DNA experiences — unexpected · local · creative · slightly underground.
 * No Acropolis walks, hop-on tourism, or brochure sightseeing as brand lead.
 */
export const GUEST_EXPERIENCES: GuestExperience[] = [
  {
    id: "exp_costume_warehouse",
    title: "Raid a Costume Warehouse with an Athens Drag Queen",
    category: "Queer",
    categoryLabel: "Fashion / Queer Athens / Shopping",
    duration: "2.5 hours",
    area: "Metaxourgeio",
    distance: "12 min walk",
    rating: 4.97,
    story:
      "Enter a theatrical costume warehouse with a local drag queen. Outrageous pieces, vintage finds, wigs, stagewear — try things on and build a look tourists never see.",
    when: "Tonight · 19:30",
    priceCents: 8900,
    seatsLeft: 4,
    host: "Divine Athena",
    meetingPoint: "Warehouse door · Metaxourgeio",
    included: ["Host", "Try-on session", "Backstage photos", "Welcome drink"],
    imageUrl: experienceCover("1558769132-cb1aea458c5e"),
    availableToday: true,
    bookingMode: "instant",
    featured: true,
    popularThisWeek: true,
  },
  {
    id: "exp_market_chef",
    title: "Shop the Market. Then Let a Chef Cook It.",
    category: "Food",
    categoryLabel: "Food / Local Life / Private Experience",
    duration: "4 hours",
    area: "Varvakios",
    distance: "10 min walk",
    rating: 4.95,
    story:
      "MARKET → SHOP → KITCHEN → DINNER. Choose ingredients with a chef, then cook and eat what you bought in a private home kitchen. Not a restaurant tour.",
    when: "Tomorrow · 10:00",
    priceCents: 12500,
    seatsLeft: 3,
    host: "Chef Leonidas",
    meetingPoint: "Varvakios main gate",
    included: ["Market spend credit", "Chef", "Kitchen seat", "Full dinner", "Wine pair"],
    imageUrl: experienceCover("1488459716781-31db52582fe9"),
    availableToday: false,
    bookingMode: "instant",
    featured: true,
    popularThisWeek: true,
  },
  {
    id: "exp_destroy_clothes",
    title: "Destroy Your Clothes. Make Something Better.",
    category: "Workshops",
    categoryLabel: "Workshop / Fashion / Sustainable Design",
    duration: "3 hours",
    area: "Psyrri",
    distance: "5 min walk",
    rating: 4.93,
    story:
      "DON’T BUY ANOTHER GARMENT. REMAKE ONE. Bring an old piece — cut, combine, print, stitch, distort, rebuild. Leave with a one-of-one.",
    when: "Sat · 14:00",
    priceCents: 9800,
    seatsLeft: 5,
    host: "Mara Vlachou",
    meetingPoint: "Remake atelier · Psyrri",
    included: ["Mentor", "Tools", "Notions", "Take-home remake"],
    imageUrl: experienceCover("1558171813-4c088753af8f"),
    availableToday: false,
    bookingMode: "instant",
    featured: true,
    popularThisWeek: true,
  },
  {
    id: "exp_dj_tonight",
    title: "Tonight, You’re the DJ.",
    category: "Music",
    categoryLabel: "Music / Nightlife / Workshop",
    duration: "2 hours",
    area: "Gazi",
    distance: "14 min walk",
    rating: 4.91,
    story:
      "Real Athens DJ booth. Cueing, mixing, transitions, reading a room — then play your own short set. Nightlife-first, not a classroom.",
    when: "Tonight · 22:00",
    priceCents: 11000,
    seatsLeft: 2,
    host: "DJ Nyx",
    meetingPoint: "Booth entrance · Gazi",
    included: ["Booth time", "Mentor", "USB prep", "One guest +1"],
    imageUrl: experienceCover("1571330735066-03aaa9429d89"),
    availableToday: true,
    bookingMode: "instant",
    featured: true,
    popularThisWeek: true,
  },
  {
    id: "exp_white_cube",
    title: "Athens After the White Cube",
    category: "Art",
    categoryLabel: "Art / Galleries / Local Curator",
    duration: "3 hours",
    area: "Exarcheia",
    distance: "16 min walk",
    rating: 4.9,
    story:
      "A curator leads independent galleries, project spaces, artist studios, and pop-ups — what is actually happening this week. No museum-tour feeling.",
    when: "Fri · 17:00",
    priceCents: 7500,
    seatsLeft: 6,
    host: "Iris Papadimitriou",
    meetingPoint: "First gallery door · Exarcheia",
    included: ["Curator host", "Studio visit", "Opening-night invite when live"],
    imageUrl: experienceCover("1536924940846-227afb31e2a5"),
    availableToday: false,
    bookingMode: "instant",
    featured: true,
  },
  {
    id: "exp_dont_google",
    title: "Don’t Google Tonight.",
    category: "Nightlife",
    categoryLabel: "Nightlife / Clubs / After Dark",
    duration: "3.5 hours",
    area: "Psyrri → Kerameikos",
    distance: "6 min walk",
    rating: 4.94,
    story:
      "A local builds the night in real time — drink, bar, club, maybe elsewhere. Route shifts with DJs, crowd, and your taste. Spontaneous. Insider-led.",
    when: "Tonight · 21:30",
    priceCents: 9500,
    seatsLeft: 5,
    host: "Kostas “Keys”",
    meetingPoint: "PLAY rooftop stairs",
    included: ["Insider host", "Cover where needed", "One welcome shot"],
    imageUrl: experienceCover("1516450360452-9312f5e86fc7"),
    availableToday: true,
    bookingMode: "instant",
    featured: true,
    popularThisWeek: true,
  },
  {
    id: "exp_tattoo_flash",
    title: "Tattoo Flash Night with an Athens Illustrator",
    category: "Art",
    categoryLabel: "Art / Body / Illustrator Studio",
    duration: "2 hours",
    area: "Exarcheia",
    distance: "15 min walk",
    rating: 4.88,
    story:
      "Pick from the night’s flash sheet — drawn that week by an Athens illustrator — and leave with fresh ink.",
    when: "Thu · 19:00",
    priceCents: 14000,
    seatsLeft: 4,
    host: "Theo Ink",
    meetingPoint: "Studio bell · Exarcheia",
    included: ["Flash design", "Session", "Aftercare kit"],
    imageUrl: experienceCover("1611501275019-9b5cda994e8d"),
    availableToday: false,
    bookingMode: "request",
    popularThisWeek: true,
  },
  {
    id: "exp_vinyl_dig",
    title: "Vinyl Digging with a Local DJ",
    category: "Music",
    categoryLabel: "Music / Records / Local DJ",
    duration: "2.5 hours",
    area: "Monastiraki",
    distance: "9 min walk",
    rating: 4.87,
    story:
      "Crate-dig the bins DJs actually raid — greek funk, rebetiko reissues, oddball 12\"s — then spin two finds.",
    when: "Sat · 12:00",
    priceCents: 6800,
    seatsLeft: 4,
    host: "DJ Nyx",
    meetingPoint: "Record basement · Monastiraki",
    included: ["DJ host", "Listening station", "One record credit"],
    imageUrl: experienceCover("1519677100203-a0e668c92439"),
    availableToday: false,
    bookingMode: "instant",
  },
  {
    id: "exp_fragrance",
    title: "Build Your Own Athens Fragrance",
    category: "Workshops",
    categoryLabel: "Workshop / Scent / Local Life",
    duration: "2 hours",
    area: "Kolonaki",
    distance: "18 min",
    rating: 4.92,
    story:
      "Smell the city in notes — mastic, hot stone, night jasmine — then blend a personal scent to take home.",
    when: "Sun · 11:00",
    priceCents: 9200,
    seatsLeft: 5,
    host: "Danae Scent",
    meetingPoint: "Perfume lab · Kolonaki",
    included: ["Materials", "Bottle", "Formula card"],
    imageUrl: experienceCover("1594035910387-fea47794261f"),
    availableToday: false,
    bookingMode: "instant",
    featured: true,
  },
  {
    id: "exp_street_midnight",
    title: "Street Photography After Midnight",
    category: "Nightlife",
    categoryLabel: "Nightlife / Photography / After Dark",
    duration: "2.5 hours",
    area: "Kerameikos",
    distance: "11 min walk",
    rating: 4.89,
    story:
      "Empty alleys, neon bleed, people who only come out late — shoot with a photographer who works after midnight.",
    when: "Tonight · 00:15",
    priceCents: 7900,
    seatsLeft: 4,
    host: "Nikos Frame",
    meetingPoint: "Kerameikos tram stop",
    included: ["Photo host", "Route", "Edit tips", "Contact sheet share"],
    imageUrl: experienceCover("1492691527719-9d1e07e534b4"),
    availableToday: true,
    bookingMode: "instant",
  },
  {
    id: "exp_yiayia_lunch",
    title: "Cook Sunday Lunch with a Greek Grandmother",
    category: "Food",
    categoryLabel: "Food / Home Kitchen / Local Life",
    duration: "3.5 hours",
    area: "Kypseli",
    distance: "20 min",
    rating: 4.98,
    story:
      "Her kitchen. Her pace. Roll dough, stir the pot, eat at her table — the Sunday lunch tourists never get invited to.",
    when: "Sun · 11:30",
    priceCents: 8500,
    seatsLeft: 4,
    host: "Yiayia Eleni",
    meetingPoint: "Apartment door · Kypseli",
    included: ["Ingredients", "Lunch at table", "Recipe notes"],
    imageUrl: experienceCover("1556911220-e15b29be8c8f"),
    availableToday: false,
    bookingMode: "request",
    featured: true,
    popularThisWeek: true,
  },
  {
    id: "exp_silver_bench",
    title: "Design a Piece of Silver Jewellery",
    category: "Workshops",
    categoryLabel: "Workshop / Jewellery / Makers",
    duration: "2.5 hours",
    area: "Psyrri",
    distance: "5 min walk",
    rating: 4.91,
    story:
      "Sketch, saw, and finish a silver piece at a working bench — leave wearing something that didn’t exist this morning.",
    when: "Sat · 11:00",
    priceCents: 10500,
    seatsLeft: 4,
    host: "Daphne K.",
    meetingPoint: "Bench studio · Psyrri",
    included: ["Silver", "Tools", "Take-home piece"],
    imageUrl: experienceCover("1617038260897-41a1f14a8ca0"),
    availableToday: false,
    bookingMode: "instant",
  },
  {
    id: "exp_graffiti_wall",
    title: "Graffiti Wall with a Local Artist",
    category: "Art",
    categoryLabel: "Art / Street / Local Artist",
    duration: "2.5 hours",
    area: "Metaxourgeio",
    distance: "13 min walk",
    rating: 4.86,
    story:
      "Legal wall. Real cans. Paint a section with an Athens street artist — leave a mark the city keeps for a while.",
    when: "Sat · 16:00",
    priceCents: 7200,
    seatsLeft: 6,
    host: "Spray Lena",
    meetingPoint: "Wall gate · Metaxourgeio",
    included: ["Artist", "Cans", "Mask", "Gloves"],
    imageUrl: experienceCover("1459908676235-d5f02a50184b"),
    availableToday: true,
    bookingMode: "instant",
  },
  {
    id: "exp_vintage_hunt",
    title: "Vintage Hunt Through Athens Backstreets",
    category: "Fashion",
    categoryLabel: "Fashion / Vintage / Backstreets",
    duration: "3 hours",
    area: "Psyrri → Monastiraki",
    distance: "4 min walk",
    rating: 4.9,
    story:
      "A stylist walks you through backstreet racks — military, 90s greek labels, leather you’ll actually wear — not a tourist mall.",
    when: "Tomorrow · 15:00",
    priceCents: 6500,
    seatsLeft: 5,
    host: "Chloe Rack",
    meetingPoint: "PLAY lobby",
    included: ["Stylist host", "Three stops", "Styling notes"],
    imageUrl: experienceCover("1487222477894-8943e31ef7b2"),
    availableToday: false,
    bookingMode: "instant",
    popularThisWeek: true,
  },
  {
    id: "exp_bakery_night",
    title: "Late-Night Bakery Run",
    category: "Food",
    categoryLabel: "Food / After Dark / Local Life",
    duration: "1.5 hours",
    area: "Psyrri",
    distance: "7 min walk",
    rating: 4.85,
    story:
      "When the ovens still run and the city is quiet — warm bread, koulouri, and bakers who work while Athens sleeps.",
    when: "Tonight · 23:45",
    priceCents: 3900,
    seatsLeft: 8,
    host: "Andreas Oven",
    meetingPoint: "Bakery alley · Psyrri",
    included: ["Host", "Tastings", "Warm loaf to take"],
    imageUrl: experienceCover("1509440159596-0249088772ff"),
    availableToday: true,
    bookingMode: "instant",
  },
  {
    id: "exp_jazz_collector",
    title: "Underground Jazz Night with a Collector",
    category: "Music",
    categoryLabel: "Music / Jazz / Underground",
    duration: "3 hours",
    area: "Exarcheia",
    distance: "17 min walk",
    rating: 4.93,
    story:
      "A collector’s listening room, rare pressings, then a tiny live set in a basement that never advertises.",
    when: "Fri · 21:00",
    priceCents: 8800,
    seatsLeft: 6,
    host: "Mr. Blue Notes",
    meetingPoint: "Unmarked door · Exarcheia",
    included: ["Listening room", "Live set", "One drink"],
    imageUrl: experienceCover("1514933651103-005eec06c04b"),
    availableToday: false,
    bookingMode: "instant",
    featured: true,
  },
];

/** Helper — privilege also mirrored into legacy `offers` for older callers. */
function stPrivilege(
  privilege: SmartTravelerGuestPrivilege,
): Pick<SmartTravelerPartner, "guestPrivilege" | "offers" | "coupons"> {
  return {
    guestPrivilege: privilege,
    offers: [
      {
        id: privilege.id,
        title: privilege.label,
        detail: privilege.detail,
        benefitType: privilege.kind,
        hotelBenefit: true,
      },
    ],
    coupons: [],
  };
}

/**
 * DEMO / editorial SmartTraveler samples only.
 * Production source of truth is the Workspace public SmartTraveler API
 * (`/api/public/smarttraveler`, with `/api/discover` partners as deploy fallback).
 * Always merged in the Guest catalog UI (`mergeSmartTravelerCatalog`) alongside live partners.
 * Editorial rows are labeled and never substitute for server-verified redemption.
 *
 * Editorial notes: independent Athens places locals pass to each other —
 * no chains, no tourist traps, no discount-marketplace framing.
 * Every listing uses a unique hero photo (never reused across the grid).
 */
export const SMART_TRAVELER_PARTNERS: SmartTravelerPartner[] = [
  {
    id: "st_studio_nera",
    businessName: "Studio Nera",
    typeLabel: "Independent jewellery studio",
    neighborhood: "Exarchia",
    location: "Exarchia · upstairs workshop near Plateia",
    hours: "Tue–Sat 12:00–19:00",
    banditLine: "Small-batch silver pieces made upstairs by the owner.",
    curator: "banDit pick",
    story:
      "Nera works alone above a quiet stairwell — hammer, torch, unfinished rings on a felt tray. Neighbours know to knock twice.",
    whyVisit:
      "You meet the maker, not a sales floor. Nothing here was ordered for tourist footfall.",
    lookFor: "The unfinished tray by the window — ask which piece she’s finishing that week.",
    signatureProduct: "Hammered silver rings",
    imageUrl:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Jewellery", "Makers"],
    ...stPrivilege({
      id: "gp_nera",
      label: "Studio visit · 15 min with Nera",
      detail: "Show Guest App · private 15-minute studio visit and try-on with the maker.",
      kind: "studio visit",
    }),
  },
  {
    id: "st_archive_71",
    businessName: "Archive 71",
    typeLabel: "Edited vintage room",
    neighborhood: "Exarchia",
    location: "Exarchia · unmarked door on a side street",
    hours: "Wed–Sun 13:00–20:00",
    banditLine: "One rack of 70s linen and leather — no thrift dump.",
    curator: "Elena · Local banDit",
    story:
      "Kostas edits every piece before it hits the rail. If it looks like a costume, it doesn’t stay.",
    whyVisit: "Word-of-mouth racks you’d never find on a map pin.",
    lookFor: "The navy linen jacket with the mended cuff — often reserved under the counter.",
    signatureProduct: "Edited 70s linen",
    imageUrl:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Vintage", "Fashion", "Second Hand"],
    ...stPrivilege({
      id: "gp_archive71",
      label: "Reserved item hold · 24h",
      detail: "Ask for the banDit hold — one piece reserved for 24 hours under your name.",
      kind: "reserved item",
    }),
  },
  {
    id: "st_shelf",
    businessName: "Shelf",
    typeLabel: "Independent bookshop",
    neighborhood: "Exarchia",
    location: "Exarchia · reading corner behind the poetry wall",
    hours: "Mon–Sat 11:00–21:00",
    banditLine: "Greek poetry, travel essays, and a corner that never rushes you.",
    curator: "banDit pick",
    story:
      "Two shelves of English, three of Greek, and a chair that locals treat like a library card.",
    whyVisit: "Staff build a stack from what you’re actually reading — not bestsellers.",
    lookFor: "The handwritten ‘Athens nights’ shelf note near the door.",
    signatureProduct: "Local authors table",
    imageUrl:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Books"],
    ...stPrivilege({
      id: "gp_shelf",
      label: "Personal stack · five local titles",
      detail: "Staff pick a five-title Athens stack for you · member price on one title.",
      kind: "member price",
    }),
  },
  {
    id: "st_room_6",
    businessName: "Room 6",
    typeLabel: "Apartment gallery",
    neighborhood: "Psyrri",
    location: "Psyrri · sixth-floor flat, intercom unmarked",
    hours: "Thu–Sun 16:00–21:00",
    banditLine: "Emerging painters in a lived-in flat — openings smell like turpentine.",
    curator: "Andreas · Local banDit",
    story:
      "Curator Maria hangs shows in her own rooms. Shoes off at the door; wine on the balcony.",
    whyVisit: "Not a white-cube tourist gallery — a private room locals invite friends to.",
    lookFor: "The small works wall in the hallway — editions under €80.",
    signatureProduct: "Small works + limited prints",
    imageUrl:
      "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Galleries", "Art"],
    ...stPrivilege({
      id: "gp_room6",
      label: "Private viewing before open",
      detail: "Arrive 30 minutes early · private walk-through with Maria before public hours.",
      kind: "private access",
    }),
  },
  {
    id: "st_second_skin",
    businessName: "Second Skin",
    typeLabel: "Independent fashion atelier",
    neighborhood: "Kolonaki",
    location: "Kolonaki · ground-floor atelier with sewing machines visible",
    hours: "Mon–Sat 11:00–20:00",
    banditLine: "Soft tailoring cut in-house — linen that travels well.",
    curator: "banDit pick",
    story:
      "Iris drafts on paper, cuts on the table, and finishes hems while you wait if the piece is ready.",
    whyVisit: "Clothes made here — not shipped from a brand warehouse.",
    lookFor: "The sample rail marked ‘almost’ — often one size of each new cut.",
    signatureProduct: "Travel linen sets",
    imageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1555529902-5261145633bf?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Fashion", "Makers"],
    ...stPrivilege({
      id: "gp_secondskin",
      label: "Meet the maker · fit chat",
      detail: "15-minute fit conversation with Iris · pin adjustments on one piece.",
      kind: "meet maker",
    }),
  },
  {
    id: "st_object_object",
    businessName: "Object / Object",
    typeLabel: "Design objects room",
    neighborhood: "Kerameikos",
    location: "Kerameikos · quiet storefront near the old pottery streets",
    hours: "Wed–Sun 12:00–20:00",
    banditLine: "Lamps, stools, and paper goods with real material weight.",
    curator: "banDit pick",
    story:
      "A rotating room of Athenian studios — one designer per month, no filler stock.",
    whyVisit: "You buy from the studio that made it, not a concept-store middleman.",
    lookFor: "The monthly drop shelf — usually two or three pieces left by week two.",
    signatureProduct: "Studio lamp edit",
    imageUrl:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Design", "Makers"],
    ...stPrivilege({
      id: "gp_object",
      label: "First look on drop day",
      detail: "Text the shop with Guest App code · early access on monthly drop mornings.",
      kind: "private access",
    }),
  },
  {
    id: "st_needle_drop",
    businessName: "Needle Drop",
    typeLabel: "Vinyl listening room",
    neighborhood: "Exarchia",
    location: "Exarchia · basement crates under a bookshop",
    hours: "Daily 12:00–21:00",
    banditLine: "Greek jazz reissues and a booth that still smells like sleeves.",
    curator: "Nikos · Local banDit",
    story:
      "Brothers dig for reissues and local pressings. The booth is one person at a time — headphones, no rush.",
    whyVisit: "Ask for the Athens crate — they’ll dig while you listen.",
    lookFor: "The ‘staff slept on this’ shelf near the booth door.",
    signatureProduct: "Greek jazz reissue crate",
    imageUrl:
      "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Records"],
    ...stPrivilege({
      id: "gp_needle",
      label: "Private booth · 20 min",
      detail: "Reserved listening booth for 20 minutes · ask for the banDit Athens dig.",
      kind: "private access",
    }),
  },
  {
    id: "st_after_five",
    businessName: "After Five",
    typeLabel: "Hidden wine counter",
    neighborhood: "Psyrri",
    location: "Psyrri · narrow counter behind a shuttered workshop",
    hours: "Tue–Sun 17:00–01:00",
    banditLine: "Natural wines from tiny Greek producers — no playlist shouting.",
    curator: "banDit pick",
    story:
      "Eight seats, one sommelier, and bottles that never make hotel wine lists.",
    whyVisit: "Locals pass the address by voice — not Instagram.",
    lookFor: "The chalkboard with three pours that change every night.",
    signatureProduct: "Assyrtiko by the glass",
    imageUrl:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Bars"],
    ...stPrivilege({
      id: "gp_afterfive",
      label: "Welcome pour · house glass",
      detail: "One complimentary house pour when you show Guest App at the counter.",
      kind: "drink",
    }),
  },
  {
    id: "st_backroom",
    businessName: "Backroom",
    typeLabel: "Late gallery-bar",
    neighborhood: "Metaxourgeio",
    location: "Metaxourgeio · back courtyard through a print shop",
    hours: "Thu–Sat 20:00–02:00",
    banditLine: "Low light, local DJs, and art still hanging from last month’s show.",
    curator: "Maria · Local banDit",
    story:
      "Part gallery, part bar — the print shop closes, the courtyard opens, friends stay.",
    whyVisit: "Not a nightlife product — a friends’ room with a door code.",
    lookFor: "The courtyard mural wall — new piece every season.",
    signatureProduct: "Resident night + small works",
    imageUrl:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1561214115-f2f260980cb9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Bars", "Galleries", "Art"],
    ...stPrivilege({
      id: "gp_backroom",
      label: "Door code · before 22:00",
      detail: "Guest App unlocks the courtyard door code until 22:00 — skip the street queue.",
      kind: "private access",
    }),
  },
  {
    id: "st_tiny_cup",
    businessName: "Tiny Cup",
    typeLabel: "Hidden courtyard café",
    neighborhood: "Thisseio",
    location: "Thisseio · courtyard behind a green door",
    hours: "Daily 08:30–18:00",
    banditLine: "Slow drip, one pastry case, shade that locals protect.",
    curator: "banDit pick",
    story:
      "Four tables under a vine. The owner roasts small and closes when the beans run out.",
    whyVisit: "Quieter than every guidebook café within walking distance.",
    lookFor: "The honey latte — not on the board; ask.",
    signatureProduct: "Honey latte",
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1442512595331-e582b5e1f5e0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Cafés"],
    ...stPrivilege({
      id: "gp_tinycup",
      label: "Secret menu · honey latte",
      detail: "Ask for the banDit honey latte — not listed · pastry on the house with it.",
      kind: "secret menu",
    }),
  },
  {
    id: "st_myrto_objects",
    businessName: "Myrto Objects",
    typeLabel: "Independent jewellery studio",
    neighborhood: "Exarchia",
    location: "Exarchia · upstairs above a quiet stairwell",
    hours: "Tue–Sat 12:00–19:00",
    banditLine: "Small-batch silver pieces made upstairs by the owner.",
    curator: "banDit pick",
    story:
      "Myrto saws, files, and finishes every piece in the same room where she meets guests.",
    whyVisit: "The kind of studio friends text each other — never a jewellery arcade.",
    lookFor: "The felt tray of unfinished rings by the window.",
    signatureProduct: "Small-batch silver",
    imageUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Jewellery", "Makers"],
    ...stPrivilege({
      id: "gp_myrto",
      label: "Gift wrap + maker note",
      detail: "Complimentary gift wrap and a handwritten maker note with any purchase.",
      kind: "gift",
    }),
  },
  {
    id: "st_hide_seek",
    businessName: "Hide & Seek",
    typeLabel: "Second-hand edit",
    neighborhood: "Kypseli",
    location: "Kypseli · ground floor with blackout curtains",
    hours: "Thu–Sun 12:00–20:00",
    banditLine: "Denim, leather, and travel-size edits — nothing dusty.",
    curator: "Elena · Local banDit",
    story:
      "Owner pulls a suitcase edit if you say you’re flying soon. Everything else stays off the rail.",
    whyVisit: "Second hand with a curator’s eye — not a charity-shop scramble.",
    lookFor: "The ‘flying soon’ rail near the fitting curtain.",
    signatureProduct: "Travel denim & leather",
    imageUrl:
      "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Second Hand", "Vintage", "Fashion"],
    ...stPrivilege({
      id: "gp_hideseek",
      label: "Flying-soon edit · pulled for you",
      detail: "Tell them your flight day · a three-piece travel edit waiting under your name.",
      kind: "reserved item",
    }),
  },
  {
    id: "st_stoa_prints",
    businessName: "Stoa Prints",
    typeLabel: "Printmaker’s room",
    neighborhood: "Monastiraki",
    location: "Monastiraki · upstairs press behind a fabric shop",
    hours: "Tue–Sat 11:00–19:00",
    banditLine: "Signed Athens prints pulled on a hand press — no tourist frames.",
    curator: "banDit pick",
    story:
      "Yannis prints editions of thirty. When they’re gone, that plate retires.",
    whyVisit: "You leave with paper that still smells like ink.",
    lookFor: "The drying rack — ask which edition is mid-run.",
    signatureProduct: "Signed small editions",
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1459908676235-d5f02a50184b?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Art", "Makers"],
    ...stPrivilege({
      id: "gp_stoa",
      label: "Watch a pull · 10 min",
      detail: "Stand at the press while Yannis pulls one print · take home a press scrap.",
      kind: "meet maker",
    }),
  },
  {
    id: "st_yellow_pages",
    businessName: "Yellow Pages",
    typeLabel: "Used books & maps",
    neighborhood: "Plaka edge",
    location: "Edge of Plaka · away from the souvenir strip",
    hours: "Mon–Sat 10:00–20:00",
    banditLine: "Old maps, Greek essays, and a cat that owns the chair.",
    curator: "Andreas · Local banDit",
    story:
      "A family room of second-hand books — tourist guides stay in the back, out of sight.",
    whyVisit: "Maps and essays locals actually use — not Plaka souvenir paper.",
    lookFor: "The Attica hiking maps drawer under the counter.",
    signatureProduct: "Attica maps & essays",
    imageUrl:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Books", "Second Hand"],
    ...stPrivilege({
      id: "gp_yellow",
      label: "Map gift with any book",
      detail: "Complimentary folded Attica map with any book purchase · Guest App.",
      kind: "gift",
    }),
  },
  {
    id: "st_kerameikos_clay",
    businessName: "Kerameikos Clay",
    typeLabel: "Potter’s front room",
    neighborhood: "Kerameikos",
    location: "Kerameikos · kiln street window bench",
    hours: "Thu–Sun 11:00–19:00",
    banditLine: "Speckled pourers thrown by the potter you meet at the bench.",
    curator: "banDit pick",
    story:
      "Dimitra throws in the back and sells from the front — no wholesale middle.",
    whyVisit: "Buy the cup from the hands that shaped it.",
    lookFor: "The seconds shelf — beautiful flaws, honest prices.",
    signatureProduct: "Speckled pourers & cups",
    imageUrl:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1493106819501-66d381c466f1?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Makers", "Design"],
    ...stPrivilege({
      id: "gp_clay",
      label: "Mini cup with purchase",
      detail: "Complimentary mini cup with any purchase over €25 · show Guest App.",
      kind: "gift",
    }),
  },
  {
    id: "st_bar_limeni",
    businessName: "Bar Limeni",
    typeLabel: "Quiet neighbourhood bar",
    neighborhood: "Petralona",
    location: "Petralona · corner with no sign, just a blue bulb",
    hours: "Daily 19:00–02:00",
    banditLine: "One bartender, neighbours’ names known, citrus oils in the air.",
    curator: "Maria · Local banDit",
    story:
      "No cocktail theatre — house highballs and conversations that stay at the counter.",
    whyVisit: "A bar you’d only hear about from someone who lives nearby.",
    lookFor: "The blue bulb — if it’s on, they’re open.",
    signatureProduct: "Mastiha highball",
    imageUrl:
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Bars"],
    ...stPrivilege({
      id: "gp_limeni",
      label: "Priority stool · before 21:00",
      detail: "One reserved counter stool before 21:00 · welcome highball on the house.",
      kind: "priority table",
    }),
  },
  {
    id: "st_kafeneio_minor",
    businessName: "Kafeneio Minor",
    typeLabel: "Old-school kafeneio",
    neighborhood: "Psyrri",
    location: "Psyrri · back alley tables, no English menu board",
    hours: "Daily 08:00–17:00",
    banditLine: "Ellinikos, backgammon, and regulars who ignore tourists.",
    curator: "Nikos · Local banDit",
    story:
      "Three generations behind the same counter. Tour groups walk past; locals stay.",
    whyVisit: "The Athens morning that still feels like a neighbourhood.",
    lookFor: "The backgammon board that never leaves table three.",
    signatureProduct: "Ellinikos · medium sweet",
    imageUrl:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1442512595331-e582b5e1f5e0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Cafés"],
    ...stPrivilege({
      id: "gp_minor",
      label: "Loukoumi with your coffee",
      detail: "Complimentary loukoumi with any coffee · say you’re with banDit.",
      kind: "gift",
    }),
  },
  {
    id: "st_bread_circle",
    businessName: "Bread Circle",
    typeLabel: "Neighbourhood oven",
    neighborhood: "Psyrri",
    location: "Psyrri · dawn shutters, flour on the sill",
    hours: "Daily 07:00–15:00",
    banditLine: "Olive sourdough before the queue — locals know the side door.",
    curator: "banDit pick",
    story:
      "Yianni’s oven feeds the block. No branded bags, no brunch menu — just bread.",
    whyVisit: "Warm loaf without the tourist bakery line two streets over.",
    lookFor: "The side door after 07:15 — shorter than the front.",
    signatureProduct: "Olive sourdough",
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Food", "Makers"],
    ...stPrivilege({
      id: "gp_bread",
      label: "Koulouri with pastry box",
      detail: "Free koulouri with any pastry box · morning only · Guest App.",
      kind: "gift",
    }),
  },
  {
    id: "st_plateia_salt",
    businessName: "Plateia Salt",
    typeLabel: "Hidden meze table",
    neighborhood: "Thisseio",
    location: "Thisseio · courtyard behind a shuttered shopfront",
    hours: "Tue–Sun 13:00–23:00",
    banditLine: "Small plates, grill smoke, no tourist strip noise.",
    curator: "Elena · Local banDit",
    story:
      "Family kitchen, twelve seats, and a menu that changes with the market.",
    whyVisit: "Fish and meze without the guidebook terrace prices.",
    lookFor: "The chalkboard catch — always the best order.",
    signatureProduct: "Grilled catch of the day",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Food"],
    ...stPrivilege({
      id: "gp_plateia",
      label: "Priority table · dessert gift",
      detail: "Reserved courtyard table before 20:00 · house dessert for the table.",
      kind: "priority table",
    }),
  },
  {
    id: "st_paper_bone",
    businessName: "Paper & Bone",
    typeLabel: "Design stationery atelier",
    neighborhood: "Kolonaki",
    location: "Kolonaki · quiet mezzanine above a florist",
    hours: "Mon–Sat 11:00–19:00",
    banditLine: "Letterpress cards and notebooks bound upstairs.",
    curator: "banDit pick",
    story:
      "Two designers print and bind on site — editions small enough to sell out in a week.",
    whyVisit: "Paper gifts that don’t feel airport-bought.",
    lookFor: "The ‘this week’s type’ drawer under the press.",
    signatureProduct: "Letterpress Athens cards",
    imageUrl:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1516414447565-b14be0adf13e?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Design", "Makers", "Books"],
    ...stPrivilege({
      id: "gp_paper",
      label: "Press scrap set · free",
      detail: "Complimentary set of letterpress scraps with any notebook · Guest App.",
      kind: "gift",
    }),
  },
  {
    id: "st_found_wall",
    businessName: "Found Wall",
    typeLabel: "Corridor gallery",
    neighborhood: "Psyrri",
    location: "Psyrri · narrow corridor between two workshops",
    hours: "Wed–Sun 14:00–20:00",
    banditLine: "One wall, three artists a month — no gift shop.",
    curator: "Andreas · Local banDit",
    story:
      "A corridor that became a gallery because the landlords liked the paintings.",
    whyVisit: "You can see everything in five minutes — and leave with something real.",
    lookFor: "The price list taped at eye level — honest, no negotiation theatre.",
    signatureProduct: "Monthly three-artist wall",
    imageUrl:
      "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Galleries", "Art"],
    ...stPrivilege({
      id: "gp_found",
      label: "Member price on small works",
      detail: "Member price on any small work under €120 · show Guest App.",
      kind: "member price",
    }),
  },
  {
    id: "st_dust_denim",
    businessName: "Dust & Denim",
    typeLabel: "Vintage denim room",
    neighborhood: "Exarchia",
    location: "Exarchia · second floor, bell unmarked",
    hours: "Wed–Sun 13:00–20:00",
    banditLine: "Selvedge, worn-in jackets, and a fitting room with real light.",
    curator: "Elena · Local banDit",
    story:
      "Only denim and workwear that survived a proper edit — no novelty prints.",
    whyVisit: "Jackets you’d borrow from a friend’s closet, not a chain.",
    lookFor: "The ‘almost broken-in’ shelf — best travel jackets.",
    signatureProduct: "Worn-in jackets",
    imageUrl:
      "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1475178626620-a4d049f4c8a0?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Vintage", "Fashion", "Second Hand"],
    ...stPrivilege({
      id: "gp_dust",
      label: "Small discount · one jacket",
      detail: "Quiet member price on one jacket · never advertised in-store.",
      kind: "small discount",
    }),
  },
];

/**
 * banDiShop — local Athens marketplace seed.
 * Every listing uses a unique hero image (never reused across unrelated products).
 * Geo fields are filled by enrichShopListing (neighborhood → real Athens coords).
 */
type ShopListingSeed = Omit<
  ShopListing,
  "lat" | "lng" | "pickupAddress" | "partnerId" | "sellerId"
> &
  Partial<Pick<ShopListing, "lat" | "lng" | "pickupAddress" | "partnerId" | "sellerId">>;

function enrichShopListing(seed: ShopListingSeed): ShopListing {
  const neighborhoodKey = Object.keys(ATHENS_NEIGHBORHOOD_COORDS).find((k) =>
    seed.neighborhood.toLowerCase().includes(k.toLowerCase()),
  );
  const pin =
    seed.lat != null && seed.lng != null
      ? { lat: seed.lat, lng: seed.lng }
      : neighborhoodKey
        ? ATHENS_NEIGHBORHOOD_COORDS[neighborhoodKey]!
        : PLAY_THEATROU_ORIGIN;
  const sellerSlug = seed.sellerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return {
    ...seed,
    lat: pin.lat,
    lng: pin.lng,
    pickupAddress:
      seed.pickupAddress || `${seed.pickupArea}, ${seed.neighborhood}, Athens`,
    partnerId: seed.partnerId || `ptr_shop_${sellerSlug}`,
    sellerId: seed.sellerId || `seller_${sellerSlug}`,
    stock: seed.stock ?? 1,
  };
}

const BANDISHOP_SEED: ShopListingSeed[] = [
  {
    id: "lst_table",
    title: "Mid-century oak side table",
    description:
      "Solid oak side table with tapered legs and a warm honey finish. Light surface wear that reads as character — not damage. Easy to carry; fits a studio or hotel lounge corner.",
    priceCents: 8500,
    category: "Vintage",
    condition: "Good",
    neighborhood: "Psyrri",
    pickupArea: "PLAY lobby · Psyrri",
    distanceMinutes: 6,
    distanceLabel: "0.5 km · 6 min",
    sellerName: "Iris",
    shopName: "Iris Studio Finds",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1615529328331-f8917597711f?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today", "Pickup only"],
    badges: ["Vintage", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Lobby hold · same-day pickup from PLAY",
    featured: true,
    collection: "Local Finds",
  },
  {
    id: "lst_mugs",
    title: "Hand-thrown mug set (4)",
    description:
      "Speckled stoneware mugs from a Kerameikos home studio. Dishwasher-safe glaze, uneven rims on purpose. Sold as a set of four — perfect guest-apartment kit.",
    priceCents: 4200,
    category: "Handmade",
    condition: "New",
    neighborhood: "Kerameikos",
    pickupArea: "Little Tree Coffee",
    distanceMinutes: 5,
    distanceLabel: "0.4 km · 5 min",
    sellerName: "Iris",
    shopName: "Iris Clay",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1605883705077-8d3d3cebe78c?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1605883705077-8d3d3cebe78c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available this evening"],
    badges: ["Local maker", "New", "Guest deal"],
    fulfillment: "pickup",
    fulfillmentNote: "Meet at Little Tree · evenings after 17:00",
    featured: true,
  },
  {
    id: "lst_camera",
    title: "Olympus trip 35 · working",
    description:
      "Classic compact rangefinder-style trip camera. Light seals checked, shutter fires cleanly. Comes with a soft case — ready for Plaka golden hour.",
    priceCents: 12000,
    category: "Photography",
    condition: "Excellent",
    neighborhood: "Monastiraki",
    pickupArea: "Monastiraki Metro · exit A",
    distanceMinutes: 5,
    distanceLabel: "0.4 km · 5 min",
    sellerName: "Dimitris",
    shopName: "Film Corner Athens",
    sellerRating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Vintage", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Metro meet · 10-minute handoff",
    limitedEdition: true,
  },
  {
    id: "lst_books",
    title: "Greek poetry collection (6 vols)",
    description:
      "Cavafy, Seferis, and companions — mixed English & Greek editions with soft spines and margin notes from a previous reader. A quiet Athens souvenir that weighs less than ceramics.",
    priceCents: 2800,
    category: "Books",
    condition: "Good",
    neighborhood: "Avissinias",
    pickupArea: "Avissinias Square bookstall",
    distanceMinutes: 7,
    distanceLabel: "0.6 km · 7 min",
    sellerName: "Nikos",
    shopName: "Avissinias Books",
    sellerRating: 5.0,
    imageUrl:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["This weekend"],
    badges: ["Vintage"],
    fulfillment: "pickup",
    fulfillmentNote: "Weekend mornings at the square",
    collection: "Reading Corner",
  },
  {
    id: "lst_olive",
    title: "Kalamata olive oil gift trio",
    description:
      "Three small-batch bottles from a family press — early harvest, herb-infused, and classic. Tasting cards included. Hotel concierge can hold for checkout day.",
    priceCents: 3200,
    category: "Food & Drink",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "PLAY concierge",
    distanceMinutes: 1,
    distanceLabel: "Hotel · 1 min",
    sellerName: "Mara",
    shopName: "PLAY Local Pantry",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1606923829579-0cb981a83e2e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Guest deal", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Concierge hold · no extra fee",
    featured: true,
  },
  {
    id: "lst_print",
    title: "Anafiotika ink print",
    description:
      "Limited run of 40 — signed Anafiotika alley study in black ink on heavy stock. Ships flat or ready for lobby pickup with a protective sleeve.",
    priceCents: 5500,
    category: "Art",
    condition: "New",
    neighborhood: "Plaka",
    pickupArea: "Plaka studio · Anafiotika lane",
    distanceMinutes: 12,
    distanceLabel: "1.1 km · 12 min",
    sellerName: "Nikos R.",
    shopName: "Hidden Athens Press",
    sellerRating: 5.0,
    imageUrl:
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New"],
    fulfillment: "both",
    fulfillmentNote: "Studio pickup or rolled delivery same day",
    limitedEdition: true,
    featured: true,
  },
  {
    id: "lst_scarf",
    title: "Handwoven linen scarf",
    description:
      "Natural-dye linen from an Athens loom studio. Soft drape, stone and sage tones. Packs flat — the scarf locals wear on ferry wind nights.",
    priceCents: 4800,
    category: "Fashion",
    condition: "New",
    neighborhood: "Monastiraki",
    pickupArea: "Monastiraki atelier",
    distanceMinutes: 9,
    distanceLabel: "0.8 km · 9 min",
    sellerName: "Eleni",
    shopName: "Loom & Lane",
    sellerRating: 4.95,
    imageUrl:
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Pickup or courier"],
    badges: ["Local maker", "New"],
    fulfillment: "both",
    fulfillmentNote: "Same-day courier within central Athens",
    collection: "Local Finds",
  },
  {
    id: "lst_honey",
    title: "Thyme honey jar (500g)",
    description:
      "Mountain thyme harvest in a glass jar with a tasting card. Pair with yogurt or pack in a suitcase — sealed and gift-ready.",
    priceCents: 1800,
    category: "Food & Drink",
    condition: "New",
    neighborhood: "Monastiraki",
    pickupArea: "Herb & Honey Apothecary",
    distanceMinutes: 8,
    distanceLabel: "0.7 km · 8 min",
    sellerName: "Lena",
    shopName: "Herb & Honey Apothecary",
    sellerRating: 4.85,
    imageUrl:
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "Guest deal", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Counter pickup · hotel guest sample included",
  },
  {
    id: "lst_earrings",
    title: "Hammered brass drop earrings",
    description:
      "Hand-hammered brass drops with a soft matte finish. Lightweight — made in a Psyrri jewelry bench. Gift box included.",
    priceCents: 3600,
    category: "Jewelry",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "Psyrri bench studio",
    distanceMinutes: 4,
    distanceLabel: "0.3 km · 4 min",
    sellerName: "Danae",
    shopName: "Danae Metals",
    sellerRating: 4.97,
    imageUrl:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Walk-up from PLAY · 4 minutes",
    featured: true,
  },
  {
    id: "lst_vinyl",
    title: "Greek folk vinyl stack (5 LPs)",
    description:
      "Five cleaned LPs — rembetiko and island folk pressings from the late 70s. Sleeves show honest wear; vinyl graded VG+. Play-tested.",
    priceCents: 4500,
    category: "Music",
    condition: "Good",
    neighborhood: "Exarcheia",
    pickupArea: "Exarcheia record cellar",
    distanceMinutes: 14,
    distanceLabel: "1.3 km · 14 min",
    sellerName: "Kostas",
    shopName: "Cellar Spins",
    sellerRating: 4.7,
    imageUrl:
      "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1619983081563-430f63602796?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Afternoons"],
    badges: ["Vintage"],
    fulfillment: "pickup",
    fulfillmentNote: "Cellar open Tue–Sat after 15:00",
  },
  {
    id: "lst_chair",
    title: "Cane-back café chair",
    description:
      "Single cane-back chair rescued from a closed Psyrri café. Freshly tightened cane, dark stained wood. One piece — not a pair.",
    priceCents: 9500,
    category: "Home",
    condition: "Good",
    neighborhood: "Psyrri",
    pickupArea: "Side street · near To Kapaki",
    distanceMinutes: 5,
    distanceLabel: "0.4 km · 5 min",
    sellerName: "Yannis",
    shopName: "Street Salvage",
    sellerRating: 4.6,
    imageUrl:
      "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Vintage", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Buyer carries · seller helps to curb",
  },
  {
    id: "lst_photo",
    title: "Acropolis dawn photo print",
    description:
      "Archival pigment print from a local photographer — soft blue dawn over the rock, shot from Filopappou. 30×40 cm, signed verso.",
    priceCents: 6800,
    category: "Photography",
    condition: "New",
    neighborhood: "Thisio",
    pickupArea: "Thisio darkroom studio",
    distanceMinutes: 11,
    distanceLabel: "1.0 km · 11 min",
    sellerName: "Alex",
    shopName: "Filopappou Light",
    sellerRating: 4.92,
    imageUrl:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New"],
    fulfillment: "both",
    fulfillmentNote: "Flat pack or studio pickup",
    featured: true,
  },
  {
    id: "lst_bag",
    title: "Vegetable-tanned crossbody",
    description:
      "Small vegetable-tanned leather crossbody from a local design bench. Natural pull-up, brass hardware, fits passport and phone. Ages into honey tones.",
    priceCents: 8900,
    category: "Local Design",
    condition: "New",
    neighborhood: "Kolonaki",
    pickupArea: "Kolonaki design atelier",
    distanceMinutes: 18,
    distanceLabel: "1.8 km · 18 min",
    sellerName: "Theo",
    shopName: "Atelier Theo",
    sellerRating: 4.88,
    imageUrl:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["By appointment"],
    badges: ["Local maker", "New"],
    fulfillment: "both",
    fulfillmentNote: "Courier to hotel or atelier try-on",
  },
  {
    id: "lst_candle",
    title: "Fig & mastic candle",
    description:
      "Soy wax candle poured in Athens with fig leaf and Chios mastic. Ceramic vessel reusable as a cup. Burns ~40 hours.",
    priceCents: 2400,
    category: "Home",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "PLAY Shop shelf",
    distanceMinutes: 1,
    distanceLabel: "Hotel · 1 min",
    sellerName: "Mara",
    shopName: "PLAY Local Pantry",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600423115367-87ea7661688f?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Guest deal", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Grab from PLAY Shop anytime",
  },
  {
    id: "lst_vase",
    title: "Speckled ceramic bud vase",
    description:
      "Small wheel-thrown vase with a cloudy speckled glaze. Holds a single stem or dry olive branch. Made in Kerameikos.",
    priceCents: 2900,
    category: "Handmade",
    condition: "New",
    neighborhood: "Kerameikos",
    pickupArea: "Iris Clay studio",
    distanceMinutes: 10,
    distanceLabel: "0.9 km · 10 min",
    sellerName: "Iris",
    shopName: "Iris Clay",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1493106819501-66d381c466f1?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New"],
    fulfillment: "pickup",
    fulfillmentNote: "Studio door · knock twice",
  },
  {
    id: "lst_linen",
    title: "Stone linen shirt · M",
    description:
      "Oversized stone linen shirt from a local fashion label. Breathable, soft wash, unisex cut. Size M — one available.",
    priceCents: 7200,
    category: "Fashion",
    condition: "New",
    neighborhood: "Kolonaki",
    pickupArea: "Kolonaki showroom",
    distanceMinutes: 16,
    distanceLabel: "1.6 km · 16 min",
    sellerName: "Sofia",
    shopName: "Stone & Thread",
    sellerRating: 4.84,
    imageUrl:
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Try-on by appointment"],
    badges: ["Local maker", "New"],
    fulfillment: "pickup",
    fulfillmentNote: "Showroom try-on · 20-minute slot",
  },
  {
    id: "lst_ring",
    title: "Oxidized silver signet",
    description:
      "Handmade oxidized silver signet with a soft geometric face. Adjustable band. Comes in a recycled velvet pouch.",
    priceCents: 5200,
    category: "Jewelry",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "Danae Metals bench",
    distanceMinutes: 4,
    distanceLabel: "0.3 km · 4 min",
    sellerName: "Danae",
    shopName: "Danae Metals",
    sellerRating: 4.97,
    imageUrl:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Resize on the spot if needed",
  },
  {
    id: "lst_poster",
    title: "Psyrri night typography poster",
    description:
      "Local design studio poster — neon-letter homage to Psyrri nights on matte stock. Edition of 100. Looks sharp framed or clipped.",
    priceCents: 2200,
    category: "Local Design",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "Studio loft · above Little Tree",
    distanceMinutes: 3,
    distanceLabel: "0.2 km · 3 min",
    sellerName: "Ari",
    shopName: "Type & Night",
    sellerRating: 4.75,
    imageUrl:
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1634942537034-2531766767d1?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Rolled tube ready at loft",
    featured: true,
  },
  {
    id: "lst_pastry",
    title: "Weekend pastry box (6)",
    description:
      "Saturday morning pastry box from a neighborhood bakery — koulouri twists, pistachio baklava bites, and seasonal tarts. Pre-order by Friday 18:00.",
    priceCents: 2600,
    category: "Food & Drink",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "Courtyard bakery · near PLAY",
    distanceMinutes: 3,
    distanceLabel: "0.2 km · 3 min",
    sellerName: "Vasilis",
    shopName: "Courtyard Oven",
    sellerRating: 4.91,
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Sat morning pickup"],
    badges: ["Guest deal", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Collect 09:00–11:00 Saturday",
  },
  {
    id: "lst_giftset",
    title: "Athens maker gift crate",
    description:
      "Curated crate: honey jar, linen napkin, mini ceramic dish, and a typed note from the makers. Built for guests who want one perfect souvenir.",
    priceCents: 5800,
    category: "Gifts",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "PLAY concierge",
    distanceMinutes: 1,
    distanceLabel: "Hotel · 1 min",
    sellerName: "Mara",
    shopName: "PLAY Local Pantry",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Guest deal", "New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Wrapped at concierge · ready in 10 min",
    featured: true,
  },
  {
    id: "lst_radio",
    title: "Vintage transistor radio",
    description:
      "Working mid-century transistor radio with warm AM/FM tone. Cosmetic patina only — dials turn smoothly. Fun desk object that still plays.",
    priceCents: 6400,
    category: "Vintage",
    condition: "Good",
    neighborhood: "Avissinias",
    pickupArea: "Avissinias flea corner",
    distanceMinutes: 8,
    distanceLabel: "0.7 km · 8 min",
    sellerName: "Nikos",
    shopName: "Avissinias Books",
    sellerRating: 5.0,
    imageUrl:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Weekend mornings"],
    badges: ["Vintage"],
    fulfillment: "pickup",
    fulfillmentNote: "Flea corner · cash or card",
  },
  {
    id: "lst_workshop",
    title: "Ceramic afternoon · 2 seats",
    description:
      "Reserve two seats at Iris’s ceramic afternoon — throw a small cup, glaze later, take-home after firing. Marketplace listing for the experience slot, not a physical SKU.",
    priceCents: 7200,
    category: "Experiences",
    condition: "New",
    neighborhood: "Kerameikos",
    pickupArea: "Iris Clay studio",
    distanceMinutes: 10,
    distanceLabel: "0.9 km · 10 min",
    sellerName: "Iris",
    shopName: "Iris Clay",
    sellerRating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Today · 16:00"],
    badges: ["Local maker", "Guest deal"],
    fulfillment: "pickup",
    fulfillmentNote: "Arrive 10 min early · aprons provided",
    featured: true,
  },
  {
    id: "lst_cookbook",
    title: "Neighborhood meze cookbook",
    description:
      "Spiral-bound local cookbook with handwritten-style recipes from Psyrri kitchens — meze, pies, and a hotel-friendly shopping list for Monastiraki market.",
    priceCents: 1900,
    category: "Books",
    condition: "New",
    neighborhood: "Psyrri",
    pickupArea: "Little Tree Coffee counter",
    distanceMinutes: 3,
    distanceLabel: "0.2 km · 3 min",
    sellerName: "Elena",
    shopName: "Neighborhood Press",
    sellerRating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1478144592103-25e218a04891?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["New", "Pickup nearby"],
    fulfillment: "pickup",
    fulfillmentNote: "Ask barista for the green stack",
  },
  {
    id: "lst_necklace",
    title: "Olive-leaf gold vermeil necklace",
    description:
      "Delicate olive-leaf pendant in gold vermeil on a fine chain. Local collaboration piece — light enough for everyday, gift-boxed.",
    priceCents: 7800,
    category: "Jewelry",
    condition: "New",
    neighborhood: "Plaka",
    pickupArea: "Plaka jewelry nook",
    distanceMinutes: 12,
    distanceLabel: "1.1 km · 12 min",
    sellerName: "Danae",
    shopName: "Danae Metals",
    sellerRating: 4.97,
    imageUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80",
    ],
    availability: ["Available today"],
    badges: ["Local maker", "New"],
    fulfillment: "both",
    fulfillmentNote: "Nook pickup or hotel courier",
  },
];

export const BANDISHOP_LISTINGS: ShopListing[] = BANDISHOP_SEED.map(enrichShopListing);

export function getShopListingById(id: string): ShopListing | undefined {
  return BANDISHOP_LISTINGS.find((l) => l.id === id);
}

/** Unique resolvable image URLs for a listing (hero first, then gallery). */
export function shopListingImageUrls(listing: ShopListing): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw?: string) => {
    const url = (raw ?? "").trim();
    if (!url) return;
    const key = url.split("?")[0] ?? url;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(url);
  };
  push(listing.imageUrl);
  for (const g of listing.gallery ?? []) push(g);
  return out;
}

/** NO IMAGE = NO CARD — listing must expose at least one non-empty image URL. */
export function shopListingHasImage(listing: ShopListing): boolean {
  return shopListingImageUrls(listing).length > 0;
}

export function getRelatedShopListings(id: string, limit = 6): ShopListing[] {
  const current = getShopListingById(id);
  const pool = BANDISHOP_LISTINGS.filter(shopListingHasImage);
  if (!current) return pool.slice(0, limit);
  const sameCat = pool.filter(
    (l) => l.id !== id && l.category === current.category,
  );
  const rest = pool.filter(
    (l) => l.id !== id && l.category !== current.category,
  );
  return [...sameCat, ...rest].slice(0, limit);
}

/**
 * Paired journeys: hotel stay + second sleeping experience.
 * Night counts sum to a curated trip (e.g. 3+2, 2+2). Hotel name resolved at runtime.
 */
export const BOTTLE_MATCHES: BottleMatch[] = [
  {
    id: "match_forest",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 3 },
    second: {
      name: "Forest Tree House",
      nights: 2,
      location: "Mount Parnitha",
      type: "Tree House",
      emoji: "🌲",
      host: "Parnitha Forest Stay",
      availability: "2 nights open · check availability",
      rating: 4.92,
      attributes: ["🌲 Forest", "🔥 Fireplace", "🥾 Hiking"],
      imageUrl:
        "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1510798831971-5959226ce2ef?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Mountains", "Nature", "Adventure", "Romantic"],
    priceLabel: "From €196",
    travelTime: "45 min",
    distance: "38 km",
    departure: "After breakfast",
    story: "3 nights in the city. 2 nights somewhere unforgettable — pine canopy above Athens.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 5,
  },
  {
    id: "match_beach",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 3 },
    second: {
      name: "Cape Sea House",
      nights: 2,
      location: "Cape Sounion",
      type: "Beach House",
      emoji: "🏖",
      host: "Sounion Sea House",
      availability: "2 nights open · weekend",
      rating: 4.88,
      attributes: ["🌊 Sea view", "🌅 Sunset", "🏛 Temple nearby"],
      imageUrl:
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1499793983690-e29dafd473d5?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Sea", "Luxury", "Romantic", "Family"],
    priceLabel: "From €290",
    travelTime: "70 min",
    distance: "65 km",
    departure: "Afternoon transfer",
    story: "Pair your hotel with the Aegean — city mornings, temple light at night.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 5,
  },
  {
    id: "match_vineyard",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 2 },
    second: {
      name: "Nemea Vineyard Rooms",
      nights: 2,
      location: "Nemea",
      type: "Guesthouse",
      emoji: "🍇",
      host: "Nemea Estate Rooms",
      availability: "2 nights open · midweek",
      rating: 4.85,
      attributes: ["🍷 Wine tasting", "🌿 Vines", "🛋 Quiet nights"],
      imageUrl:
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1474722883778-792e7990302e?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Wine", "Nature", "Romantic", "Luxury"],
    priceLabel: "From €240",
    travelTime: "1h 25m",
    distance: "110 km",
    departure: "Late morning",
    story: "Add a second stay among the vines — hotel energy, then wine-country quiet.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 4,
  },
  {
    id: "match_sailboat",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 2 },
    second: {
      name: "Riviera Sailboat",
      nights: 2,
      location: "Athenian Riviera",
      type: "Sailboat",
      emoji: "⛵",
      host: "Riviera Charter Collective",
      availability: "2 nights open · sunset departures",
      rating: 4.9,
      attributes: ["⛵ Deck sleep", "🌟 Stars", "🧭 Skipper"],
      imageUrl:
        "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Sea", "Adventure", "Romantic", "Luxury"],
    priceLabel: "From €360",
    travelTime: "35 min",
    distance: "22 km",
    departure: "Before sunset",
    story: "Hotel + night on the water — one journey, two ways to sleep.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 4,
  },
  {
    id: "match_mountain",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 2 },
    second: {
      name: "Delphi Ridge Lodge",
      nights: 3,
      location: "Delphi region",
      type: "Mountain Lodge",
      emoji: "🏔",
      host: "Delphi Ridge Lodge",
      availability: "3 nights open · pets welcome",
      rating: 4.78,
      attributes: ["🏔 Mountains", "💻 Desk view", "🐕 Pet friendly"],
      imageUrl:
        "https://images.unsplash.com/photo-1518732714860-b62714ce0c59?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda2d?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Mountains", "Nature", "Adventure", "Remote Work", "Pet Friendly"],
    priceLabel: "From €330",
    travelTime: "2h 10m",
    distance: "180 km",
    departure: "Morning",
    story: "2 nights in Athens. 3 nights at altitude — space to work and wander.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 5,
  },
  {
    id: "match_glamping",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 3 },
    second: {
      name: "Olive Grove Glamping",
      nights: 2,
      location: "Attica hills",
      type: "Glamping",
      emoji: "🫒",
      host: "Attica Olive Camp",
      availability: "2 nights open · family tents",
      rating: 4.71,
      attributes: ["🫒 Olive grove", "🔥 Fire pit", "👨‍👩‍👧 Family"],
      imageUrl:
        "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Nature", "Family", "Adventure", "Pet Friendly"],
    priceLabel: "From €170",
    travelTime: "55 min",
    distance: "48 km",
    departure: "After lunch",
    story: "Pair the hotel with canvas under olives — soft nights after the city.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 5,
  },
  {
    id: "match_stone_cabin",
    hotel: { ...DEFAULT_BOTTLE_HOTEL, nights: 3 },
    second: {
      name: "Arachova Stone Cabin",
      nights: 2,
      location: "Arachova foothills",
      type: "Mountain Cabin",
      emoji: "🪵",
      host: "Arachova Cabin Collective",
      availability: "2 nights open · fireplace suites",
      rating: 4.91,
      attributes: ["🪵 Stone cabin", "🔥 Fireplace", "🏔 Mountain view"],
      imageUrl:
        "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1518732714860-b62714ce0c59?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda2d?auto=format&fit=crop&w=900&q=80",
      ],
    },
    filterTags: ["Mountains", "Nature", "Romantic", "Luxury"],
    priceLabel: "From €280",
    travelTime: "2h 00m",
    distance: "155 km",
    departure: "Morning",
    story: "3 nights at PLAY Theatrou. 2 nights in a mountain cabin — two ways to sleep, one journey.",
    cta: "View journey",
    availabilityCta: "Check availability",
    journeyNights: 5,
  },
];

/** Alias — prefer BOTTLE_MATCHES. */
export const BOTTLE_JOURNEYS = BOTTLE_MATCHES;

export function getBottleMatchById(id: string): BottleMatch | undefined {
  const found = BOTTLE_MATCHES.find((m) => m.id === id);
  return found ? { ...found, inventorySource: found.inventorySource || "sample" } : undefined;
}

/** True for editorial / fixture journeys — never produce real Workspace bookings. */
export function isSampleBottleMatch(match: Pick<BottleMatch, "id" | "inventorySource"> | null | undefined): boolean {
  if (!match) return false;
  if (match.inventorySource === "provider_record") return false;
  if (match.inventorySource === "sample") return true;
  return String(match.id || "").startsWith("match_");
}

export function withLiveHotelName(match: BottleMatch, hotelName: string): BottleMatch {
  const name = hotelName.trim();
  if (!name) return match;
  return {
    ...match,
    hotel: { ...match.hotel, name },
    story: (match.story || "").replace(/PLAY Theatrou/gi, name),
  };
}

/** Apply planned hotel nights from pre-trip date selection. */
export function withPlannedHotelNights(match: BottleMatch, hotelNights: number): BottleMatch {
  return {
    ...match,
    hotel: { ...match.hotel, nights: hotelNights },
    journeyNights: hotelNights + match.second.nights,
  };
}

export const IMPACT_VIEW = {
  dropsEarned: 92,
  dropsRequired: 100,
  oceansCompleted: 0,
  destination: "Athens, Greece",
  copy: "Your ocean is almost full — a few more drops complete this destination.",
  co2SavedKg: 12.4,
  plasticBottlesAvoided: 38,
  localBusinessesSupported: 6,
  treesContributed: 2,
  recentDrops: [
    { id: "d1", label: "Activated hotel QR at PLAY", drops: 1 },
    { id: "d2", label: "Completed Quiet Plaka loop", drops: 3 },
    { id: "d3", label: "Redeemed To Kapaki dessert", drops: 4 },
    { id: "d4", label: "Completed Don’t Google Tonight.", drops: 5 },
    { id: "d5", label: "bandiShop pickup · mugs", drops: 4 },
  ],
  passportEntries: [
    {
      id: "p1",
      destination: "Athens",
      causeName: "Cleaner beaches · Phaleron",
      date: "This stay",
      shareLine: "92 water drops toward a cleaner Athenian shore.",
    },
  ],
  causes: [
    {
      id: "cause_beach",
      name: "Cleaner beaches · Phaleron",
      family: "Ocean & beaches",
      guestDescription: "Supports community beach cleanups on the Attica coast.",
      organizationName: "Attica Blue",
      imageLabel: "Phaleron shore",
    },
    {
      id: "cause_heritage",
      name: "Keep Ancient Agora stories alive",
      family: "Cultural heritage",
      guestDescription: "Supports educational heritage visits around the Agora.",
      organizationName: "Agora Heritage",
      imageLabel: "Agora stones",
    },
    {
      id: "cause_school",
      name: "After-school reading in Exarcheia",
      family: "Schools",
      guestDescription: "Books and snacks for after-school studio hours.",
      organizationName: "Exarcheia Studio",
      imageLabel: "Reading corner",
    },
  ] as ImpactCause[],
  volunteer: [
    { id: "v1", title: "Beach morning · 2 hours", when: "Sat 09:00", drops: 8 },
    { id: "v2", title: "Agora story hour helper", when: "Sun 11:00", drops: 6 },
  ],
};

export type ExperiencePriceBasis = "per_person" | "per_group" | "per_experience";

type IllustrativePriceBand = {
  minCents: number;
  maxCents: number;
  basis: ExperiencePriceBasis;
};

const ILLUSTRATIVE_PRICE_BANDS: Record<string, IllustrativePriceBand> = {
  Workshops: { minCents: 4500, maxCents: 12500, basis: "per_person" },
  Nightlife: { minCents: 2200, maxCents: 6800, basis: "per_person" },
  Art: { minCents: 3500, maxCents: 9500, basis: "per_experience" },
  Fashion: { minCents: 4800, maxCents: 14000, basis: "per_experience" },
  Queer: { minCents: 3900, maxCents: 11000, basis: "per_experience" },
  Food: { minCents: 5500, maxCents: 16000, basis: "per_person" },
  Music: { minCents: 2800, maxCents: 8500, basis: "per_person" },
};

function stableExperienceHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function defaultIllustrativePriceBasis(category: string): ExperiencePriceBasis {
  return ILLUSTRATIVE_PRICE_BANDS[category]?.basis ?? "per_experience";
}

/** Deterministic EUR example — varied by category, stable per listing id. */
export function illustrativeExperiencePriceCents(
  id: string,
  category: string,
): { cents: number; basis: ExperiencePriceBasis } {
  const band = ILLUSTRATIVE_PRICE_BANDS[category] ?? {
    minCents: 4200,
    maxCents: 9800,
    basis: "per_experience" as ExperiencePriceBasis,
  };
  const step = 500;
  const span = Math.max(step, band.maxCents - band.minCents);
  const steps = Math.floor(span / step);
  const pick = stableExperienceHash(`${id}:${category}`) % (steps + 1);
  return { cents: band.minCents + pick * step, basis: band.basis };
}

export type ExperienceDisplayPrice = {
  cents: number;
  basis: ExperiencePriceBasis;
  currency: string;
  illustrative: boolean;
};

/** Card/detail display — real Workspace cents win; else deterministic example EUR. */
export function resolveExperienceDisplayPrice(exp: GuestExperience): ExperienceDisplayPrice {
  const currency = String(exp.currency || "EUR").toUpperCase() || "EUR";
  const basis =
    exp.priceBasis ?? defaultIllustrativePriceBasis(exp.category);
  const authorizedLive =
    exp.previewOnly !== true &&
    Number.isFinite(exp.priceCents) &&
    exp.priceCents > 0 &&
    exp.priceIllustrative !== true;
  if (authorizedLive) {
    return {
      cents: Math.round(exp.priceCents),
      basis: exp.priceBasis ?? basis,
      currency,
      illustrative: false,
    };
  }
  if (exp.previewOnly === true && exp.priceCents > 0) {
    return {
      cents: Math.round(exp.priceCents),
      basis,
      currency,
      illustrative: true,
    };
  }
  const ill = illustrativeExperiencePriceCents(exp.id, exp.category);
  return { cents: ill.cents, basis: ill.basis, currency, illustrative: true };
}

export function formatExperienceDisplayPrice(exp: GuestExperience): string {
  const d = resolveExperienceDisplayPrice(exp);
  return formatExperiencePrice(d.cents, d.basis, d.currency);
}

export function coerceExperiencePriceBasis(
  raw?: string | null,
): ExperiencePriceBasis | undefined {
  const s = String(raw || "").trim();
  if (s === "per_person" || s === "per_group" || s === "per_experience") return s;
  return undefined;
}

export function experiencePriceBasisLabel(basis: ExperiencePriceBasis): string {
  if (basis === "per_person") return "per person";
  if (basis === "per_group") return "per group";
  return "per experience";
}

export function formatEuro(cents: number) {
  if (!Number.isFinite(cents) || cents <= 0) return "Price on request";
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Supplier currency — EUR uses €; other ISO codes stay explicit. */
export function formatMoney(cents: number, currency = "EUR"): string {
  if (!Number.isFinite(cents) || cents <= 0) return "Price on request";
  const code = String(currency || "EUR").toUpperCase();
  if (code === "EUR") return formatEuro(cents);
  const major = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return `${code} ${major}`;
}

/** Listing / detail / checkout — no invented unit label when basis is missing. */
export function formatExperiencePrice(
  cents: number,
  basis?: ExperiencePriceBasis,
  currency = "EUR",
): string {
  const amount = formatMoney(cents, currency);
  if (amount === "Price on request") return amount;
  if (!basis) return amount;
  return `${amount} ${experiencePriceBasisLabel(basis)}`;
}

/** Commerce total — per-person multiplies by guests; flat fees match Workspace book_experience. */
export function experienceBookingTotalCents(
  unitCents: number,
  guestCount: number,
  basis?: ExperiencePriceBasis,
): number {
  if (!Number.isFinite(unitCents) || unitCents <= 0) return 0;
  const guests = Math.max(1, Math.floor(guestCount) || 1);
  if (basis === "per_person") return unitCents * guests;
  return unitCents;
}
