// SINGLE SOURCE for the "eat next" advice (A3). Plain data — edit this file
// when a patch changes a diet; nothing else needs to change.
//
// The Isle: Evrima. Sources (checked 2026-08-29):
//  · Roster + diet type — https://www.theisle.info/dinosaurs
//  · Carnivore organ → nutrient — Steam guide "Ultimate Survival Guide"
//    (id 3440690332) + Fandom "Diet System": there is NO per-prey list, the
//    organ is the food:
//        Lungs  (2 per corpse) → α Carbs
//        Heart                 → β Protein
//        Intestines            → γ Lipids
//        Stomach               → whichever nutrient was highest when the prey died
//  · Herbivore plants are per-species (3 preferred, one per nutrient) but the
//    exact list SHIFTS BETWEEN PATCHES and varies by zone. Only entries we
//    could confirm carry `plants`; the rest fall back to "vary your plants".
//    Confirmed: Tenontosaurus (Mountain Ash · Wild Potato Root · Radish Root).
//    Partial (add the 3rd / re-check in-game): Dryosaurus, Hypsilophodon,
//    Pachycephalosaurus, Stegosaurus.
//
// Nutrient bars: α Carbs · β Protein · γ Lipids. Each fills up to +100% growth
// rate; all three = +300%. (theisle.info/guide/diets)

export type DietType = "herb" | "carn" | "omni";

export interface DietEntry {
  diet: DietType;
  /** Herbivore only: preferred plant foods, in no particular nutrient order.
   *  Omit when unconfirmed — the advice then says "vary your plants". */
  plants?: string[];
}

// Keyed by lowercase species. IslePilot sends the species as the dino name in
// token mode, matched loosely (substring, either direction) so "Tenonto" hits.
export const DINO_DIETS: Record<string, DietEntry> = {
  // — Herbivores —
  triceratops: { diet: "herb" },
  stegosaurus: { diet: "herb", plants: ["Chanterelle Mushroom", "Fireweed"] },
  diabloceratops: { diet: "herb" },
  kentrosaurus: { diet: "herb" },
  tenontosaurus: {
    diet: "herb",
    plants: ["Mountain Ash", "Wild Potato Root", "Radish Root"],
  },
  maiasaura: { diet: "herb" },
  pachycephalosaurus: { diet: "herb", plants: ["Agave", "Sumac"] },
  dryosaurus: { diet: "herb", plants: ["Agave", "Chanterelle Mushroom"] },
  hypsilophodon: { diet: "herb", plants: ["Chanterelle Mushroom", "Fiddlehead"] },

  // — Carnivores (organ rule; no plant list) —
  tyrannosaurus: { diet: "carn" },
  allosaurus: { diet: "carn" },
  carnotaurus: { diet: "carn" },
  ceratosaurus: { diet: "carn" },
  baryonyx: { diet: "carn" },
  dilophosaurus: { diet: "carn" },
  herrerasaurus: { diet: "carn" },
  austroraptor: { diet: "carn" },
  troodon: { diet: "carn" },
  omniraptor: { diet: "carn" },
  deinosuchus: { diet: "carn" },
  pteranodon: { diet: "carn" },

  // — Omnivores (both plants and organs) —
  beipiaosaurus: { diet: "omni" },
  gallimimus: { diet: "omni" },
};

/** Loose species → diet entry. Unknown species → a neutral omnivore entry. */
export function dietEntry(species: string | null | undefined): DietEntry {
  const n = (species ?? "").trim().toLowerCase();
  if (n.length >= 4) {
    for (const [key, entry] of Object.entries(DINO_DIETS)) {
      if (n.includes(key) || key.includes(n)) return entry;
    }
  }
  return { diet: "omni" };
}
