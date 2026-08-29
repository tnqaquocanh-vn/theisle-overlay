<script lang="ts">
  import type { Snippet } from "svelte";

  // Amber atom — three ranks. `primary` = amber fill (one per view),
  // `secondary` = outline, `ghost` = text only. `selected` styles it as the
  // active item of a segmented group.
  interface Props {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md";
    selected?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
    title?: string;
    ariaLabel?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }
  let {
    variant = "secondary",
    size = "md",
    selected = false,
    disabled = false,
    type = "button",
    title,
    ariaLabel,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {title}
  aria-label={ariaLabel}
  aria-pressed={selected ? true : undefined}
  class="btn {variant} {size}"
  class:selected
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    font: inherit;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-micro) var(--ease-out),
      border-color var(--dur-micro) var(--ease-out),
      color var(--dur-micro) var(--ease-out);
  }
  .md {
    height: 38px;
    padding: 0 0.9rem;
    font-size: 0.875rem;
  }
  .sm {
    height: 30px;
    padding: 0 0.65rem;
    font-size: 0.78rem;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn:focus-visible {
    outline: 2px solid var(--biolum);
    outline-offset: 2px;
  }

  .primary {
    background: var(--amber);
    color: var(--ground);
    font-weight: 600;
  }
  .primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--amber) 88%, white);
  }

  .secondary {
    border-color: var(--edge);
    color: var(--ink);
  }
  .secondary:hover:not(:disabled) {
    border-color: var(--ink-mute);
  }

  .ghost {
    color: var(--ink-mid);
  }
  .ghost:hover:not(:disabled) {
    color: var(--ink);
  }

  .btn.selected {
    background: var(--amber);
    border-color: var(--amber);
    color: var(--ground);
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }
  }
</style>
