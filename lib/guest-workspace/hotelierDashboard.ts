/**
 * Hotelier inside Guest App — guest stay services only.
 * Hotelier OS staff KPIs (occupancy, arrivals, ops queues) never appear here.
 * Answer: "What can my hotel do for me right now?"
 */

import { isIsolatedPlaySandboxSlug } from "@/lib/stay/liveHotelIdentity";

export type HotelierModuleId =
  | "breakfast"
  | "restaurant"
  | "spa"
  | "roomService"
  | "lateCheckout"
  | "concierge"
  | "taxi"
  | "guestServices"
  | "events"
  | "campaigns"
  | "askHotel"
  | "messages"
  | "stayInfo"
  | "reservation"
  | "welcome"
  | "tv"
  | "push"
  | "createOffer";

export type QuickAction = {
  id: HotelierModuleId;
  title: string;
  subtitle: string;
  emoji: string;
};

export type TodayItem = {
  id: string;
  title: string;
  detail: string;
  module: HotelierModuleId;
  accent?: string;
};

export type CampaignCard = {
  id: string;
  title: string;
  detail: string;
  imageUrl: string;
  module: HotelierModuleId;
  cta: string;
};

export type PersonalStayFact = {
  id: string;
  label: string;
  value: string;
  module?: HotelierModuleId;
};

export type ModuleContent = {
  id: HotelierModuleId;
  title: string;
  kicker: string;
  heroImage: string;
  lead: string;
  chips: string[];
  sections: { heading: string; items: { title: string; detail: string; cta?: string }[] }[];
  primaryCta: string;
  secondaryCta?: string;
};

/** Guest stay snapshot — personal, never hotel-wide ops. */
export const GUEST_STAY = {
  roomNumber: "402",
  nightsRemaining: 2,
  checkOutLabel: "Sunday · 11:00",
  checkInLabel: "Checked in",
  premiumStatus: "Premium Guest",
  wifiName: "PLAY-Guest",
  wifiPassword: "theatrou402",
  breakfastHours: "07:00–11:00",
  address: "Theatrou 11 · Psyrri, Athens",
  receptionPhone: "+30 210 000 0402",
  receptionEmail: "hello@playtheatrou.gr",
} as const;

const IMG = {
  lobby:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  breakfast:
    "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1200&q=80",
  restaurant:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
  spa: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
  room: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
  events:
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  concierge:
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
  wine: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
  rooftop:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
  rain: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1200&q=80",
  taxi: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80",
};

/** Guest-relevant “right now” — never occupancy / arrivals / staff queues. */
export const TODAY_AT_HOTEL: TodayItem[] = [
  {
    id: "brk",
    title: "Breakfast is open",
    detail: "Courtyard Kitchen · until 11:00",
    module: "breakfast",
    accent: "#C9A962",
  },
  {
    id: "roof",
    title: "Rooftop sunset tonight",
    detail: "Complimentary sparkling · 18:00–19:30",
    module: "events",
    accent: "#C0392B",
  },
  {
    id: "chef",
    title: "Chef’s special available",
    detail: "Courtyard Kitchen · reserve a table",
    module: "restaurant",
    accent: "#1A1A1A",
  },
  {
    id: "spa",
    title: "Spa has openings this afternoon",
    detail: "Calm-hour massage · facial suite",
    module: "spa",
    accent: "#5B7C6E",
  },
  {
    id: "wx",
    title: "Clear Athens evening · 28°",
    detail: "Perfect for rooftop or a Psyrri walk",
    module: "events",
    accent: "#111111",
  },
  {
    id: "late",
    title: "Late checkout available",
    detail: "Extend Room 402 to 14:00",
    module: "lateCheckout",
    accent: "#6B5A3A",
  },
  {
    id: "offer",
    title: "Rainy day spa package",
    detail: "Indoor reset if the weather turns",
    module: "campaigns",
    accent: "#181818",
  },
];

/**
 * Primary service directory on Hotelier home ("What can we do for you?").
 * Events/offers/campaigns live in the Happening feed — not duplicated here.
 * Underlying `/hotelier/{id}` modules remain available via deep links.
 */
export const HOTELIER_QUICK_ACTIONS: QuickAction[] = [
  { id: "breakfast", title: "Breakfast", subtitle: "Menu & reserve", emoji: "🥐" },
  { id: "restaurant", title: "Restaurant", subtitle: "Specials & wine", emoji: "🍽️" },
  { id: "spa", title: "Spa", subtitle: "Treatments & calm", emoji: "💆" },
  { id: "stayInfo", title: "Room", subtitle: "Stay details", emoji: "🛏" },
  { id: "concierge", title: "Concierge", subtitle: "Tickets · tips", emoji: "🎩" },
  { id: "taxi", title: "Taxi / Airport", subtitle: "Transfer & rides", emoji: "🚕" },
  { id: "guestServices", title: "Guest Services", subtitle: "Housekeeping · DND", emoji: "🔑" },
  { id: "askHotel", title: "Ask the Hotel", subtitle: "Message reception", emoji: "💬" },
];

export type HotelServiceCard = {
  id: string;
  title: string;
  detail: string;
  imageUrl: string;
  module: HotelierModuleId;
};

/** Room / restaurant / spa — cards, never full-bleed banners. */
export const HOTEL_SERVICES: HotelServiceCard[] = [
  {
    id: "room",
    title: "Your room",
    detail: "402 · Premium · amenities",
    imageUrl: IMG.room,
    module: "stayInfo",
  },
  {
    id: "dining",
    title: "Courtyard Kitchen",
    detail: "Breakfast · dinner · wine",
    imageUrl: IMG.restaurant,
    module: "restaurant",
  },
  {
    id: "spa",
    title: "PLAY Spa",
    detail: "Massage · facial · calm hour",
    imageUrl: IMG.spa,
    module: "spa",
  },
  {
    id: "concierge",
    title: "Concierge",
    detail: "Tickets · tables · tips",
    imageUrl: IMG.concierge,
    module: "concierge",
  },
  {
    id: "rooftop",
    title: "Rooftop",
    detail: "Sunset · sparkling · views",
    imageUrl: IMG.rooftop,
    module: "events",
  },
];

export const HOTEL_OFFERS: CampaignCard[] = [
  {
    id: "offer-roof",
    title: "Rooftop sparkling",
    detail: "Complimentary for Premium Guests · 18:00–19:30",
    imageUrl: IMG.rooftop,
    module: "events",
    cta: "Reserve",
  },
  {
    id: "offer-chef",
    title: "Chef’s courtyard table",
    detail: "Slow-roast lamb · meze for two",
    imageUrl: IMG.restaurant,
    module: "restaurant",
    cta: "Book",
  },
  {
    id: "offer-spa",
    title: "Calm-hour spa",
    detail: "Morning quiet treatments from €75",
    imageUrl: IMG.spa,
    module: "spa",
    cta: "Book",
  },
];

export const HOTEL_EVENTS: CampaignCard[] = [
  {
    id: "ev-roof",
    title: "Rooftop golden hour",
    detail: "17:00 · complimentary sparkling",
    imageUrl: IMG.rooftop,
    module: "events",
    cta: "Reserve seats",
  },
  {
    id: "ev-taste",
    title: "Chef’s tasting",
    detail: "19:00 · limited seats · €42",
    imageUrl: IMG.restaurant,
    module: "restaurant",
    cta: "Book table",
  },
  {
    id: "ev-bandit",
    title: "Local Bandit meet",
    detail: "21:00 · lobby board · Elena",
    imageUrl: IMG.events,
    module: "events",
    cta: "Add to stay",
  },
];

export const PERSONAL_STAY_FACTS: PersonalStayFact[] = [
  { id: "room", label: "Room", value: "402 · Premium", module: "stayInfo" },
  { id: "out", label: "Check-out", value: GUEST_STAY.checkOutLabel, module: "lateCheckout" },
  { id: "nights", label: "Nights remaining", value: `${GUEST_STAY.nightsRemaining} nights` },
  { id: "wifi", label: "Wi‑Fi", value: `${GUEST_STAY.wifiName} · tap for password`, module: "stayInfo" },
  { id: "brk", label: "Breakfast", value: GUEST_STAY.breakfastHours, module: "breakfast" },
  { id: "addr", label: "Address", value: GUEST_STAY.address },
  { id: "desk", label: "Reception", value: GUEST_STAY.receptionPhone, module: "askHotel" },
  { id: "hk", label: "Housekeeping", value: "Request towels · turndown · DND", module: "guestServices" },
];

export const HOTEL_CAMPAIGNS: CampaignCard[] = [
  {
    id: "roof",
    title: "Rooftop sunset tonight",
    detail: "Complimentary sparkling for Premium Guests · 18:00–19:30",
    imageUrl: IMG.rooftop,
    module: "events",
    cta: "Reserve seats",
  },
  {
    id: "chef",
    title: "Chef’s special",
    detail: "Slow-roast lamb · courtyard meze for two",
    imageUrl: IMG.restaurant,
    module: "restaurant",
    cta: "Book a table",
  },
  {
    id: "spa",
    title: "Calm-hour spa",
    detail: "Morning quiet treatments from €75",
    imageUrl: IMG.spa,
    module: "spa",
    cta: "Book treatment",
  },
  {
    id: "rain",
    title: "Rainy day package",
    detail: "Spa + in-room wine if Athens turns grey",
    imageUrl: IMG.rain,
    module: "campaigns",
    cta: "Claim package",
  },
  {
    id: "late",
    title: "Late checkout available",
    detail: "Keep Room 402 until 14:00 · €35",
    imageUrl: IMG.room,
    module: "lateCheckout",
    cta: "Upgrade checkout",
  },
];

/** Stable theme keys for feed dedupe (analytics attribution kept on each item). */
export type HappeningKind = "today" | "offer" | "event" | "campaign";

export type HappeningFeedItem = CampaignCard & {
  contentKey: string;
  kind: HappeningKind;
  /** Original catalog id before dedupe — for hotel analytics. */
  sourceId: string;
};

function themeKeyFor(card: { id: string; title: string; module: HotelierModuleId }): string {
  const t = `${card.id} ${card.title}`.toLowerCase();
  if (/roof|sunset|sparkling|golden/.test(t)) return "theme:rooftop-sunset";
  if (
    (/chef|courtyard|lamb|meze|tasting|dining|kitchen/.test(t) || card.module === "restaurant") &&
    /chef|lamb|meze|tasting|special|table/.test(t)
  ) {
    return "theme:chef-dining";
  }
  if (/rain/.test(t)) return "theme:rain-spa-package";
  if (/spa|calm-hour|facial|massage/.test(t) && card.module === "spa") return "theme:spa-calm";
  if (/late checkout|checkout/.test(t) || card.module === "lateCheckout") return "theme:late-checkout";
  if (/bandit|lobby|elena/.test(t)) return "theme:bandit-meet";
  if (/breakfast/.test(t) || card.module === "breakfast") return "theme:breakfast-signal";
  if (/weather|athens evening|28°/.test(t)) return "theme:weather-context";
  if (/message from|ask/.test(t) || card.module === "askHotel") return "theme:hotel-message";
  return `theme:${card.module}:${card.id}`;
}

/**
 * Curated Happening feed: offers + events + campaigns (+ select today signals),
 * deduped by stable contentKey. Source arrays stay intact for attribution.
 */
export function buildHappeningFeed(limit = 6): HappeningFeedItem[] {
  const pool: HappeningFeedItem[] = [];

  for (const c of HOTEL_OFFERS) {
    pool.push({ ...c, contentKey: themeKeyFor(c), kind: "offer", sourceId: c.id });
  }
  for (const c of HOTEL_EVENTS) {
    pool.push({ ...c, contentKey: themeKeyFor(c), kind: "event", sourceId: c.id });
  }
  for (const c of HOTEL_CAMPAIGNS) {
    pool.push({ ...c, contentKey: themeKeyFor(c), kind: "campaign", sourceId: c.id });
  }
  for (const t of TODAY_AT_HOTEL) {
    if (t.id === "brk" || t.id === "spa" || t.id === "chef") continue;
    const asCard: CampaignCard = {
      id: `today-${t.id}`,
      title: t.title,
      detail: t.detail,
      imageUrl:
        t.module === "events"
          ? IMG.rooftop
          : t.module === "campaigns"
            ? IMG.rain
            : t.module === "lateCheckout"
              ? IMG.room
              : IMG.lobby,
      module: t.module,
      cta: "Open",
    };
    pool.push({
      ...asCard,
      contentKey: themeKeyFor(asCard),
      kind: "today",
      sourceId: t.id,
    });
  }

  const kindRank: Record<HappeningKind, number> = {
    event: 4,
    campaign: 3,
    offer: 2,
    today: 1,
  };
  const byKey = new Map<string, HappeningFeedItem>();
  for (const item of pool) {
    const prev = byKey.get(item.contentKey);
    if (!prev || kindRank[item.kind] > kindRank[prev.kind]) {
      byKey.set(item.contentKey, item);
    }
  }

  const ordered = Array.from(byKey.values()).sort((a, b) => {
    const prefer = (x: HappeningFeedItem) =>
      (x.kind === "event" ? 0 : x.kind === "campaign" ? 1 : 2) +
      (x.contentKey === "theme:weather-context" ? 10 : 0);
    return prefer(a) - prefer(b);
  });

  return ordered.slice(0, limit);
}

export const HOTELIER_MODULES: Record<HotelierModuleId, ModuleContent> = {
  breakfast: {
    id: "breakfast",
    title: "Breakfast",
    kicker: "Courtyard Kitchen · 07:00–11:00",
    heroImage: IMG.breakfast,
    lead: "Today’s menu, hours, and a table for Room 402.",
    chips: ["Open now", "Included", "Photos"],
    sections: [
      {
        heading: "Today’s menu",
        items: [
          { title: "Greek yogurt · honey · walnuts", detail: "Signature · vegetarian", cta: "Add note" },
          { title: "Scrambled eggs · herb oil", detail: "Courtyard classic", cta: "Reserve table" },
          { title: "Fresh bakery board", detail: "Rotated daily 07:00", cta: "See photos" },
        ],
      },
      {
        heading: "Special requests",
        items: [
          { title: "Quiet table · olive tree side", detail: "Preferred for couples", cta: "Request" },
          { title: "Kids high chair", detail: "Available on ask", cta: "Request" },
        ],
      },
    ],
    primaryCta: "Reserve breakfast table",
    secondaryCta: "View hours & photos",
  },
  restaurant: {
    id: "restaurant",
    title: "Restaurant",
    kicker: "Courtyard Kitchen · Dinner",
    heroImage: IMG.restaurant,
    lead: "Tonight’s specials, chef picks, and wine — reserved for your stay.",
    chips: ["Chef pick", "Wine list", "Tonight"],
    sections: [
      {
        heading: "Today’s specials",
        items: [
          { title: "Slow-roast lamb · herbs", detail: "Chef recommendation · €28", cta: "Reserve" },
          { title: "Courtyard meze for two", detail: "Shared · €42", cta: "Reserve" },
        ],
      },
      {
        heading: "Wine list highlights",
        items: [
          { title: "Assyrtiko · Santorini", detail: "Crisp · seafood pairing", cta: "Add to table" },
          { title: "House red · Nemea", detail: "Soft · late plates", cta: "Add to table" },
        ],
      },
    ],
    primaryCta: "Reserve a table",
    secondaryCta: "Open wine list",
  },
  spa: {
    id: "spa",
    title: "Spa",
    kicker: "PLAY Spa · 09:00–21:00",
    heroImage: IMG.spa,
    lead: "Treatments and packages available during your stay.",
    chips: ["Open today", "Packages", "Gallery"],
    sections: [
      {
        heading: "Treatments",
        items: [
          { title: "Calm-hour massage · 60 min", detail: "€89 · morning quiet", cta: "Book" },
          { title: "City-reset facial", detail: "€75 · 45 min", cta: "Book" },
          { title: "Couple’s package", detail: "€160 · dual rooms", cta: "Book package" },
        ],
      },
      {
        heading: "Openings today",
        items: [
          { title: "09:30 · available", detail: "Massage room", cta: "Hold" },
          { title: "15:00 · available", detail: "Facial suite", cta: "Hold" },
        ],
      },
    ],
    primaryCta: "Book treatment",
    secondaryCta: "View gallery",
  },
  lateCheckout: {
    id: "lateCheckout",
    title: "Late Checkout",
    kicker: "Extend to 14:00",
    heroImage: IMG.room,
    lead: "One more morning in Psyrri — keep Room 402 a little longer.",
    chips: ["€35", "Subject to availability"],
    sections: [
      {
        heading: "Your option",
        items: [
          { title: "Extend checkout to 14:00", detail: "Room 402 · €35", cta: "Upgrade now" },
          { title: "Luggage hold after checkout", detail: "Complimentary at desk", cta: "Request hold" },
        ],
      },
    ],
    primaryCta: "Upgrade checkout",
    secondaryCta: "Keep standard 11:00",
  },
  roomService: {
    id: "roomService",
    title: "Room Service",
    kicker: "24h · Room 402",
    heroImage: IMG.room,
    lead: "Menu, order, and tracking delivered to your room.",
    chips: ["24h", "Track order"],
    sections: [
      {
        heading: "Categories",
        items: [
          { title: "All-day dining", detail: "Plates · salads · pasta", cta: "Browse" },
          { title: "Late bites", detail: "After 22:00", cta: "Browse" },
          { title: "Drinks & wine", detail: "In-room bar restock", cta: "Browse" },
        ],
      },
      {
        heading: "Popular tonight",
        items: [
          { title: "Club sandwich · fries", detail: "€18 · 25 min", cta: "Order" },
          { title: "Meze board", detail: "€26 · 30 min", cta: "Order" },
        ],
      },
    ],
    primaryCta: "Place order",
    secondaryCta: "Track last order",
  },
  concierge: {
    id: "concierge",
    title: "Concierge",
    kicker: "For your stay",
    heroImage: IMG.concierge,
    lead: "Tickets, museums, restaurants, and local tips — one tap.",
    chips: ["Tickets", "Dining", "Tips"],
    sections: [
      {
        heading: "Request now",
        items: [
          { title: "Acropolis tickets", detail: "Timed entry · skip lines", cta: "Get tickets" },
          { title: "Restaurant booking", detail: "Partner tables · tonight", cta: "Book table" },
          { title: "Museum pass day", detail: "Combo · central Athens", cta: "Arrange" },
          { title: "Local evening tip", detail: "Psyrri to Monastiraki", cta: "Ask" },
        ],
      },
    ],
    primaryCta: "Message concierge",
    secondaryCta: "Call front desk",
  },
  taxi: {
    id: "taxi",
    title: "Taxi / Airport Transfer",
    kicker: "Room 402 · rides ready",
    heroImage: IMG.taxi,
    lead: "Airport transfers and city taxis arranged for your stay.",
    chips: ["Airport", "City", "Luggage"],
    sections: [
      {
        heading: "Book a ride",
        items: [
          { title: "Airport transfer", detail: "Fixed rate · luggage-ready", cta: "Book" },
          { title: "City taxi now", detail: "Pickup at PLAY lobby", cta: "Call taxi" },
          { title: "Morning departure", detail: "Schedule for checkout day", cta: "Schedule" },
        ],
      },
    ],
    primaryCta: "Book airport transfer",
    secondaryCta: "Call a city taxi",
  },
  guestServices: {
    id: "guestServices",
    title: "Guest Services",
    kicker: "Housekeeping · amenities · DND",
    heroImage: IMG.room,
    lead: "Towels, turndown, iron, pillows — and do-not-disturb for Room 402.",
    chips: ["Housekeeping", "Amenities", "DND"],
    sections: [
      {
        heading: "Request",
        items: [
          { title: "Fresh towels", detail: "Usually 20 min", cta: "Request" },
          { title: "Turndown service", detail: "Tonight 20:00–21:00", cta: "Schedule" },
          { title: "Extra pillows · soft", detail: "2 pillows", cta: "Request" },
          { title: "Iron & board", detail: "Delivered to room", cta: "Request" },
          { title: "Do not disturb", detail: "Until you turn it off", cta: "Enable DND" },
        ],
      },
    ],
    primaryCta: "Submit request",
    secondaryCta: "Enable DND",
  },
  events: {
    id: "events",
    title: "Hotel Events",
    kicker: "What’s on at PLAY today",
    heroImage: IMG.events,
    lead: "Guest experiences on property — bookable and walkable.",
    chips: ["Today", "Rooftop", "Dinner"],
    sections: [
      {
        heading: "Timeline",
        items: [
          { title: "07:00 · Breakfast opens", detail: "Courtyard Kitchen", cta: "Open breakfast" },
          { title: "17:00 · Rooftop golden hour", detail: "Complimentary sparkling for Room 402", cta: "Reserve seats" },
          { title: "19:00 · Chef’s courtyard tasting", detail: "Limited seats · €42", cta: "Book table" },
          { title: "21:00 · Local Bandit evening meet", detail: "Lobby board · Elena", cta: "Add to stay" },
        ],
      },
    ],
    primaryCta: "Book featured event",
    secondaryCta: "Get directions",
  },
  campaigns: {
    id: "campaigns",
    title: "Hotel Offers",
    kicker: "Live for your stay",
    heroImage: IMG.wine,
    lead: "Guest-facing offers you can claim during this stay.",
    chips: ["Rooftop", "Dining", "Spa"],
    sections: [
      {
        heading: "Live now",
        items: [
          { title: "Rooftop golden hour", detail: "2 complimentary sparkling · Room 402", cta: "Claim" },
          { title: "Tonight at Courtyard Kitchen", detail: "Olive tree tables · from €42", cta: "Reserve" },
          { title: "Calm-hour spa tomorrow", detail: "€89 treatment · morning quiet", cta: "Book spa" },
          { title: "Rainy day package", detail: "Spa + in-room wine", cta: "Claim" },
        ],
      },
    ],
    primaryCta: "Claim featured offer",
    secondaryCta: "See all offers",
  },
  askHotel: {
    id: "askHotel",
    title: "Ask the Hotel",
    kicker: "Reception · Room 402",
    heroImage: IMG.lobby,
    lead: "Message the front desk or concierge — your stay questions, answered.",
    chips: ["Reception", "Concierge", "Urgent"],
    sections: [
      {
        heading: "Quick asks",
        items: [
          { title: "Ask about late checkout", detail: "Availability for Sunday", cta: "Send" },
          { title: "Allergy note for breakfast", detail: "Nut-free table", cta: "Send" },
          { title: "Move spa to later", detail: "Prefer afternoon", cta: "Send" },
          { title: "Something else", detail: "Free-form message to reception", cta: "Compose" },
        ],
      },
      {
        heading: "From PLAY",
        items: [
          {
            title: "Rooftop seats held tonight",
            detail: "Premium Guest courtesy · reply to confirm",
            cta: "Reply",
          },
        ],
      },
    ],
    primaryCta: "Message reception",
    secondaryCta: "Call front desk",
  },
  /** Alias — same guest inbox as Ask the Hotel. */
  messages: {
    id: "messages",
    title: "Ask the Hotel",
    kicker: "Reception · Room 402",
    heroImage: IMG.lobby,
    lead: "Message the front desk or concierge — your stay questions, answered.",
    chips: ["Reception", "Concierge"],
    sections: [
      {
        heading: "Quick asks",
        items: [
          { title: "Ask about late checkout", detail: "Availability for Sunday", cta: "Send" },
          { title: "Something else", detail: "Free-form message to reception", cta: "Compose" },
        ],
      },
    ],
    primaryCta: "Message reception",
    secondaryCta: "Call front desk",
  },
  stayInfo: {
    id: "stayInfo",
    title: "Your Stay",
    kicker: "Room 402 · Premium Guest",
    heroImage: IMG.room,
    lead: "Manage this stay — check-in/out, nights remaining, room, services, and open requests.",
    chips: ["In house", "Premium", "Manage"],
    sections: [
      {
        heading: "Stay summary",
        items: [
          {
            title: `Room ${GUEST_STAY.roomNumber} · Premium`,
            detail: `${GUEST_STAY.checkInLabel} · ${GUEST_STAY.nightsRemaining} nights remaining`,
            cta: "View key",
          },
          {
            title: "Check-out",
            detail: GUEST_STAY.checkOutLabel,
            cta: "Extend / late checkout",
          },
          {
            title: "Wi‑Fi",
            detail: `${GUEST_STAY.wifiName} · ${GUEST_STAY.wifiPassword}`,
            cta: "Copy password",
          },
          { title: "Address", detail: GUEST_STAY.address, cta: "Directions" },
        ],
      },
      {
        heading: "Hotel services",
        items: [
          { title: "Breakfast", detail: GUEST_STAY.breakfastHours, cta: "Open breakfast" },
          { title: "Spa · restaurant · concierge", detail: "Book from Hotelier", cta: "Browse services" },
          { title: "Housekeeping · DND", detail: "Towels · turndown · amenities", cta: "Guest services" },
        ],
      },
      {
        heading: "Current bookings & requests",
        items: [
          { title: "Rooftop seats held tonight", detail: "18:00–19:30 · Premium courtesy", cta: "Confirm" },
          { title: "No open housekeeping request", detail: "Request towels anytime", cta: "Request" },
          { title: "Late checkout not requested", detail: "Extend to 14:00 · €35", cta: "Upgrade" },
        ],
      },
    ],
    primaryCta: "Open digital key",
    secondaryCta: "Contact front desk",
  },
  reservation: {
    id: "reservation",
    title: "Reservation",
    kicker: "PLAY Theatrou · confirmed",
    heroImage: IMG.lobby,
    lead: "Your booking details, dates, guests, and stay add-ons.",
    chips: ["Confirmed", "Premium", "2 nights"],
    sections: [
      {
        heading: "Booking",
        items: [
          {
            title: "Confirmation · PLAY-402",
            detail: "Premium room · 2 adults",
            cta: "View voucher",
          },
          {
            title: "Dates",
            detail: `In house now · checkout ${GUEST_STAY.checkOutLabel}`,
            cta: "Calendar",
          },
          {
            title: "Rate plan",
            detail: "Premium Guest · breakfast included",
            cta: "Details",
          },
          {
            title: "Add-ons",
            detail: "Late checkout available · spa package open",
            cta: "Manage",
          },
        ],
      },
    ],
    primaryCta: "View full reservation",
    secondaryCta: "Message reception",
  },
  welcome: {
    id: "welcome",
    title: "Welcome to PLAY",
    kicker: "Room 402 · Premium Guest",
    heroImage: IMG.lobby,
    lead: "Your stay is ready — rooftop, courtyard, and concierge whenever you are.",
    chips: ["In house", "Premium"],
    sections: [
      {
        heading: "For you tonight",
        items: [
          { title: "Rooftop sparkling", detail: "18:00–19:30 · complimentary", cta: "Reserve" },
          { title: "Courtyard dinner", detail: "Chef’s special · book a table", cta: "Reserve" },
        ],
      },
    ],
    primaryCta: "Explore hotel services",
    secondaryCta: "Message reception",
  },
  /** Guest-facing in-room TV story — not staff broadcast tools. */
  tv: {
    id: "tv",
    title: "In-room TV",
    kicker: "PLAY channel · Room 402",
    heroImage: IMG.lobby,
    lead: "Hotel story, tonight’s offers, and local picks on your room TV.",
    chips: ["Welcome", "Offers"],
    sections: [
      {
        heading: "On your channel",
        items: [
          { title: "PLAY Theatrou welcome", detail: "Property story · 90s", cta: "Watch" },
          { title: "Tonight’s offers", detail: "Restaurant · spa · rooftop", cta: "Open offers" },
          { title: "Local Bandit board", detail: "Elena · Nikos picks", cta: "Explore city" },
        ],
      },
    ],
    primaryCta: "Open tonight’s offers",
    secondaryCta: "Ask reception",
  },
  /** Redirect-style guest alert inbox — not staff push composer. */
  push: {
    id: "push",
    title: "Stay alerts",
    kicker: "From your hotel",
    heroImage: IMG.events,
    lead: "Important notes from PLAY during your stay.",
    chips: ["Rooftop", "Breakfast"],
    sections: [
      {
        heading: "Recent",
        items: [
          { title: "Rooftop seats still open", detail: "18:00–19:30 · complimentary", cta: "Reserve" },
          { title: "Breakfast closes in 45 min", detail: "Courtyard Kitchen", cta: "Open breakfast" },
        ],
      },
    ],
    primaryCta: "View hotel events",
    secondaryCta: "Ask the hotel",
  },
  /** Guest offer browse — not staff offer creator. */
  createOffer: {
    id: "createOffer",
    title: "Hotel Offers",
    kicker: "Live for your stay",
    heroImage: IMG.wine,
    lead: "Guest offers you can claim during this stay.",
    chips: ["Dining", "Spa", "Checkout"],
    sections: [
      {
        heading: "Available now",
        items: [
          { title: "Dining · courtyard table", detail: "Tonight at PLAY", cta: "Reserve" },
          { title: "Spa · calm hour", detail: "Morning wellness", cta: "Book" },
          { title: "Checkout upgrade", detail: "Late checkout €35", cta: "Upgrade" },
        ],
      },
    ],
    primaryCta: "See all offers",
    secondaryCta: "Ask the hotel",
  },
};

/** Rewrite isolated PLAY sandbox copy so it never leaks into a live hotel stay. */
export function rewritePlaySandboxCopy(
  text: string,
  ctx: { hotelName: string; roomNumber?: string | null; hotelSlug?: string | null },
): string {
  if (isIsolatedPlaySandboxSlug(ctx.hotelSlug)) return text;
  const hotel = String(ctx.hotelName || "your hotel").trim() || "your hotel";
  const room = ctx.roomNumber?.trim() ? `Room ${ctx.roomNumber.trim()}` : "your room";
  return text
    .replace(/PLAY Theatrou/g, hotel)
    .replace(/PLAY-402/g, ctx.roomNumber?.trim() || "your reservation")
    .replace(/PLAY-Guest/g, "Hotel-Guest")
    .replace(/hello@playtheatrou\.gr/gi, "reception")
    .replace(/theatrou402/gi, "ask reception")
    .replace(/Message from PLAY/g, `Message from ${hotel}`)
    .replace(/From PLAY/g, `From ${hotel}`)
    .replace(/Welcome to PLAY/g, `Welcome to ${hotel}`)
    .replace(/What’s on at PLAY today/g, "What’s on at your hotel today")
    .replace(/PLAY channel/g, "Hotel channel")
    .replace(/PLAY Spa/g, "Spa")
    .replace(/Tonight at PLAY/g, `Tonight at ${hotel}`)
    .replace(/Room 402/g, room)
    .replace(/\bPLAY\b/g, hotel);
}
