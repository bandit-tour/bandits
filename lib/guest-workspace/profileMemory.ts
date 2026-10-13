/**
 * Guest Profile — travel memory journal seed.
 * Demo data until live memory / journey APIs are wired.
 */

export type MomentSource =
  | "qr_bottle"
  | "local_friend"
  | "bottle_message"
  | "hotel_welcome"
  | "experience"
  | "photo"
  | "review"
  | "premium"
  | "milestone";

export type TravelMoment = {
  id: string;
  title: string;
  description: string;
  date: string;
  dateLabel: string;
  city: string;
  hotel: string;
  imageUrl: string;
  source: MomentSource;
  sourceLabel: string;
  /** Local banDit who curated or appears in this moment */
  banditId?: string;
  banditName?: string;
  banditAvatarUrl?: string;
  /** Personal message hidden in a bottle — reveals sender */
  bottleSenderName?: string;
  bottleMessage?: string;
  storyBody: string;
};

export type JourneyMapPlace = {
  id: string;
  kind: "hotel" | "experience" | "bottle" | "bandit" | "city" | "country";
  title: string;
  subtitle: string;
  imageUrl: string;
  href?: string;
};

export type LocalFriendCard = {
  id: string;
  name: string;
  city: string;
  avatarUrl: string;
  relation: "followed" | "met" | "chat" | "premium";
  relationLabel: string;
  lastLine: string;
};

export type ProfileExperience = {
  id: string;
  experienceId: string;
  title: string;
  status: "upcoming" | "completed" | "cancelled" | "favorite" | "wishlist";
  when: string;
  area: string;
  imageUrl: string;
};

export type CityGuideCard = {
  id: string;
  city: string;
  title: string;
  status: "collected" | "offline" | "premium" | "downloaded";
  statusLabel: string;
  coverUrl: string;
};

export type BottleJourneyCard = {
  id: string;
  journeyId: string;
  fromHotel: string;
  toStay: string;
  title: string;
  status: "completed" | "in_progress" | "available";
  statusLabel: string;
  imageUrl: string;
};

export type RewardBadge = {
  id: string;
  title: string;
  detail: string;
  earned: boolean;
};

export type MemoryPhoto = {
  id: string;
  imageUrl: string;
  caption: string;
  momentId?: string;
};

export type ProfileStaySnapshot = {
  city: string;
  stayLabel: string;
  nightsRemaining: number;
  checkOutLabel: string;
  premiumStatus: string;
  travelScore: number;
  travelLevel: string;
  travelLevelRank: number;
};

export const PROFILE_STAY: ProfileStaySnapshot = {
  city: "Athens",
  stayLabel: "Night 2 of 4",
  nightsRemaining: 2,
  checkOutLabel: "Checkout Sunday",
  premiumStatus: "Premium Guest",
  travelScore: 842,
  travelLevel: "City Insider",
  travelLevelRank: 4,
};

export const PROFILE_MOMENTS: TravelMoment[] = [
  {
    id: "mom_bottle_msg",
    title: "A note waiting in the bottle",
    description: "Someone left a personal message for your first night.",
    date: "2026-08-06",
    dateLabel: "Yesterday · evening",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
    source: "bottle_message",
    sourceLabel: "Message in a bottle",
    banditId: "bandit_elena",
    banditName: "Elena V.",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    bottleSenderName: "Maya · previous guest",
    bottleMessage:
      "If you find this — take the rooftop at golden hour, then ask Elena for the courtyard table. Athens is kinder when you arrive curious.",
    storyBody:
      "You scanned the bottle at reception and found a handwritten note from a guest who stayed two weeks ago. The city suddenly felt like a conversation instead of a checklist.",
  },
  {
    id: "mom_qr_scan",
    title: "Welcome unlocked",
    description: "QR scan opened your PLAY stay and city layer.",
    date: "2026-08-05",
    dateLabel: "2 days ago · afternoon",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    source: "qr_bottle",
    sourceLabel: "QR bottle scan",
    banditId: "bandit_nikos",
    banditName: "Nikos A.",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "One scan from the bottle at PLAY Theatrou — hotel welcome, Local Friend channel, and your first Psyrri recommendations arrived together. Nikos curated the opening route.",
  },
  {
    id: "mom_lf_chat",
    title: "Sofia found your dinner",
    description: "Local Friend message — a quiet taverna two streets away.",
    date: "2026-08-06",
    dateLabel: "Yesterday · 19:40",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80",
    source: "local_friend",
    sourceLabel: "Local Friend",
    banditId: "bandit_sofia",
    banditName: "Sofia Markou",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "Sofia replied within minutes: skip the packed squares, turn left at the blue door, ask for the garden table. That dinner became your first real Athens memory.",
  },
  {
    id: "mom_welcome",
    title: "Hotel welcome · first light",
    description: "PLAY desk left a soft welcome and a city gift.",
    date: "2026-08-05",
    dateLabel: "2 days ago · check-in",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=900&q=80",
    source: "hotel_welcome",
    sourceLabel: "Hotel welcome",
    banditId: "bandit_nikos",
    banditName: "Nikos A.",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "Reception handed you the bottle, a room key, and a short note: the city is already open. Your stay layered into bandiTour the same afternoon.",
  },
  {
    id: "mom_exp_dawn",
    title: "Don’t Google Tonight.",
    description: "Completed — insider doors, not a sightseeing checklist.",
    date: "2026-08-06",
    dateLabel: "Yesterday · night",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80",
    source: "experience",
    sourceLabel: "Experience completed",
    banditId: "bandit_keys",
    banditName: "Kostas “Keys”",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "Keys led a night that never appeared on Google Maps. One drink, a basement, then a door you would have walked past. You told friends about it before you told them about the Acropolis.",
  },
  {
    id: "mom_photo_rooftop",
    title: "Rooftop golden hour",
    description: "Your photo from the PLAY terrace — city in amber.",
    date: "2026-08-05",
    dateLabel: "2 days ago · sunset",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?auto=format&fit=crop&w=900&q=80",
    source: "photo",
    sourceLabel: "Photo",
    banditId: "bandit_elena",
    banditName: "Elena V.",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "You climbed to the terrace just as the light turned warm. Elena had suggested this exact window. The photo still feels like arrival.",
  },
  {
    id: "mom_review",
    title: "You left a city note",
    description: "Review of the dawn walk — shared with future guests.",
    date: "2026-08-06",
    dateLabel: "Yesterday · night",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80",
    source: "review",
    sourceLabel: "Review",
    banditId: "bandit_sofia",
    banditName: "Sofia Markou",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "Your short review now helps the next PLAY guest choose. Memory became signal — the journal keeps both.",
  },
  {
    id: "mom_premium",
    title: "Hidden courtyard unlocked",
    description: "Premium discovery — a table only locals finish.",
    date: "2026-08-07",
    dateLabel: "Today · midday",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
    source: "premium",
    sourceLabel: "Premium discovery",
    banditId: "bandit_elena",
    banditName: "Elena V.",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "Premium opened a gated courtyard on a Psyrri backstreet. Elena curated the introduction. This is why the city rewards curiosity.",
  },
  {
    id: "mom_milestone",
    title: "Travel level · City Insider",
    description: "Milestone — score crossed 800 in Athens.",
    date: "2026-08-07",
    dateLabel: "Today",
    city: "Athens",
    hotel: "PLAY Theatrou",
    imageUrl:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80",
    source: "milestone",
    sourceLabel: "Travel milestone",
    banditId: "bandit_nikos",
    banditName: "Nikos A.",
    banditAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    storyBody:
      "Bottle scans, a completed experience, Local Friend chats, and one premium discovery pushed your Travel score to 842. City Insider unlocked.",
  },
];

export const JOURNEY_MAP_PLACES: JourneyMapPlace[] = [
  {
    id: "map_play",
    kind: "hotel",
    title: "PLAY Theatrou",
    subtitle: "Current stay · Psyrri",
    imageUrl:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=600&q=80",
    href: "/hotelier",
  },
  {
    id: "map_nyx",
    kind: "hotel",
    title: "NYX Athens",
    subtitle: "Visited · May 2026",
    imageUrl:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
    href: "/hotelier",
  },
  {
    id: "map_dawn",
    kind: "experience",
    title: "Don’t Google Tonight.",
    subtitle: "Completed · Psyrri nights",
    imageUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80",
    href: "/experience/exp_dont_google",
  },
  {
    id: "map_pine",
    kind: "bottle",
    title: "Pine cabin night",
    subtitle: "Bottle journey · Parnitha",
    imageUrl:
      "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=600&q=80",
    href: "/journey/bottle_pine",
  },
  {
    id: "map_sofia",
    kind: "bandit",
    title: "Sofia Markou",
    subtitle: "Local banDit · met",
    imageUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80",
    href: "/bandit/bandit_sofia",
  },
  {
    id: "map_athens",
    kind: "city",
    title: "Athens",
    subtitle: "Greece · active city",
    imageUrl:
      "https://images.unsplash.com/photo-1555992336-fb917d4e90f1?auto=format&fit=crop&w=600&q=80",
    href: "/cityMap",
  },
  {
    id: "map_greece",
    kind: "country",
    title: "Greece",
    subtitle: "1 country · 2 cities",
    imageUrl:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80",
    href: "/cityMap",
  },
];

export const LOCAL_FRIENDS: LocalFriendCard[] = [
  {
    id: "bandit_sofia",
    name: "Sofia Markou",
    city: "Athens",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80",
    relation: "chat",
    relationLabel: "Recent chat",
    lastLine: "Garden table is free after 8 — go.",
  },
  {
    id: "bandit_elena",
    name: "Elena V.",
    city: "Athens",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    relation: "premium",
    relationLabel: "Premium creator",
    lastLine: "Courtyard unlock is waiting for you.",
  },
  {
    id: "bandit_nikos",
    name: "Nikos A.",
    city: "Athens",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    relation: "met",
    relationLabel: "Met in person",
    lastLine: "Psyrri night route — chapter one.",
  },
  {
    id: "bandit_anna",
    name: "Anna K.",
    city: "Athens",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    relation: "followed",
    relationLabel: "Following",
    lastLine: "Weekend olive grove tips.",
  },
];

export const PROFILE_EXPERIENCES: ProfileExperience[] = [
  {
    id: "pe_up_1",
    experienceId: "exp_market_chef",
    title: "Shop the Market. Then Let a Chef Cook It.",
    status: "upcoming",
    when: "Tomorrow · 10:00",
    area: "Varvakios",
    imageUrl:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "pe_done_1",
    experienceId: "exp_dont_google",
    title: "Don’t Google Tonight.",
    status: "completed",
    when: "Yesterday · 21:30",
    area: "Psyrri",
    imageUrl:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "pe_cancel_1",
    experienceId: "exp_dj_tonight",
    title: "Tonight, You’re the DJ.",
    status: "cancelled",
    when: "Aug 5 · cancelled",
    area: "Gazi",
    imageUrl:
      "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "pe_fav_1",
    experienceId: "exp_destroy_clothes",
    title: "Destroy Your Clothes. Make Something Better.",
    status: "favorite",
    when: "Saved",
    area: "Psyrri",
    imageUrl:
      "https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "pe_wish_1",
    experienceId: "exp_costume_warehouse",
    title: "Raid a Costume Warehouse with an Athens Drag Queen",
    status: "wishlist",
    when: "Wishlist",
    area: "Metaxourgeio",
    imageUrl:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=600&q=80",
  },
];

export const CITY_GUIDES: CityGuideCard[] = [
  {
    id: "guide_athens",
    city: "Athens",
    title: "Athens · Living City Guide",
    status: "downloaded",
    statusLabel: "Downloaded · offline ready",
    coverUrl:
      "https://images.unsplash.com/photo-1555992336-fb917d4e90f1?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "guide_psyrri",
    city: "Athens",
    title: "Psyrri after dark",
    status: "premium",
    statusLabel: "Premium chapter",
    coverUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "guide_plaka",
    city: "Athens",
    title: "Plaka · lantern lanes",
    status: "collected",
    statusLabel: "Collected",
    coverUrl:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "guide_parnitha",
    city: "Attica",
    title: "Parnitha weekend",
    status: "offline",
    statusLabel: "Offline pack",
    coverUrl:
      "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=700&q=80",
  },
];

export const BOTTLE_JOURNEY_CARDS: BottleJourneyCard[] = [
  {
    id: "bj_pine",
    journeyId: "bottle_pine",
    fromHotel: "PLAY Theatrou",
    toStay: "Pine cabin · Parnitha",
    title: "Leave the lobby",
    status: "in_progress",
    statusLabel: "Continue journey",
    imageUrl:
      "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "bj_plaka",
    journeyId: "bottle_plaka",
    fromHotel: "PLAY Theatrou",
    toStay: "Plaka lantern walk",
    title: "Lantern lanes of Plaka",
    status: "completed",
    statusLabel: "Completed",
    imageUrl:
      "https://images.unsplash.com/photo-1555992336-fb917d4e90f1?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "bj_sea",
    journeyId: "bottle_sea",
    fromHotel: "PLAY Theatrou",
    toStay: "Sea cliff treehouse",
    title: "Horizon night",
    status: "available",
    statusLabel: "Open destination",
    imageUrl:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=700&q=80",
  },
];

export const REWARD_BADGES: RewardBadge[] = [
  {
    id: "badge_welcome",
    title: "Bottle Opener",
    detail: "First QR bottle scan",
    earned: true,
  },
  {
    id: "badge_dawn",
    title: "Early Light",
    detail: "Completed a dawn experience",
    earned: true,
  },
  {
    id: "badge_insider",
    title: "City Insider",
    detail: "Travel score 800+",
    earned: true,
  },
  {
    id: "badge_loyalty",
    title: "Second Stay",
    detail: "Return guest at a partner hotel",
    earned: false,
  },
  {
    id: "badge_premium",
    title: "Premium Path",
    detail: "Unlock three premium discoveries",
    earned: false,
  },
];

export const MEMORY_PHOTOS: MemoryPhoto[] = [
  {
    id: "ph1",
    imageUrl:
      "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?auto=format&fit=crop&w=500&q=80",
    caption: "Rooftop golden hour",
    momentId: "mom_photo_rooftop",
  },
  {
    id: "ph2",
    imageUrl:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=500&q=80",
    caption: "Dawn walk",
    momentId: "mom_exp_dawn",
  },
  {
    id: "ph3",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=500&q=80",
    caption: "Garden table dinner",
    momentId: "mom_lf_chat",
  },
  {
    id: "ph4",
    imageUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=80",
    caption: "Hidden courtyard",
    momentId: "mom_premium",
  },
  {
    id: "ph5",
    imageUrl:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=500&q=80",
    caption: "PLAY bottle",
    momentId: "mom_qr_scan",
  },
  {
    id: "ph6",
    imageUrl:
      "https://images.unsplash.com/photo-1555992336-fb917d4e90f1?auto=format&fit=crop&w=500&q=80",
    caption: "Plaka lanterns",
    momentId: "mom_bottle_msg",
  },
];

/** Newest first — already ordered in seed; helper for consumers. */
export function getMomentsNewestFirst(): TravelMoment[] {
  return [...PROFILE_MOMENTS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function getMomentById(id: string): TravelMoment | undefined {
  return PROFILE_MOMENTS.find((m) => m.id === id);
}

/** Who “owns” the memory attribution line on cards & detail. */
export function getMomentAttribution(moment: TravelMoment): {
  kind: "bottle_sender" | "local_friend";
  label: string;
  name: string;
  banditId?: string;
} {
  if (moment.bottleMessage && moment.bottleSenderName) {
    return {
      kind: "bottle_sender",
      label: "Who sent this memory",
      name: moment.bottleSenderName,
      banditId: moment.banditId,
    };
  }
  return {
    kind: "local_friend",
    label: "Journey curated by",
    name: moment.banditName ?? "Local Friend",
    banditId: moment.banditId,
  };
}
