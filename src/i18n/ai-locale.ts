import type { Locale } from './locales';

/**
 * Returns a per-locale instruction string telling the AI to respond in the user's language.
 * Falls back to the Ukrainian instruction for unknown locales.
 */
export function aiLanguageInstruction(locale: Locale): string {
  const instructions: Record<Locale, string> = {
    en: 'Respond in English.',
    zh: '请用简体中文回复。',
    es: 'Responde en español.',
    hi: 'हिन्दी में जवाब दें।',
    ar: 'أجب باللغة العربية.',
    de: 'Antworte auf Deutsch.',
    fr: 'Réponds en français.',
    pt: 'Responda em português.',
    it: 'Rispondi in italiano.',
    pl: 'Odpowiadaj po polsku.',
    uk: 'Відповідай українською.',
  };
  return instructions[locale] ?? instructions.uk;
}
