import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip ALL Telegram Markdown special characters from AI-generated text
 * so it renders as plain text — avoids all "can't parse entities" 400 errors.
 * Handles both matched pairs AND lone/unmatched characters.
 */
export function sanitizeMarkdown(text: string): string {
  return text
    // Strip code blocks first (preserve content)
    .replace(/`{3}[\s\S]*?`{3}/g, (m) =>
      m.replace(/`{3}(?:\w+)?\n?/g, "").replace(/`{3}/g, ""))
    // Strip inline code (preserve content)
    .replace(/`([^`]+)`/g, "$1")
    // Strip markdown links (preserve label)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove ALL *, _, ` characters (matched or unmatched — these cause parse errors)
    .replace(/[*_`]/g, "");
}
