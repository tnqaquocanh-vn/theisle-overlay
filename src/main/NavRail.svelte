<script lang="ts">
  // Amber v1.24 — the main window's navigation. A vertical rail (icon + label,
  // amber active bar) that collapses to icons only on a narrow window. Purely
  // presentational: it binds `tab` and renders whatever icon markup it's given.
  import { t } from "$lib/i18n";

  interface Item {
    key: string;
    label: string;
    /** inner <path>… markup for a 24×24 stroke="currentColor" icon */
    icon: string;
  }
  interface Props {
    tab: string;
    items: Item[];
    collapsed?: boolean;
    version: string;
    onSelect: (key: string) => void;
    onDevStep?: () => void;
  }
  let { tab, items, collapsed = false, version, onSelect, onDevStep }: Props = $props();
</script>

<nav class="rail" class:collapsed aria-label={$t("app.title")}>
  <div class="brand" title={$t("app.title")}>
    <svg viewBox="0 0 24 24" class="mark" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="9" rx="3" ry="7.5" fill="currentColor" />
      <ellipse cx="6" cy="13" rx="2.4" ry="6" transform="rotate(-22 6 13)" fill="currentColor" />
      <ellipse cx="18" cy="13" rx="2.4" ry="6" transform="rotate(22 18 13)" fill="currentColor" />
      <ellipse cx="12" cy="20" rx="3.4" ry="3" fill="currentColor" />
    </svg>
    {#if !collapsed}<span class="wordmark">{$t("app.title")}</span>{/if}
  </div>

  <ul class="items">
    {#each items as it (it.key)}
      <li>
        <button
          class="item"
          class:active={tab === it.key}
          aria-current={tab === it.key ? "page" : undefined}
          title={collapsed ? it.label : undefined}
          onclick={() => onSelect(it.key)}
        >
          <span class="bar" aria-hidden="true"></span>
          <svg
            viewBox="0 0 24 24"
            class="icon"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            {@html it.icon}
          </svg>
          {#if !collapsed}<span class="label">{it.label}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>

  <div class="foot">
    {#if onDevStep}
      <button class="dev" onclick={onDevStep} title="+300 m (dev)">
        {collapsed ? "+300" : "+300 m (dev)"}
      </button>
    {/if}
    {#if !collapsed}<span class="ver">v{version}</span>{/if}
  </div>
</nav>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    width: 172px;
    flex: none;
    background: var(--color-panel);
    border-right: 1px solid var(--color-border);
    padding: 0.5rem 0;
    user-select: none;
  }
  .rail.collapsed {
    width: 56px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.75rem 0.7rem;
    color: var(--amber);
  }
  .rail.collapsed .brand {
    justify-content: center;
    padding-inline: 0;
  }
  .mark {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .wordmark {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.92rem;
    line-height: 1.1;
    color: var(--ink);
    letter-spacing: 0.01em;
  }

  .items {
    list-style: none;
    margin: 0;
    padding: 0.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    overflow-y: auto;
  }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    height: 38px;
    padding: 0 0.75rem;
    background: none;
    border: 0;
    cursor: pointer;
    color: var(--ink-mid);
    font: inherit;
    font-size: 0.875rem;
    text-align: left;
    transition:
      color var(--dur-micro) var(--ease-out),
      background var(--dur-micro) var(--ease-out);
  }
  .rail.collapsed .item {
    justify-content: center;
    padding: 0;
    gap: 0;
  }
  .item:hover {
    color: var(--ink);
    background: color-mix(in srgb, var(--ink) 6%, transparent);
  }
  .item.active {
    color: var(--amber);
    background: color-mix(in srgb, var(--amber) 10%, transparent);
  }
  .item .bar {
    position: absolute;
    left: 0;
    top: 7px;
    bottom: 7px;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background: var(--amber);
    opacity: 0;
    transition: opacity var(--dur-micro) var(--ease-out);
  }
  .item.active .bar {
    opacity: 1;
  }
  .icon {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item:focus-visible {
    outline: 2px solid var(--biolum);
    outline-offset: -2px;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem 0.25rem;
    border-top: 1px solid var(--color-border);
    margin-top: 0.25rem;
  }
  .rail.collapsed .foot {
    justify-content: center;
    padding-inline: 0;
  }
  .dev {
    cursor: pointer;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-mute);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.15rem 0.4rem;
  }
  .dev:hover {
    color: var(--ink);
  }
  .ver {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--ink-mute);
  }

  @media (prefers-reduced-motion: reduce) {
    .item,
    .item .bar {
      transition: none;
    }
  }
</style>
