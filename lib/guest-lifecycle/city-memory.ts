/**
 * City Memory + smart discovery helpers (taste graph, not noisy feed).
 */

import type { CityMemoryItem, GuestLifecycleSnapshot } from "./types";

export type AfterTripHomeModel = {
  cityLabel: string;
  memoryTitle: string;
  savedPlaces: CityMemoryItem[];
  mySpots: CityMemoryItem[];
  followedBandits: CityMemoryItem[];
  placesLoved: CityMemoryItem[];
  neighborhoods: CityMemoryItem[];
  guides: CityMemoryItem[];
  experiences: CityMemoryItem[];
  bottleJourneys: CityMemoryItem[];
  categories: string[];
  destinationsVisited: CityMemoryItem[];
  discoveryPicks: { id: string; title: string; detail: string; href: string }[];
  similarCities: { id: string; title: string; detail: string }[];
  nextTripIdeas: { id: string; title: string; detail: string }[];
};

export function buildAfterTripHome(snap: GuestLifecycleSnapshot): AfterTripHomeModel {
  const city = snap.lifecycle.lastCity || "Your city";
  const mem = snap.cityMemory;
  const savedPlaces = mem.filter((m) => m.kind === "saved_place" || m.kind === "liked_place");
  const mySpots = mem.filter((m) => m.kind === "spot");
  const followedBandits = mem.filter((m) => m.kind === "followed_bandit");
  const placesLoved = mem.filter((m) => m.meta?.loved === true || m.kind === "liked_place");
  const neighborhoods = mem.filter((m) => m.kind === "neighborhood");
  const guides = mem.filter((m) => m.kind === "guide");
  const experiences = mem.filter((m) => m.kind === "experience");
  const bottleJourneys = mem.filter((m) => m.kind === "bottle_journey");
  const destinationsVisited = mem.filter((m) => m.kind === "destination_visited");
  const categories = Array.from(
    new Set(mem.map((m) => m.category).filter((c): c is string => Boolean(c))),
  );

  const discoveryPicks = [
    {
      id: "disc_follow",
      title: "New picks from followed banDits",
      detail:
        followedBandits.length > 0
          ? `${followedBandits.length} banDits still guiding you`
          : "Follow banDits to keep discovery warm",
      href: "/following",
    },
    {
      id: "disc_taste",
      title: "Recs based on your trip",
      detail:
        categories.length > 0
          ? `Because you loved ${categories.slice(0, 2).join(" · ")}`
          : "Built from places you saved",
      href: "/explore",
    },
    {
      id: "disc_exp",
      title: "Experiences that match your taste",
      detail: "Public guides & experiences — no hotel gate needed",
      href: "/experiences",
    },
  ];

  const similarCities =
    city.toLowerCase() === "athens"
      ? [
          { id: "lisbon", title: "Lisbon", detail: "Similar neighborhood energy to Exarchia & Psyrri" },
          { id: "barcelona", title: "Barcelona", detail: "Food + night streets like your Athens saves" },
        ]
      : [
          { id: "athens", title: "Athens", detail: "Return to a city already in your memory" },
          { id: "porto", title: "Porto", detail: "Quiet discovery rhythm matching your taste" },
        ];

  const nextTripIdeas = [
    {
      id: "plan",
      title: "Plan Your Next Trip",
      detail: snap.lifecycle.nextDestination
        ? `Continue planning ${snap.lifecycle.nextDestination}`
        : "Start from memory — not from zero",
    },
    {
      id: "bottle",
      title: "Travel in a Bottle",
      detail: "Build the journey before the hotel activates",
    },
    {
      id: "dest",
      title: "Next destination ideas",
      detail: "Cities that rhyme with where you’ve been",
    },
  ];

  return {
    cityLabel: city,
    memoryTitle: `Your ${city} Memory`,
    savedPlaces,
    mySpots,
    followedBandits,
    placesLoved: placesLoved.length ? placesLoved : mySpots,
    neighborhoods,
    guides,
    experiences,
    bottleJourneys,
    categories,
    destinationsVisited,
    discoveryPicks,
    similarCities,
    nextTripIdeas,
  };
}
