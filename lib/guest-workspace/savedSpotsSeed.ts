/**
 * Saved Places seed — hearted places/experiences (NOT followed banDits).
 */

export type SavedSpot = {
  id: string;
  title: string;
  kind: "restaurant" | "cafe" | "bar" | "gallery" | "shop" | "experience" | "spot";
  area: string;
  city: string;
  imageUrl: string;
  href?: string;
};

export const SAVED_SPOTS_SEED: SavedSpot[] = [
  {
    id: "spot_courtyard",
    title: "Courtyard Kitchen",
    kind: "restaurant",
    area: "PLAY Theatrou",
    city: "Athens",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
    href: "/hotelier/restaurant",
  },
  {
    id: "spot_rooftop",
    title: "PLAY Rooftop",
    kind: "bar",
    area: "Psyrri",
    city: "Athens",
    imageUrl:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
    href: "/hotelier/events",
  },
  {
    id: "spot_monastiraki",
    title: "Monastiraki Square walk",
    kind: "experience",
    area: "Monastiraki",
    city: "Athens",
    imageUrl:
      "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=800&q=80",
    href: "/explore",
  },
  {
    id: "spot_vinyl",
    title: "Vinyl & Postcard Alley",
    kind: "shop",
    area: "Psyrri",
    city: "Athens",
    imageUrl:
      "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=800&q=80",
    href: "/explore",
  },
  {
    id: "spot_gallery",
    title: "Side-street Gallery",
    kind: "gallery",
    area: "Thisseio",
    city: "Athens",
    imageUrl:
      "https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?auto=format&fit=crop&w=800&q=80",
    href: "/explore",
  },
  {
    id: "spot_coffee",
    title: "Morning Filter Bar",
    kind: "cafe",
    area: "Psyrri",
    city: "Athens",
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
    href: "/explore",
  },
];
