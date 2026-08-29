<script lang="ts">
  // Stat history for the current dino/life: growth curve + hunger/thirst
  // sparklines + derived rates, all from the local JSONL the poller appends.
  // Self-fetching — re-reads on dino://update, throttled, since DinoTab keeps
  // this component mounted across tab switches.
  import { onMount } from "svelte";
  import { ask } from "@tauri-apps/plugin-dialog";
  import {
    dinoHistory,
    dinoHistoryClear,
    listenerBag,
    onDinoUpdate,
    type DinoHistory,
    type DinoHistPoint,
  } from "$lib/api";
  import { t, tNow } from "$lib/i18n";

  type Range = 6 | 24 | 0;
  let range = $state<Range>(6);
  let history = $state<DinoHistory | null>(null);
  let loading = $state(false);
  let lastLoad = 0;

  async function load() {
    loading = true;
    try {
      history = await dinoHistory(range);
      lastLoad = Date.now();
    } catch {
      // History is best-effort; an empty panel is fine.
    } finally {
      loading = false;
    }
  }

  function setRange(r: Range) {
    if (r === range) return;
    range = r;
    void load();
  }

  async function clear() {
    const yes = await ask(tNow("dino.history_clear_confirm"), {
      title: tNow("dino.history_title"),
      kind: "warning",
    });
    if (!yes) return;
    await dinoHistoryClear();
    await load();
  }

  onMount(() => {
    const bag = listenerBag();
    void load();
    void bag.add(
      onDinoUpdate(() => {
        // The poll fires ~every 10 s; one reparse per 20 s is plenty.
        if (Date.now() - lastLoad > 20_000) void load();
      }),
    );
    return () => bag.dispose();
  });

  const points = $derived(history?.points ?? []);
  const hasSeries = $derived(points.length >= 2);

  // --- sparkline geometry -------------------------------------------------
  const VB_W = 300;
  const VB_H = 64;

  type Spark = { line: string; area: string; endX: number; endY: number } | null;

  function spark(pts: DinoHistPoint[], pick: (p: DinoHistPoint) => number | null): Spark {
    const usable = pts
      .map((p) => ({ t: p.t, v: pick(p) }))
      .filter((p): p is { t: number; v: number } => p.v !== null);
    if (usable.length < 2) return null;
    const t0 = usable[0].t;
    const t1 = usable[usable.length - 1].t;
    const span = t1 - t0 || 1;
    const x = (tt: number) => ((tt - t0) / span) * VB_W;
    const y = (v: number) => VB_H - (Math.max(0, Math.min(100, v)) / 100) * VB_H;
    const xy = usable.map((p) => [x(p.t), y(p.v)] as const);
    const line = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
    const area = `${line} L${VB_W} ${VB_H} L0 ${VB_H} Z`;
    const [endX, endY] = xy[xy.length - 1];
    return { line, area, endX, endY };
  }

  const growthSpark = $derived(spark(points, (p) => p.growthPct));

  type Mini = { key: string; spark: Spark; color: string; emptyH: number | null };
  const miniCharts = $derived<Mini[]>([
    {
      key: "dino.chart_hunger",
      spark: spark(points, (p) => p.hungerPct),
      color: "#e8a33d",
      emptyH: history?.hungerEmptyH ?? null,
    },
    {
      key: "dino.chart_thirst",
      spark: spark(points, (p) => p.thirstPct),
      color: "#4aa8d8",
      emptyH: history?.thirstEmptyH ?? null,
    },
  ]);

  const lastGrowth = $derived(
    [...points].reverse().find((p) => p.growthPct !== null)?.growthPct ?? null,
  );

  // --- value formatting ------------------------------------------------------
  const fmtRate = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : tNow("dino.rate_per_h", { v: v.toFixed(1) });

  function fmtEta(h: number | null | undefined): string {
    if (h === null || h === undefined) return "—";
    if (h < 0.25) return tNow("dino.eta_soon");
    return tNow("dino.eta_hours", { h: h < 10 ? h.toFixed(1) : Math.round(h).toString() });
  }
</script>

<section
  class="rounded border p-4"
  style="border-color: var(--color-border); background: var(--color-panel)"
>
  <div class="mb-3 flex flex-wrap items-center gap-2">
    <h3 class="text-sm font-semibold" style="color: var(--color-accent)">
      {$t("dino.history_title")}
    </h3>
    <div class="ml-auto flex gap-1">
      {#each [[6, "dino.history_range_6h"], [24, "dino.history_range_24h"], [0, "dino.history_range_all"]] as [r, key] (r)}
        <button
          class="cursor-pointer rounded border px-2 py-0.5 text-xs"
          style={range === r
            ? "border-color: var(--color-accent); color: var(--color-accent)"
            : "border-color: var(--color-border); color: var(--color-muted)"}
          onclick={() => setRange(r as Range)}
        >
          {$t(key as never)}
        </button>
      {/each}
    </div>
  </div>

  {#if !hasSeries}
    <p class="text-sm" style="color: var(--color-muted)">
      {loading ? "…" : $t("dino.history_empty")}
    </p>
  {:else}
    <!-- Derived-rate tiles -->
    <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {#each [["dino.growth_rate", fmtRate(history?.growthRatePerH)], ["dino.eta_adult", lastGrowth !== null && lastGrowth >= 100 ? "100%" : fmtEta(history?.etaAdultH)], ["dino.drain_hunger", fmtRate(history?.hungerDrainPerH)], ["dino.drain_thirst", fmtRate(history?.thirstDrainPerH)]] as [labelKey, value] (labelKey)}
        <div class="rounded border p-2" style="border-color: var(--color-border); background: var(--color-bg)">
          <div class="text-[10px] uppercase tracking-wide" style="color: var(--color-muted)">
            {$t(labelKey as never)}
          </div>
          <div class="mt-0.5 font-mono text-sm" style="color: var(--color-text)">{value}</div>
        </div>
      {/each}
    </div>

    <!-- Growth curve (headline) -->
    <div class="mb-1 flex items-baseline justify-between text-xs">
      <span style="color: var(--color-muted)">{$t("dino.chart_growth")}</span>
      <span class="font-mono" style="color: var(--color-accent)">
        {lastGrowth !== null ? `${Math.round(lastGrowth)}%` : "—"}
      </span>
    </div>
    <svg
      viewBox="0 0 {VB_W} {VB_H}"
      preserveAspectRatio="none"
      class="mb-3 block h-16 w-full rounded"
      style="background: var(--color-bg)"
      role="img"
      aria-label={$t("dino.chart_growth")}
    >
      <line x1="0" y1={VB_H / 2} x2={VB_W} y2={VB_H / 2} stroke="var(--color-border)" stroke-width="0.5" />
      {#if growthSpark}
        <path d={growthSpark.area} fill="var(--color-accent)" fill-opacity="0.12" />
        <path
          d={growthSpark.line}
          fill="none"
          stroke="var(--color-accent)"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
        />
        <circle cx={growthSpark.endX} cy={growthSpark.endY} r="2.5" fill="var(--color-accent)" />
      {/if}
    </svg>

    <!-- Hunger / thirst sparklines -->
    <div class="grid grid-cols-2 gap-3">
      {#each miniCharts as mini (mini.key)}
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span style="color: var(--color-muted)">{$t(mini.key as never)}</span>
            {#if mini.emptyH !== null}
              <span class="font-mono text-[10px]" style="color: var(--color-muted)">
                {$t("dino.empty_in", {
                  h: mini.emptyH < 10 ? mini.emptyH.toFixed(1) : Math.round(mini.emptyH).toString(),
                })}
              </span>
            {/if}
          </div>
          <svg
            viewBox="0 0 {VB_W} {VB_H}"
            preserveAspectRatio="none"
            class="block h-12 w-full rounded"
            style="background: var(--color-bg)"
            role="img"
            aria-label={$t(mini.key as never)}
          >
            {#if mini.spark}
              <path d={mini.spark.area} fill={mini.color} fill-opacity="0.1" />
              <path
                d={mini.spark.line}
                fill="none"
                stroke={mini.color}
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
                stroke-linejoin="round"
              />
              <circle cx={mini.spark.endX} cy={mini.spark.endY} r="2.5" fill={mini.color} />
            {/if}
          </svg>
        </div>
      {/each}
    </div>

    <div class="mt-3 text-right">
      <button
        class="cursor-pointer text-xs underline"
        style="color: var(--color-muted)"
        onclick={() => void clear()}
      >
        {$t("dino.history_clear")}
      </button>
    </div>
  {/if}
</section>
