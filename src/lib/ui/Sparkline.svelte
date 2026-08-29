<script lang="ts">
  // Amber atom — a tiny trend line with a soft area fill and an emphasised
  // end point (plan ch.03). Used for growth history now; stat history later.
  interface Props {
    points: number[];
    tone?: "ok" | "warn" | "danger" | "amber";
    height?: number;
    /** fixed scale; defaults to the data's own min/max */
    min?: number;
    max?: number;
    ariaLabel?: string;
  }
  let { points, tone = "amber", height = 22, min, max, ariaLabel }: Props = $props();

  const W = 100; // viewBox units; stretched to fit by preserveAspectRatio="none"
  const stroke = $derived(tone === "amber" ? "var(--amber)" : `var(--sem-${tone})`);

  const path = $derived.by(() => {
    if (points.length < 2) return null;
    const lo = min ?? Math.min(...points);
    const hi = max ?? Math.max(...points);
    const span = hi - lo || 1;
    const step = W / (points.length - 1);
    const xy = points.map((p, i) => {
      const x = i * step;
      const y = height - 2 - ((p - lo) / span) * (height - 4);
      return [x, y] as const;
    });
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${line} L${W} ${height} L0 ${height} Z`;
    return { line, area, end: xy[xy.length - 1] };
  });
</script>

{#if path}
  <svg
    class="spark"
    viewBox="0 0 {W} {height}"
    preserveAspectRatio="none"
    style="height: {height}px"
    role="img"
    aria-label={ariaLabel ?? "trend"}
  >
    <path d={path.area} fill={stroke} fill-opacity="0.14" stroke="none" />
    <path
      d={path.line}
      fill="none"
      stroke={stroke}
      stroke-width="1.5"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <circle cx={path.end[0]} cy={path.end[1]} r="2" fill={stroke} vector-effect="non-scaling-stroke" />
  </svg>
{/if}

<style>
  .spark {
    display: block;
    width: 100%;
  }
</style>
