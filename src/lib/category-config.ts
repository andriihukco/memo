import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared rules for user categories. Web and the API use these; the native app
 * mirrors CATEGORY_SWATCHES in mobile/src/lib/category-meta.ts, so keep them in sync.
 */

export const CATEGORY_SWATCHES = [
  "#FF453A", "#FF9F0A", "#FFD60A", "#30D158", "#66D4CF", "#40C8E0",
  "#0A84FF", "#5E5CE6", "#BF5AF2", "#FF375F", "#AC8E68", "#8E8E93",
] as const;

export const CATEGORY_NAME_MAX = 40;

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Stable swatch for a slug, so a category without a stored colour still gets one. */
export function swatchFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_SWATCHES[h % CATEGORY_SWATCHES.length];
}

/**
 * Storage slug from a display name: ascii snake_case, starts with a letter.
 * Names without latin letters (e.g. Ukrainian only) get a random slug; the
 * display name lives in label_ua, so the slug never has to be readable.
 */
export function slugFromLabel(label: string): string {
  const ascii = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!ascii) return `cat_${Math.random().toString(36).slice(2, 8)}`;
  if (ascii === "uncategorized") return "c_uncategorized"; // reserved for entries without a category
  return /^[a-z]/.test(ascii) ? ascii : `c_${ascii}`;
}

export interface KnownCategory {
  name: string;
  label_ua: string;
}

/** The user's categories, for the classifier to prefer over inventing new ones. */
export async function loadUserCategories(
  supabase: SupabaseClient,
  userId: string,
  limit = 100,
): Promise<KnownCategory[]> {
  try {
    const { data } = await supabase
      .from("categories")
      .select("name, label_ua")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);
    return (data ?? []) as KnownCategory[];
  } catch {
    // Classification still works without the list; the model just cannot prefer existing names.
    return [];
  }
}
