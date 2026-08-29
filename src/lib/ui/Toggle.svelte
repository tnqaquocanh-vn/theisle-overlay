<script lang="ts">
  // Amber atom — a labelled switch. Knows "on" by colour (biolum) AND knob
  // position, so it reads for every kind of vision (plan ch.03).
  // Controlled: `checked` always reflects the prop, `toggle()` only asks the
  // parent to change it. The parent (settings) is the single source of truth,
  // so a cancelled confirm dialog leaves the switch where it was.
  interface Props {
    checked?: boolean;
    label: string;
    hint?: string;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }
  let { checked = false, label, hint, disabled = false, onchange }: Props = $props();

  function toggle() {
    if (disabled) return;
    onchange?.(!checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class="row"
  onclick={toggle}
>
  <span class="track" class:on={checked}><span class="knob"></span></span>
  <span class="text">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
</button>

<style>
  .row {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    width: 100%;
    padding: 0;
    background: none;
    border: 0;
    text-align: left;
    cursor: pointer;
    color: var(--ink);
    font: inherit;
  }
  .row:disabled {
    cursor: default;
    opacity: 0.5;
  }
  .track {
    flex: none;
    width: 34px;
    height: 20px;
    margin-top: 1px;
    border-radius: var(--radius-pill);
    background: var(--panel-2);
    border: 1px solid var(--edge);
    transition:
      background var(--dur-micro) var(--ease-out),
      border-color var(--dur-micro) var(--ease-out);
  }
  .track.on {
    background: color-mix(in srgb, var(--biolum) 26%, var(--panel-2));
    border-color: var(--biolum);
  }
  .knob {
    display: block;
    width: 14px;
    height: 14px;
    margin: 2px;
    border-radius: var(--radius-pill);
    background: var(--ink-mid);
    transition:
      transform var(--dur-micro) var(--ease-out),
      background var(--dur-micro) var(--ease-out);
  }
  .track.on .knob {
    transform: translateX(14px);
    background: var(--biolum);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    font-size: 0.875rem;
    line-height: 1.4;
  }
  .hint {
    font-size: 0.75rem;
    color: var(--ink-mute);
  }
  .row:focus-visible {
    outline: 2px solid var(--biolum);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    .track,
    .knob {
      transition: none;
    }
  }
</style>
