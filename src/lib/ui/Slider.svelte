<script lang="ts">
  // Amber atom — a labelled range with a mono value readout. `onchange` fires
  // on release, `oninput` on every drag tick; pass whichever the target wants
  // (the basemap-sharpness slider re-decodes an image, so it uses onchange).
  interface Props {
    value?: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    hint?: string;
    format?: (v: number) => string;
    oninput?: (v: number) => void;
    onchange?: (v: number) => void;
  }
  let {
    value = $bindable(0),
    min,
    max,
    step = 1,
    label,
    hint,
    format = (v) => String(v),
    oninput,
    onchange,
  }: Props = $props();
</script>

<label class="wrap">
  <span class="head">
    <span class="label">{label}</span>
    <span class="val">{format(value)}</span>
  </span>
  <input
    type="range"
    {min}
    {max}
    {step}
    bind:value
    oninput={(e) => oninput?.(Number(e.currentTarget.value))}
    onchange={(e) => onchange?.(Number(e.currentTarget.value))}
  />
  {#if hint}<span class="hint">{hint}</span>{/if}
</label>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.875rem;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  .val {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-mute);
    font-variant-numeric: tabular-nums;
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--amber);
    cursor: pointer;
  }
  input[type="range"]:focus-visible {
    outline: 2px solid var(--biolum);
    outline-offset: 4px;
  }
  .hint {
    font-size: 0.75rem;
    color: var(--ink-mute);
  }
</style>
