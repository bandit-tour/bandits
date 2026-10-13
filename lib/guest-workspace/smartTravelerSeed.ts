/**
 * SmartTraveler seed — independent Athens places locals pass to each other.
 * Place first. Guest privilege secondary. Never a coupon marketplace.
 * Unique hero photography per listing — no reused covers.
 */

import type {
  SmartTravelerGuestPrivilege,
  SmartTravelerPartner,
} from "@/lib/guest-workspace/productWorlds";

function privilege(
  p: SmartTravelerGuestPrivilege,
): Pick<SmartTravelerPartner, "guestPrivilege" | "offers" | "coupons"> {
  return {
    guestPrivilege: p,
    offers: [
      {
        id: p.id,
        title: p.label,
        detail: p.detail,
        benefitType: p.kind,
        hotelBenefit: false,
      },
    ],
    coupons: [],
  };
}

export const SMART_TRAVELER_SEED: SmartTravelerPartner[] = [
  {
    id: "st_myrto_objects",
    businessName: "Myrto Objects",
    typeLabel: "Independent jewellery studio",
    neighborhood: "Exarchia",
    location: "Exarchia · upstairs workshop, unmarked stairwell",
    hours: "Tue–Sat 12:00–19:00",
    banditLine: "Small-batch silver pieces made upstairs by the owner.",
    curator: "banDit pick",
    story:
      "Myrto saws, files, and finishes every piece in the same room where she meets guests. Neighbours knock twice.",
    whyVisit:
      "You meet the maker, not a sales floor. The kind of studio friends text each other — never a jewellery arcade.",
    lookFor: "The felt tray of unfinished rings by the window.",
    signatureProduct: "Small-batch hammered silver",
    imageUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Jewellery", "Makers"],
    ...privilege({
      id: "gp_myrto",
      label: "Studio visit · 15 min with Myrto",
      detail: "Private 15-minute studio visit and try-on with the maker — show Guest App.",
      kind: "studio visit",
    }),
  },
  {
    id: "st_studio_nera",
    businessName: "Studio Nera",
    typeLabel: "Handmade silver jewellery",
    neighborhood: "Kypseli",
    location: "Kypseli · tiny workshop, appointment-like atmosphere",
    hours: "Wed–Sat 11:00–18:00 · knock",
    banditLine: "Tiny workshop, appointment-like atmosphere.",
    curator: "Elena · Local banDit",
    story:
      "Nera works alone above a quiet stairwell — hammer, torch, unfinished rings on a felt tray. It feels like an appointment even when the door is open.",
    whyVisit: "Nothing here was ordered for tourist footfall. You leave with metal she finished that week.",
    lookFor: "Ask which piece she’s finishing that week — often still warm from the torch.",
    signatureProduct: "One-of-one silver rings",
    imageUrl:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Jewellery", "Makers"],
    ...privilege({
      id: "gp_nera",
      label: "Meet the maker · torch demo",
      detail: "Watch a short finishing demo · complimentary polish cloth with any piece.",
      kind: "meet maker",
    }),
  },
  {
    id: "st_archive_71",
    businessName: "Archive 71",
    typeLabel: "Vintage clothing",
    neighborhood: "Exarchia",
    location: "Exarchia · unmarked door on a side street",
    hours: "Wed–Sun 13:00–20:00",
    banditLine: "Carefully sourced 80s–00s pieces.",
    curator: "Elena · Local banDit",
    story:
      "Kostas edits every piece before it hits the rail. If it looks like a costume, it doesn’t stay. 80s–00s only — no thrift dump.",
    whyVisit: "Word-of-mouth racks you’d never find on a map pin.",
    lookFor: "The navy linen jacket with the mended cuff — often reserved under the counter.",
    signatureProduct: "Edited 80s–00s linen & leather",
    imageUrl:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Vintage", "Fashion", "Second Hand"],
    ...privilege({
      id: "gp_archive71",
      label: "Reserved item hold · 24h",
      detail: "Ask for the banDit hold — one piece reserved for 24 hours under your name.",
      kind: "reserved item",
    }),
  },
  {
    id: "st_shelf",
    businessName: "Shelf",
    typeLabel: "Independent art bookshop",
    neighborhood: "Pangrati",
    location: "Pangrati · reading corner behind the poetry wall",
    hours: "Mon–Sat 11:00–21:00",
    banditLine: "Photography, architecture, small press and zines.",
    curator: "banDit pick",
    story:
      "Two shelves of English, three of Greek, photography monographs, architecture pamphlets, and a chair that locals treat like a library card.",
    whyVisit: "Staff build a stack from what you’re actually reading — not bestsellers.",
    lookFor: "The handwritten ‘Athens nights’ shelf note near the door.",
    signatureProduct: "Small press & photo books",
    imageUrl:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Books"],
    ...privilege({
      id: "gp_shelf",
      label: "Personal stack · five local titles",
      detail: "Staff pick a five-title Athens stack for you · member price on one title.",
      kind: "member price",
    }),
  },
  {
    id: "st_room_6",
    businessName: "Room 6",
    typeLabel: "Artist-run gallery",
    neighborhood: "Kerameikos",
    location: "Kerameikos · sixth-floor flat, intercom unmarked",
    hours: "Thu–Sun 16:00–21:00",
    banditLine: "Emerging Athens artists and temporary exhibitions.",
    curator: "Andreas · Local banDit",
    story:
      "Curator Maria hangs shows in her own rooms. Shoes off at the door; wine on the balcony. Temporary exhibitions that change with the city.",
    whyVisit: "Not a white-cube tourist gallery — a private room locals invite friends to.",
    lookFor: "The small works wall in the hallway — editions under €80.",
    signatureProduct: "Emerging Athens artists · small works",
    imageUrl:
      "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Galleries", "Art"],
    ...privilege({
      id: "gp_room6",
      label: "Private viewing before open",
      detail: "Arrive 30 minutes early · private walk-through with Maria before public hours.",
      kind: "private access",
    }),
  },
  {
    id: "st_second_skin",
    businessName: "Second Skin",
    typeLabel: "Designer second-hand",
    neighborhood: "Kolonaki",
    location: "Kolonaki backstreet · ground-floor with blackout curtains",
    hours: "Mon–Sat 11:00–20:00",
    banditLine: "Curated Greek and European fashion.",
    curator: "banDit pick",
    story:
      "Iris edits Greek labels and European pieces that still have years left. Fitting curtain, no rush, no mall energy.",
    whyVisit: "Designer second-hand with a curator’s eye — not a charity-shop scramble.",
    lookFor: "The ‘flying soon’ rail near the fitting curtain.",
    signatureProduct: "Curated Greek & European fashion",
    imageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1555529902-5261145633bf?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Fashion", "Second Hand", "Vintage"],
    ...privilege({
      id: "gp_secondskin",
      label: "Meet the maker · fit chat",
      detail: "15-minute styling conversation with Iris · hold on one piece for 24 hours.",
      kind: "meet maker",
    }),
  },
  {
    id: "st_object_object",
    businessName: "Object / Object",
    typeLabel: "Concept store",
    neighborhood: "Petralona",
    location: "Petralona · quiet storefront near the pottery streets",
    hours: "Wed–Sun 12:00–20:00",
    banditLine: "Ceramics, prints, small furniture and handmade objects.",
    curator: "banDit pick",
    story:
      "A rotating room of Athenian studios — ceramics, prints, small furniture. One designer family per month, no filler stock.",
    whyVisit: "You buy from the studio that made it, not a concept-store middleman.",
    lookFor: "The monthly drop shelf — usually two or three pieces left by week two.",
    signatureProduct: "Studio ceramics & small furniture",
    imageUrl:
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Design", "Makers"],
    ...privilege({
      id: "gp_object",
      label: "First look on drop day",
      detail: "Text the shop with Guest App code · early access on monthly drop mornings.",
      kind: "private access",
    }),
  },
  {
    id: "st_needle_drop",
    businessName: "Needle Drop",
    typeLabel: "Record shop",
    neighborhood: "Exarchia",
    location: "Exarchia · basement crates under a bookshop",
    hours: "Daily 12:00–21:00",
    banditLine: "Jazz, electronic, rare Greek pressings.",
    curator: "Nikos · Local banDit",
    story:
      "Brothers dig for reissues and local pressings. The booth is one person at a time — headphones, no rush.",
    whyVisit: "Ask for the Athens crate — they’ll dig while you listen.",
    lookFor: "The ‘staff slept on this’ shelf near the booth door.",
    signatureProduct: "Rare Greek pressings",
    imageUrl:
      "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1483412033650-1015d444ee19?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Records"],
    ...privilege({
      id: "gp_needle",
      label: "Private booth · 20 min",
      detail: "Reserved listening booth for 20 minutes · ask for the banDit Athens dig.",
      kind: "private access",
    }),
  },
  {
    id: "st_after_five",
    businessName: "After Five",
    typeLabel: "Tiny neighbourhood wine bar",
    neighborhood: "Kypseli",
    location: "Kypseli · narrow counter, no sign",
    hours: "Tue–Sun 17:00–01:00",
    banditLine: "Minimal seats, natural wine, local crowd.",
    curator: "banDit pick",
    story:
      "Eight seats, one sommelier, and bottles that never make hotel wine lists. Locals pass the address by voice.",
    whyVisit: "A wine bar you’d only hear about from someone who lives nearby.",
    lookFor: "The chalkboard with three pours that change every night.",
    signatureProduct: "Natural Greek pours",
    imageUrl:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Bars"],
    ...privilege({
      id: "gp_afterfive",
      label: "Welcome pour · house glass",
      detail: "One complimentary house pour when you show Guest App at the counter.",
      kind: "drink",
    }),
  },
  {
    id: "st_backroom",
    businessName: "Backroom",
    typeLabel: "Cocktail bar",
    neighborhood: "Kerameikos",
    location: "Kerameikos · hidden behind another storefront",
    hours: "Thu–Sat 20:00–02:00",
    banditLine: "Hidden behind another storefront.",
    curator: "Maria · Local banDit",
    story:
      "Walk through a daytime shop; after dark the back courtyard opens. Low light, local DJs, friends who know the door.",
    whyVisit: "Not a nightlife product — a friends’ room with a door code.",
    lookFor: "The courtyard mural wall — new piece every season.",
    signatureProduct: "House highballs · courtyard nights",
    imageUrl:
      "https://images.unsplash.com/photo-1561214115-f2f260980cb9?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Bars"],
    ...privilege({
      id: "gp_backroom",
      label: "Door code · before 22:00",
      detail: "Guest App unlocks the courtyard door code until 22:00 — skip the street queue.",
      kind: "private access",
    }),
  },
  {
    id: "st_tiny_cup",
    businessName: "Tiny Cup",
    typeLabel: "Micro coffee bar",
    neighborhood: "Pangrati",
    location: "Pangrati · six seats, green door",
    hours: "Daily 08:30–16:00 · closes when beans run out",
    banditLine: "Six seats, owner-operated.",
    curator: "banDit pick",
    story:
      "Six seats under a vine. The owner roasts small and closes when the beans run out. No English menu theatre.",
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
    ...privilege({
      id: "gp_tinycup",
      label: "Secret menu · honey latte",
      detail: "Ask for the banDit honey latte — not listed · pastry on the house with it.",
      kind: "secret menu",
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
    story: "Yannis prints editions of thirty. When they’re gone, that plate retires.",
    whyVisit: "You leave with paper that still smells like ink.",
    lookFor: "The drying rack — ask which edition is mid-run.",
    signatureProduct: "Signed small editions",
    imageUrl:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Art", "Makers"],
    ...privilege({
      id: "gp_stoa",
      label: "Watch a pull · 10 min",
      detail: "Stand at the press while Yannis pulls one print · take home a press scrap.",
      kind: "meet maker",
    }),
  },
  {
    id: "st_kerameikos_clay",
    businessName: "Kerameikos Clay",
    typeLabel: "Ceramics studio with retail",
    neighborhood: "Kerameikos",
    location: "Kerameikos · kiln street window bench",
    hours: "Thu–Sun 11:00–19:00",
    banditLine: "Speckled pourers thrown by the potter you meet at the bench.",
    curator: "banDit pick",
    story: "Dimitra throws in the back and sells from the front — no wholesale middle.",
    whyVisit: "Buy the cup from the hands that shaped it.",
    lookFor: "The seconds shelf — beautiful flaws, honest prices.",
    signatureProduct: "Speckled pourers & cups",
    imageUrl:
      "https://images.unsplash.com/photo-1493106819501-66d381c466f1?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Makers", "Design"],
    ...privilege({
      id: "gp_clay",
      label: "Mini cup with purchase",
      detail: "Complimentary mini cup with any purchase over €25 · show Guest App.",
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
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Second Hand", "Vintage", "Fashion"],
    ...privilege({
      id: "gp_hideseek",
      label: "Flying-soon edit · pulled for you",
      detail: "Tell them your flight day · a three-piece travel edit waiting under your name.",
      kind: "reserved item",
    }),
  },
  {
    id: "st_bar_limeni",
    businessName: "Bar Limeni",
    typeLabel: "Neighbourhood cocktail bar",
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
      "https://images.unsplash.com/photo-1551024709-8f23befc0f44?auto=format&fit=crop&w=900&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Bars"],
    ...privilege({
      id: "gp_limeni",
      label: "Priority stool · before 21:00",
      detail: "One reserved counter stool before 21:00 · welcome highball on the house.",
      kind: "priority table",
    }),
  },
  {
    id: "st_kafeneio_minor",
    businessName: "Kafeneio Minor",
    typeLabel: "Hidden café · old-school",
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
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1442512595331-e582b5e1f5e0?auto=format&fit=crop&w=900&q=80",
    ],
    filterTags: ["Cafés", "Food"],
    ...privilege({
      id: "gp_minor",
      label: "Complimentary ellinikos",
      detail: "One complimentary Greek coffee with any pastry · show Guest App.",
      kind: "drink",
    }),
  },
  {
    id: "st_bread_circle",
    businessName: "Bread Circle",
    typeLabel: "Bakery locals actually use",
    neighborhood: "Psyrri",
    location: "Psyrri · dawn shutters, flour on the sill",
    hours: "Daily 07:00–15:00",
    banditLine: "Olive sourdough before the queue — locals know the side door.",
    curator: "banDit pick",
    story: "Yianni’s oven feeds the block. No branded bags, no brunch menu — just bread.",
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
    ...privilege({
      id: "gp_bread",
      label: "Koulouri with pastry box",
      detail: "Free koulouri with any pastry box · morning only · Guest App.",
      kind: "gift",
    }),
  },
];
