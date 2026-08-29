<script lang="ts">
  // A3 — "eat next" hint. IslePilot only sends C/P/L alongside the species
  // (token mode → `name` is the species), so we look the species up in
  // src/lib/dino-diets.data.ts and turn the lowest of the three nutrient bars
  // into concrete advice: for carnivores the organ that fills that bar, for
  // herbivores the species' preferred plants (when known). Diet data lives in
  // that one file so it's a one-line edit per patch.
  import { t } from "$lib/i18n";
  import { dietEntry } from "$lib/dino-diets.data";
  import Pill from "$lib/ui/Pill.svelte";

  let {
    carb,
    protein,
    lipid,
    name,
  }: { carb: number; protein: number; lipid: number; name: string | null } = $props();

  const OK = 20; // at/above this the nutrient is comfortable

  const entry = $derived(dietEntry(name));
  const rows = $derived(
    [
      { key: "carb", val: carb, label: $t("dino.nutrition_carb") },
      { key: "protein", val: protein, label: $t("dino.nutrition_protein") },
      { key: "lipid", val: lipid, label: $t("dino.nutrition_lipid") },
    ] as const,
  );
  const lowest = $derived([...rows].sort((a, b) => a.val - b.val)[0]);
  const balanced = $derived(lowest.val >= OK);

  const advice = $derived.by(() => {
    if (balanced) return $t("nutriadvice.balanced");
    if (entry.diet === "herb") {
      return entry.plants?.length
        ? $t("nutriadvice.herb_plants", {
            nutrient: lowest.label,
            foods: entry.plants.join(" · "),
          })
        : $t("nutriadvice.herb");
    }
    return $t(`nutriadvice.${entry.diet}_${lowest.key}` as never);
  });
</script>

<div class="adv">
  <span class="stripe" aria-hidden="true"></span>
  <div class="head">{$t("nutriadvice.title")}</div>
  <p class="body">{advice}</p>
  <div class="chips">
    {#each rows as r (r.key)}
      <Pill tone={r.val < OK && r.key === lowest.key ? "danger" : r.val < OK ? "stale" : "live"} mono>
        {r.label} {Math.round(r.val)}%
      </Pill>
    {/each}
  </div>
</div>

<style>
  .adv {
    position: relative;
    margin-top: 0.7rem;
    padding: 0.7rem 0.8rem 0.7rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-panel);
    overflow: hidden;
  }
  .stripe {
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 2.5px;
    border-radius: 0 2px 2px 0;
    background: var(--moss);
  }
  .head {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-mute);
    margin-bottom: 0.3rem;
  }
  .body {
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink);
    margin: 0 0 0.5rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
</style>
