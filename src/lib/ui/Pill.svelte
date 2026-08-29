<script lang="ts">
  import type { Snippet } from "svelte";

  // Amber atom — a compact status chip. `live` = fresh/linked (biolum border),
  // `stale` = data is old (amber), `danger` = something's wrong (blood).
  interface Props {
    tone?: "neutral" | "live" | "stale" | "danger";
    mono?: boolean;
    children: Snippet;
  }
  let { tone = "neutral", mono = true, children }: Props = $props();
</script>

<span class="pill {tone}" class:mono>{@render children()}</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.1rem 0.5rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--edge);
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    color: var(--ink-mid);
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: nowrap;
  }
  .mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .live {
    border-color: var(--biolum);
    color: var(--biolum);
  }
  .stale {
    border-color: var(--amber-line);
    color: var(--amber);
  }
  .danger {
    border-color: var(--sem-danger);
    color: var(--sem-danger);
  }
</style>
