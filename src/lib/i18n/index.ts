// Locale store + t(). Same crash-proofing rule as the original strings_vi.py:
// a missing key returns the key itself — a typo must never crash the overlay
// mid-game.

import { derived, writable, get } from "svelte/store";
import { vi, type MsgKey } from "./vi";
import { en } from "./en";
import { pt } from "./pt";
// Contributed locales: import a `Partial<Record<MsgKey, string>>` and add it to
// DICTS + LOCALES below. Anything untranslated falls through to English — see
// CONTRIBUTING-i18n.md.

export type Locale = "vi" | "en" | "pt";
export const locale = writable<Locale>("vi");

/** `vi` and `en` are complete (compiler-enforced); contributed locales may be
 *  partial and fall through to English key by key. */
const DICTS: Record<string, Partial<Record<MsgKey, string>>> = { vi, en, pt };

/** Locales offered in the language picker. */
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português (beta)" },
];

function translate(l: Locale, key: MsgKey, params?: Record<string, string | number>): string {
  let text: string = DICTS[l]?.[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Reactive translator: `{$t("layer.water")}` re-renders on locale change. */
export const t = derived(
  locale,
  (l) =>
    (key: MsgKey, params?: Record<string, string | number>): string =>
      translate(l, key, params),
);

/** Non-reactive translation for imperative code. */
export function tNow(key: MsgKey, params?: Record<string, string | number>): string {
  return translate(get(locale), key, params);
}

/** Compass key from Rust ("dir.N" ...) -> localised label. */
export function compassLabel(l: Locale, key: string | null): string {
  if (!key) return "";
  const k = key as MsgKey;
  return DICTS[l]?.[k] ?? en[k] ?? key;
}

/** Human distance: metres below 1 km, else km. Locale-aware separators. */
export function formatDistance(l: Locale, metres: number): string {
  const numberLocale = l === "vi" ? "vi-VN" : "en-US";
  if (metres < 1000) {
    return `${Math.round(metres).toLocaleString(numberLocale)} m`;
  }
  return `${(metres / 1000).toLocaleString(numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km`;
}
