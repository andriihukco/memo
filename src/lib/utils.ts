import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize AI-generated text for Telegram's legacy Markdown parser.
 * Closes any unclosed * or _ pairs so Telegram doesn't reject the message.
 */
export function sanitizeMarkdown(text: string): string {
  // Count unescaped * and _ occurrences; if odd, append closing char
  const countUnescaped = (str: string, char: string) => {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\" ) { i++; continue; } // skip escaped
      if (str[i] === char) count++;
    }
    return count;
  };

  let result = text;
  if (countUnescaped(result, "*") % 2 !== 0) result += "*";
  if (countUnescaped(result, "_") % 2 !== 0) result += "_";
  return result;
}
