/**
 * AI (Gemini) is off until it is connected on purpose: set MEMO_AI_ENABLED=true and GEMINI_API_KEY.
 * While it is off, metric extraction and retros use plain logic (see src/lib/goals.ts).
 * Having a key in .env is not enough, so an existing key does not turn AI on by itself.
 */
export function aiEnabled(): boolean {
  return process.env.MEMO_AI_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}
