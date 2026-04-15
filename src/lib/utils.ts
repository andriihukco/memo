import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip Telegram Markdown formatting from AI-generated text so it renders
 * as plain text — avoids all "can't parse entities" 400 errors.
 */
export function sanitizeMarkdown(text: string): string {
  return text
    .replace(/\*\*?(.*?)\*\*?/gs, "$1")        // *bold* / **bold**
    .replace(/__(.*?)__/gs, "$1")               // __bold__
    .replace(/_(.*?)_/gs, "$1")                 // _italic_
    .replace(/`{3}[\s\S]*?`{3}/g, (m) =>        // ```code block``` → keep content
      m.replace(/`{3}(?:\w+)?\n?/g, "").replace(/`{3}/g, ""))
    .replace(/`([^`]+)`/g, "$1")               // `inline code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");  // [text](url) → text
}
