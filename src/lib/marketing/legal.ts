import type { SiteLocale } from './dict';

/**
 * Privacy and terms copy. DRAFT: written from what the code does, not reviewed by a lawyer.
 * {{double braces}} mark facts only the owner can supply. Processors match package.json and vercel.json.
 */

type Section = { h: string; p: readonly string[] };
type LegalDoc = { title: string; draft: string; updated: string; sections: readonly Section[] };

const UPDATED = '2026-11-01';

export const PRIVACY: Record<SiteLocale, LegalDoc> = {
  en: {
    title: 'Privacy policy',
    draft: 'Draft pending legal review.',
    updated: UPDATED,
    sections: [
      { h: 'Who we are', p: ['Memo is run by {{company name}}, {{address}}. Contact: {{privacy email}}.'] },
      { h: 'What we collect', p: ['Entries you write or speak, the metrics derived from them, your categories, goals, widgets and reports.', 'Account data: your Telegram ID, email or Google account, or an anonymous session ID.', 'Technical data: error reports and product analytics.'] },
      { h: 'How we protect entries', p: ['Entry text is encrypted at rest with AES 256 GCM on our server. Memo is not end to end encrypted.'] },
      { h: 'Who processes your data', p: ['Supabase (database and sign in), Google Gemini (sorting, metrics, transcription, search embeddings), Vercel (hosting), Upstash (rate limits), Sentry (error reports), PostHog (product analytics), Telegram (bot and payments).'] },
      { h: 'Your rights', p: ['Export all your data or delete your account in Settings. For anything else, write to {{privacy email}}.'] },
      { h: 'Retention', p: ['We keep your data while your account exists. Deleting the account deletes your entries. {{backup retention period}}.'] },
    ],
  },
  uk: {
    title: 'Політика приватності',
    draft: 'Чернетка, чекає юридичної перевірки.',
    updated: UPDATED,
    sections: [
      { h: 'Хто ми', p: ['Memo належить {{назва компанії}}, {{адреса}}. Звʼязок: {{email щодо приватності}}.'] },
      { h: 'Що ми збираємо', p: ['Записи, які ти пишеш чи надиктовуєш, цифри з них, твої категорії, цілі, віджети й звіти.', 'Дані акаунта: Telegram ID, email чи акаунт Google або анонімна сесія.', 'Технічні дані: звіти про помилки й аналітика продукту.'] },
      { h: 'Як ми захищаємо записи', p: ['Текст записів зберігається зашифрованим за AES 256 GCM на нашому сервері. Наскрізного шифрування в Memo немає.'] },
      { h: 'Хто обробляє дані', p: ['Supabase (база даних і вхід), Google Gemini (розбір, цифри, розшифровка голосу, пошук), Vercel (хостинг), Upstash (ліміти запитів), Sentry (звіти про помилки), PostHog (аналітика), Telegram (бот і оплата).'] },
      { h: 'Твої права', p: ['Експортуй усі дані або видали акаунт у Налаштуваннях. З іншими питаннями пиши на {{email щодо приватності}}.'] },
      { h: 'Зберігання', p: ['Ми зберігаємо дані, поки існує акаунт. Видалення акаунта видаляє записи. {{строк зберігання резервних копій}}.'] },
    ],
  },
};

export const TERMS: Record<SiteLocale, LegalDoc> = {
  en: {
    title: 'Terms of use',
    draft: 'Draft pending legal review.',
    updated: UPDATED,
    sections: [
      { h: 'The service', p: ['Memo is a personal diary that sorts your entries and shows patterns. It is offered by {{company name}}.'] },
      { h: 'Not medical or financial advice', p: ['Memo describes what your entries show. It does not diagnose, treat or advise. Talk to a professional for health or money decisions.'] },
      { h: 'Your content', p: ['You own what you write. You let us store and process it only to run Memo for you.'] },
      { h: 'Plans and payment', p: ['During early access every feature is free. Paid plans, when they start, will be billed as described on the pricing page. {{refund terms}}.'] },
      { h: 'Fair use', p: ['Daily limits on entries and voice length protect the service from abuse.'] },
      { h: 'Contact', p: ['{{support email}}'] },
    ],
  },
  uk: {
    title: 'Умови використання',
    draft: 'Чернетка, чекає юридичної перевірки.',
    updated: UPDATED,
    sections: [
      { h: 'Сервіс', p: ['Memo це особистий щоденник, який розкладає записи й показує закономірності. Його надає {{назва компанії}}.'] },
      { h: 'Не медична й не фінансова порада', p: ['Memo описує, що показують твої записи. Він не ставить діагнозів і не радить. Щодо здоровʼя й грошей радься з фахівцем.'] },
      { h: 'Твій контент', p: ['Те, що ти пишеш, належить тобі. Ти дозволяєш нам зберігати й обробляти це лише для роботи Memo.'] },
      { h: 'Плани й оплата', p: ['На ранньому доступі всі функції безкоштовні. Платні плани, коли зʼявляться, оплачуватимуться так, як описано на сторінці цін. {{умови повернення коштів}}.'] },
      { h: 'Чесне використання', p: ['Денні ліміти на записи й довжину голосових захищають сервіс від зловживань.'] },
      { h: 'Контакти', p: ['{{email підтримки}}'] },
    ],
  },
};
