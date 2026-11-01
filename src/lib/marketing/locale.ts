import { cookies, headers } from 'next/headers';
import { DICTS, type SiteLocale } from './dict';

export const LANG_COOKIE = 'memo-site-lang';

/** Cookie set by the language switch wins; otherwise Accept-Language picks uk or falls back to en. */
export function getSiteLocale(): SiteLocale {
  const saved = cookies().get(LANG_COOKIE)?.value;
  if (saved === 'en' || saved === 'uk') return saved;
  const accept = headers().get('accept-language') ?? '';
  return /^\s*uk\b/i.test(accept) ? 'uk' : 'en';
}

export function getDict() {
  const locale = getSiteLocale();
  return { locale, t: DICTS[locale] };
}
