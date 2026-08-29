<script lang="ts">
  // Bottom credit bar: minimal upstream attribution + a link to the
  // open-source project this build is based on (opened in the system
  // browser).
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { t } from "$lib/i18n";

  const SOURCE_URL = "https://github.com/toantranct/theisle-overlay";
</script>

<footer
  class="flex shrink-0 items-center justify-between gap-3 border-t px-3 py-1 text-xs"
  style="border-color: var(--color-border); background: var(--color-panel); color: var(--color-muted)"
>
  <span>v{__APP_VERSION__} · {$t("footer.reload_hint")}</span>
  <div class="flex items-center gap-3">
    <span>{$t("footer.based_on")}</span>
    <button
      class="cursor-pointer underline-offset-2 hover:underline"
      onclick={() => void openUrl(SOURCE_URL)}
    >
      {$t("footer.source_link")}
    </button>
  </div>
</footer>
