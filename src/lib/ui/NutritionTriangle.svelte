<script lang="ts">
  // Ternary plot of the three macronutrients (IslePilot carb / protein /
  // lipid). One dot in the triangle says "your diet leans protein" at a
  // glance; the exact values sit under the vertices.
  import { t } from "$lib/i18n";

  interface Props {
    carb: number;
    protein: number;
    lipid: number;
  }
  let { carb, protein, lipid }: Props = $props();

  const total = $derived(Math.max(1e-6, carb + protein + lipid));
  const fc = $derived(Math.max(0, carb) / total);
  const fp = $derived(Math.max(0, protein) / total);
  const fl = $derived(Math.max(0, lipid) / total);

  // viewBox units. Vertices: protein top, carb bottom-left, lipid bottom-right.
  const W = 120;
  const H = 108;
  const M = 14;
  const Vp: [number, number] = [W / 2, M];
  const Vc: [number, number] = [M, H - M];
  const Vl: [number, number] = [W - M, H - M];

  const dot = $derived<[number, number]>([
    fp * Vp[0] + fc * Vc[0] + fl * Vl[0],
    fp * Vp[1] + fc * Vc[1] + fl * Vl[1],
  ]);

  const tri = `${Vp[0]},${Vp[1]} ${Vc[0]},${Vc[1]} ${Vl[0]},${Vl[1]}`;
  // Two inner grid triangles at 1/3 and 2/3 for a sense of scale.
  const lerp = (a: [number, number], b: [number, number], k: number): [number, number] => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
  ];
  const grid = (k: number) => {
    const a = lerp(Vp, Vc, k);
    const b = lerp(Vc, Vl, k);
    const c = lerp(Vl, Vp, k);
    return `${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`;
  };

  const pct = (f: number) => `${Math.round(f * 100)}%`;
</script>

<figure class="nt">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label={$t("dino.nutrition")}>
    <polygon points={grid(1 / 3)} class="grid" />
    <polygon points={grid(2 / 3)} class="grid" />
    <polygon points={tri} class="edge" />
    <circle cx={dot[0]} cy={dot[1]} r="6" class="halo" />
    <circle cx={dot[0]} cy={dot[1]} r="3.4" class="dot" />
  </svg>
  <div class="legend">
    <span><b style="color:var(--sem-ok)">{pct(fc)}</b> {$t("dino.nutrition_carb")}</span>
    <span><b style="color:var(--sem-danger)">{pct(fp)}</b> {$t("dino.nutrition_protein")}</span>
    <span><b style="color:var(--sem-warn)">{pct(fl)}</b> {$t("dino.nutrition_lipid")}</span>
  </div>
</figure>

<style>
  .nt {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
  }
  svg {
    width: 100%;
    max-width: 170px;
    height: auto;
  }
  .edge {
    fill: color-mix(in srgb, var(--amber) 7%, transparent);
    stroke: var(--amber-line);
    stroke-width: 1.2;
    stroke-linejoin: round;
  }
  .grid {
    fill: none;
    stroke: var(--edge);
    stroke-width: 0.8;
  }
  .halo {
    fill: color-mix(in srgb, var(--biolum) 26%, transparent);
  }
  .dot {
    fill: var(--biolum);
    stroke: var(--ground);
    stroke-width: 1;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.15rem 0.7rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-mute);
  }
  .legend b {
    font-variant-numeric: tabular-nums;
  }
</style>
