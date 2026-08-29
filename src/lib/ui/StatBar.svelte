<script lang="ts">
  // Amber atom — one vital: label, thin track, mono readout. Colour is
  // status (var(--sem-*)), never the accent. `tone="auto"` bands by ratio;
  // the readout also carries the number, so a mono-vision reader isn't
  // relying on hue alone (plan P1/P4, A8).
  interface Props {
    label: string;
    value: number | null;
    max: number | null;
    /** "auto" bands ok/warn/danger by ratio; "accent" is for progress (growth) */
    tone?: "ok" | "warn" | "danger" | "accent" | "auto";
    /** overrides the "cur/max" readout, e.g. "73%" for growth */
    text?: string;
  }
  let { label, value, max, tone = "auto", text }: Props = $props();

  const ratio = $derived(
    value !== null && max !== null && max > 0 ? Math.max(0, Math.min(1, value / max)) : null,
  );
  const band = $derived(
    tone !== "auto"
      ? tone
      : ratio === null || ratio > 0.5
        ? "ok"
        : ratio > 0.25
          ? "warn"
          : "danger",
  );
  const readout = $derived(
    text ??
      (value !== null && max !== null ? `${Math.round(value)}/${Math.round(max)}` : "—"),
  );
</script>

<div class="row">
  <span class="label">{label}</span>
  <span class="track">
    <span
      class="fill {band}"
      style="width: {ratio === null ? 0 : Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%"
    ></span>
  </span>
  <span class="val">{readout}</span>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(2.5rem, auto) 1fr minmax(3rem, auto);
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
  }
  .label {
    color: var(--ink);
  }
  .track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--panel-2);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width var(--dur-panel) var(--ease-out);
  }
  .fill.ok {
    background: var(--sem-ok);
  }
  .fill.warn {
    background: var(--sem-warn);
  }
  .fill.danger {
    background: var(--sem-danger);
  }
  .fill.accent {
    background: var(--amber);
  }
  .val {
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--ink-mid);
    font-variant-numeric: tabular-nums;
  }
  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
