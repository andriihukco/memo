/**
 * Copy for the public marketing site (landing, pricing, blog index, legal chrome).
 * Server rendered, so it lives here and not in the client catalogs under src/i18n.
 * `uk` is typed as `Dict`, so a missing key fails the type check.
 *
 * Every claim must trace to code: plans and limits to src/lib/billing/plans.ts, encryption to
 * src/lib/crypto.ts, metric examples to docs/04-ai-pipeline.md. See docs/marketing/landing-plan.md.
 */

export const PERSONAS = ['fitness', 'reflect', 'money', 'sleep', 'goals', 'privacy', 'telegram'] as const;
export type PersonaSlug = (typeof PERSONAS)[number];

/** Special href for a lead magnet that opens the Telegram bot. */
export const TELEGRAM_HREF = 'telegram:bot';

type Pair = readonly [title: string, body: string];

export type PersonaCopy = {
  chip: string;
  /** Hero heading, one item per line, broken where the thought breaks. */
  h1: readonly string[];
  sub: string;
  demoInput: string;
  demoOut: readonly Pair[];
  benefits: readonly Pair[];
  magnet: { title: string; body: string; cta: string; href: string };
};

export type Dict = {
  meta: { title: string; description: string };
  nav: {
    home: string; product: string; pricing: string; blog: string; signIn: string; startFree: string;
    menu: string; close: string; skip: string; theme: string; light: string; dark: string; language: string; soundOn: string; soundOff: string;
  };
  hero: {
    h1: readonly string[]; sub: string;
    pickLabel: string; cta: string; telegramCta: string; proofOpen: string; proofPaid: string;
    you: string; memo: string; parsed: string;
  };
  band: { eyebrow: string; magnet: string };
  personas: Record<PersonaSlug, PersonaCopy>;
  tagline: readonly string[];
  try: {
    eyebrow: string; title: string; sub: string;
    checklist: { title: string; progress: string; items: readonly string[] };
    sleep: { title: string; hours: string; goal: string; label: string };
    week: { title: string; days: readonly string[]; stepsLabel: string; moodLabel: string };
    steps: { title: string; caption: string };
    reminders: { title: string; items: readonly (readonly [string, string])[] };
    topics: { title: string; exampleLabel: string; note: string; groups: readonly { name: string; topics: readonly string[]; examples: readonly string[] }[] };
    reflection: { title: string; summary: string; rows: readonly (readonly [string, string])[] };
  };
  how: { eyebrow: string; title: string; steps: readonly Pair[] };
  benefits: { eyebrow: string; title: string; items: readonly Pair[] };
  privacy: { eyebrow: string; title: string; sub: string; items: readonly string[]; link: string };
  teaser: { eyebrow: string; titleOpen: string; titlePaid: string; sub: string; cta: string };
  faq: { eyebrow: string; title: string; items: readonly Pair[] };
  final: { title: string; anon: string; anonBusy: string; anonError: string; anonOff: string };
  footer: { tagline: string; product: string; legal: string; privacy: string; terms: string; note: string };
  pricing: {
    title: string; sub: string; early: string; monthly: string; quarterly: string; annual: string;
    perMonth: string; billed: string; free: string; current: string; cta: string;
    plans: Record<'free' | 'stars_basic' | 'stars_pro', string>;
    rows: {
      entries: string; aiWidgets: string; reports: string; historyDays: string; historyYear: string;
      historyAll: string; voice: string; unlimited: string; aiRetro: string; aiRecs: string; goals: string;
      graph: string; priority: string; encryption: string; pin: string;
    };
    faq: readonly Pair[];
  };
  blog: { title: string; sub: string; read: string; back: string; minutes: string; onlyEn: string };
  notFound: { title: string; body: string; cta: string };
};

const en: Dict = {
  meta: {
    title: 'Memo: a diary that keeps the numbers',
    description:
      'Write or speak one line about your day. Memo sorts it, pulls out the numbers and builds charts, goals and a weekly retro. Works in Telegram and on the web.',
  },
  nav: {
    home: 'Memo home', product: 'How it works', pricing: 'Pricing', blog: 'Blog', signIn: 'Sign in',
    startFree: 'Start free', menu: 'Open menu', close: 'Close menu', skip: 'Skip to content',
    theme: 'Switch theme', light: 'Day', dark: 'Night', language: 'Language', soundOn: 'Turn sound on', soundOff: 'Turn sound off',
  },
  hero: {
    h1: ['One line about your day.', 'Charts, goals and a weekly retro.'],
    sub: 'Write or speak in Telegram or on the web. Memo sorts each entry, pulls out the numbers and shows how your week went.',
    pickLabel: 'I want to keep track of',
    cta: 'Start free',
    telegramCta: 'Open in Telegram',
    proofOpen: 'Free during early access. No card, no app to install.',
    proofPaid: 'Free plan for good. Paid plans in Telegram Stars.',
    you: 'You',
    memo: 'Memo',
    parsed: 'Saved and counted',
  },
  band: { eyebrow: 'Made for this', magnet: 'Free to try' },
  personas: {
    fitness: {
      chip: 'Training and food',
      h1: ['Log a workout', 'in one message.'],
      sub: 'Type “ran 5 km” or “200 g chicken”. Memo works out distance, calories and protein, then sets your week against your own past weeks.',
      demoInput: 'ran 5 km this morning, then 200 g chicken for lunch',
      demoOut: [['Distance', '5 km'], ['Burned', '≈ 400 kcal'], ['Steps', '≈ 6,000'], ['Protein', '≈ 62 g']],
      benefits: [
        ['Food and training in one place', 'No second app for meals. Both land in the same week.'],
        ['Numbers you can check', 'Every total shows the entries it came from.'],
        ['Compared with you', 'This week is measured against your past weeks, not other people.'],
      ],
      magnet: { title: 'Your first weekly numbers', body: 'Log for seven days and Memo builds a weekly retro from your own entries.', cta: 'Start free', href: '/login' },
    },
    reflect: {
      chip: 'Thoughts and work',
      h1: ['Your week,', 'written back to you.'],
      sub: 'Talk or type the way you would to a friend. Memo turns your notes into a weekly retro: what went well, what did not, and one experiment to try.',
      demoInput: 'shipped the pricing page, but the review ran late again',
      demoOut: [['Category', 'Work'], ['Went well', 'Pricing page shipped'], ['To watch', 'Late reviews'], ['In retro', 'Friday']],
      benefits: [
        ['Voice notes count', 'Speak for a minute on the way home. Memo transcribes and files it.'],
        ['A retro, not a summary', 'Went well, did not, start stop continue, one experiment, one lesson.'],
        ['Ask your diary', '“When did I last feel this tired?” Answers come from your own entries.'],
      ],
      magnet: { title: 'See a sample retro', body: 'A full weekly retro, built from a week of sample entries.', cta: 'Read the sample', href: '/blog/what-a-weekly-retro-looks-like' },
    },
    money: {
      chip: 'Spending',
      h1: ['Type what you spent.', 'Memo adds it up.'],
      sub: '“150 UAH groceries” is enough. Memo files it under a category and totals your week and month. No bank login, no spreadsheet.',
      demoInput: '150 UAH groceries, 90 UAH coffee',
      demoOut: [['Groceries', '150 UAH'], ['Coffee', '90 UAH'], ['Today', '240 UAH'], ['Category', 'Food']],
      benefits: [
        ['No bank access', 'You type the amount. Memo never connects to your bank.'],
        ['Any currency', 'Amounts keep their currency, so trips do not break the totals.'],
        ['Next to the rest of your life', 'See spending beside sleep, mood and training in one week.'],
      ],
      magnet: { title: 'How one message becomes numbers', body: 'What Memo pulls out of a line like “150 UAH groceries”, step by step.', cta: 'Read how it works', href: '/blog/one-message-many-numbers' },
    },
    sleep: {
      chip: 'Sleep and mood',
      h1: ['See what your', 'nights say.'],
      sub: 'Log sleep and mood in a line each. Memo puts them on one chart, so you can see how a short night shows up the next day.',
      demoInput: 'slept 6 h, woke up twice. mood 6/10',
      demoOut: [['Sleep', '6 h'], ['Mood', '6 / 10'], ['Week average', '6 h 50 min'], ['Reminder', '10:30 pm']],
      benefits: [
        ['Compared with you', 'Your nights against your past nights. No scores against strangers.'],
        ['A nudge at your hour', 'Pick when Memo asks how you slept.'],
        ['Patterns, not diagnoses', 'Memo describes what your numbers show. It is not medical advice.'],
      ],
      magnet: { title: 'A two week sleep and mood check', body: 'Set an evening reminder, write one line a night, then read your two week retro.', cta: 'Start the check', href: '/login' },
    },
    goals: {
      chip: 'Goals and habits',
      h1: ['Goals that move', 'with what you log.'],
      sub: 'Set a goal like 8,000 steps or seven hours of sleep. The entries you already write move the progress bar, and a reminder checks in at the hour you pick.',
      demoInput: 'walked to work and back',
      demoOut: [['Steps', '≈ 6,000'], ['Goal', '8,000 steps'], ['Progress', '75%'], ['Streak', '4 days']],
      benefits: [
        ['No extra logging', 'Goals read the entries you already write.'],
        ['Check ins you choose', 'One reminder, at the time that suits you.'],
        ['Honest weekly review', 'The retro says what moved and what did not.'],
      ],
      magnet: { title: 'Set your first goal', body: 'Pick one number for this week. Memo tracks it from your entries.', cta: 'Set a goal', href: '/login' },
    },
    privacy: {
      chip: 'A private diary',
      h1: ['A diary you', 'can take with you.'],
      sub: 'Entries are encrypted on our servers with AES 256. Export everything or delete your account in Settings at any time. You can start without an account.',
      demoInput: 'felt anxious before the call, better after a walk',
      demoOut: [['Stored', 'Encrypted at rest'], ['Export', 'Any time'], ['Delete', 'In Settings'], ['Account', 'Optional']],
      benefits: [
        ['Encrypted at rest', 'AES 256 GCM, with a key derived for your account.'],
        ['Yours to take', 'Download all your data, or delete it, from Settings.'],
        ['Said plainly', 'Encryption runs on our server. It is not end to end yet.'],
      ],
      magnet: { title: 'How Memo stores your diary', body: 'What is stored, how it is encrypted, and who processes it.', cta: 'Read the details', href: '/blog/how-memo-stores-your-diary' },
    },
    telegram: {
      chip: 'Telegram',
      h1: ['Your diary,', 'inside Telegram.'],
      sub: 'Send a message or a voice note to the Memo bot. It replies in your language, and the mini app shows your charts without leaving the chat.',
      demoInput: 'voice note: ran 5 km, mood 8 out of 10',
      demoOut: [['Distance', '5 km'], ['Mood', '8 / 10'], ['Reply', 'Third run this week'], ['Charts', 'In the mini app']],
      benefits: [
        ['No new app', 'Memo lives in the chat app you already open every day.'],
        ['Voice in any language', 'Speak Ukrainian, English or a mix. Memo understands.'],
        ['No card needed', 'Paid plans, when they start, use Telegram Stars.'],
      ],
      magnet: { title: 'Open Memo in Telegram', body: 'Send your first line to the bot. It takes ten seconds.', cta: 'Open the bot', href: TELEGRAM_HREF },
    },
  },
  tagline: ['Write it the way you would tell a friend.', 'Memo keeps the numbers.'],
  try: {
    eyebrow: 'Try it',
    title: 'Touch the sample. Nothing is saved.',
    sub: 'These are working demos with sample numbers. Tick a task, drag the sleep ring, pick a day.',
    checklist: { title: 'Today', progress: '{done} of {total} done', items: ['Daily reminder', 'Stretch and water', 'Read 10 pages', 'Checklist'] },
    sleep: { title: 'Hours of sleep', hours: '{h} h {m} min', goal: 'of 8 h goal', label: 'Drag to log last night' },
    week: { title: 'This week', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], stepsLabel: 'Steps', moodLabel: 'Mood' },
    steps: { title: 'Steps', caption: 'Tap a day to read it' },
    reminders: { title: 'Reminders', items: [['Log your day', '8:45 pm'], ['Set one goal', '9:00 am']] },
    topics: {
      title: 'Explore what Memo counts',
      exampleLabel: 'Example entry and what Memo counts',
      note: 'Sample content for illustration.',
      groups: [
        { name: 'Health', topics: ['Steps and distance', 'Sleep and rest', 'Food and protein'], examples: ['“ran 5 km” gives 5 km and about 400 kcal burned.', '“slept 6 h, woke twice” gives 6 h of sleep.', '“200 g chicken” gives about 330 kcal and 62 g of protein.'] },
        { name: 'Money', topics: ['Daily spending', 'Categories', 'Monthly totals'], examples: ['“150 UAH groceries” gives 150 UAH in Food.', '“90 UAH coffee” adds to the same Food total.', '“spent 240 UAH this week” sums your entries.'] },
        { name: 'Reflection', topics: ['What went well', 'What did not', 'One experiment'], examples: ['“walks on three days” shows under what went well.', '“late screens on weekdays” shows under what did not.', '“lights down at 10 pm” becomes the experiment for next week.'] },
      ],
    },
    reflection: { title: 'Weekly retro (sample)', summary: 'Built from a week of sample entries.', rows: [['Went well', 'Walks on three days.'], ['Did not work', 'Late screens on weekdays.'], ['Try next week', 'Lights down at 10 pm.']] },
  },
  how: {
    eyebrow: 'How it works',
    title: 'Three steps, no forms.',
    steps: [
      ['Write or speak', 'One line or a voice note, in Telegram or on the web. Any language.'],
      ['Memo sorts it', 'It picks the category and pulls out the numbers: kcal, km, hours, money, mood.'],
      ['Read your week', 'Charts, goals and a weekly retro, built from your own entries.'],
    ],
  },
  benefits: {
    eyebrow: 'What you get',
    title: 'More than a list of entries.',
    items: [
      ['Ask your diary', '“How much did I sleep last week?” Memo answers from your entries.'],
      ['Charts you did not build', 'Describe a chart in words and Memo adds the widget.'],
      ['A weekly retro', 'Five parts, from what went well to one experiment for next week.'],
      ['A map of your notes', 'A graph shows which entries connect, so themes stand out.'],
    ],
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Your logs are yours.',
    sub: 'What happens to an entry, in plain words.',
    items: [
      'Entries are encrypted at rest with AES 256 GCM.',
      'Encryption runs on our server. It is not end to end yet.',
      'Text and voice are sent to an AI service to be sorted and counted.',
      'Export all your data or delete your account in Settings.',
      'You can start without an account and add one later.',
    ],
    link: 'Read how Memo stores your diary',
  },
  teaser: {
    eyebrow: 'Pricing',
    titleOpen: 'Free while we are in early access.',
    titlePaid: 'Start free. Upgrade when you need more.',
    sub: 'Every feature is open today. Planned paid plans start at 250 Telegram Stars a month, and the free plan stays.',
    cta: 'See plans',
  },
  faq: {
    eyebrow: 'Questions',
    title: 'Before you start.',
    items: [
      ['Is Memo free?', 'Yes, during early access every feature is open and billing is off. Planned plans are on the pricing page.'],
      ['Do I need Telegram?', 'No. Sign in on the web with email or Google, or start without an account. Telegram is one more way to write.'],
      ['Which languages can I write in?', 'Any. Memo reads text and voice in the language you use. The site is in English and Ukrainian.'],
      ['Who can read my entries?', 'Entries are encrypted at rest on our server. To sort and count them, the text is sent to an AI service, named in the privacy policy. Encryption is not end to end yet.'],
      ['Can I export or delete my data?', 'Yes. Settings has a full export and an account delete.'],
      ['Can I log by voice?', 'Yes. Send a voice note. Memo transcribes it and files it like a typed entry.'],
      ['How does Memo get the numbers?', 'It reads your line and applies fixed rules, for example 5 km of running is about 400 kcal. Each total shows its entries.'],
      ['Is this medical advice?', 'No. Memo describes patterns in your own entries. For health decisions, talk to a professional.'],
    ],
  },
  final: {
    title: 'Start with one line today.',
    anon: 'Start without an account',
    anonBusy: 'Starting…',
    anonError: 'Start without an account is not available right now. Sign in with email or Google instead.',
    anonOff: 'Sign in is not set up on this server.',
  },
  footer: {
    tagline: 'A diary that keeps the numbers.',
    product: 'Product',
    legal: 'Legal',
    privacy: 'Privacy',
    terms: 'Terms',
    note: 'Entries are encrypted at rest on the server. They are not end to end encrypted yet.',
  },
  pricing: {
    title: 'Plans',
    sub: 'Start free and stay free as long as you like. Paid plans add room and AI features.',
    early: 'Early access: billing is off and every feature is open to everyone. The prices below are planned.',
    monthly: 'Monthly', quarterly: '3 months', annual: 'Year',
    perMonth: '/ month',
    billed: '{total} ⭐ every {months} months',
    free: 'Free',
    current: 'Open to everyone now',
    cta: 'Start free',
    plans: { free: 'Start free, for good.', stars_basic: 'The full AI diary.', stars_pro: 'No limits, full history.' },
    rows: {
      entries: '{n} entries', aiWidgets: '{n} AI widgets', reports: '{n} retros', historyDays: '{n} days of feed',
      historyYear: 'One year of feed', historyAll: 'Full history', voice: 'Voice notes up to {n} s', unlimited: 'Unlimited',
      aiRetro: 'AI retros', aiRecs: 'AI suggestions', goals: 'Goal tracking', graph: 'Knowledge graph',
      priority: 'Priority processing', encryption: 'Encrypted entries', pin: 'PIN lock',
    },
    faq: [
      ['What are Telegram Stars?', 'Telegram’s own in app currency. You buy Stars inside Telegram and pay without a card form.'],
      ['Can I pay by card?', 'Not on this site. Paid plans are planned to use Telegram Stars.'],
      ['Is there a free plan?', 'Yes. Spark is free with no end date.'],
    ],
  },
  blog: { title: 'Blog', sub: 'How Memo works, and how to get more from a few lines a day.', read: 'Read', back: 'All posts', minutes: '{n} min read', onlyEn: '' },
  notFound: { title: 'This page is not here.', body: 'The link may be old, or the page moved.', cta: 'Back to Memo' },
};

const uk: Dict = {
  meta: {
    title: 'Memo: щоденник, що рахує за тебе',
    description:
      'Напиши або надиктуй один рядок про свій день. Memo розкладе його, порахує цифри та збере графіки, цілі й тижневу ретроспективу. У Telegram і в браузері.',
  },
  nav: {
    home: 'Memo, головна', product: 'Як це працює', pricing: 'Ціни', blog: 'Блог', signIn: 'Увійти',
    startFree: 'Почати безкоштовно', menu: 'Відкрити меню', close: 'Закрити меню', skip: 'До змісту',
    theme: 'Змінити тему', light: 'День', dark: 'Ніч', language: 'Мова', soundOn: 'Увімкнути звук', soundOff: 'Вимкнути звук',
  },
  hero: {
    h1: ['Один рядок про твій день.', 'Графіки, цілі й тижневе ретро.'],
    sub: 'Пиши чи говори в Telegram або в браузері. Memo розкладе кожен запис, дістане цифри й покаже, як минув тиждень.',
    pickLabel: 'Я хочу стежити за',
    cta: 'Почати безкоштовно',
    telegramCta: 'Відкрити в Telegram',
    proofOpen: 'Безкоштовно на ранньому доступі. Без картки й без встановлення.',
    proofPaid: 'Безкоштовний план назавжди. Платні плани за Telegram Stars.',
    you: 'Ти',
    memo: 'Memo',
    parsed: 'Збережено й пораховано',
  },
  band: { eyebrow: 'Саме для цього', magnet: 'Спробуй безкоштовно' },
  personas: {
    fitness: {
      chip: 'Тренування й їжа',
      h1: ['Тренування', 'одним повідомленням.'],
      sub: 'Напиши «пробіг 5 км» або «200 г курки». Memo порахує дистанцію, калорії й білок і порівняє тиждень з твоїми минулими тижнями.',
      demoInput: 'зранку пробіг 5 км, на обід 200 г курки',
      demoOut: [['Дистанція', '5 км'], ['Спалено', '≈ 400 ккал'], ['Кроки', '≈ 6 000'], ['Білок', '≈ 62 г']],
      benefits: [
        ['Їжа й тренування разом', 'Без окремого застосунку для їжі. Усе в одному тижні.'],
        ['Цифри, які можна перевірити', 'Кожен підсумок показує записи, з яких він складений.'],
        ['Порівняння з собою', 'Цей тиждень порівнюється з твоїми минулими, а не з іншими людьми.'],
      ],
      magnet: { title: 'Твої перші тижневі цифри', body: 'Пиши сім днів, і Memo збере тижневу ретроспективу з твоїх записів.', cta: 'Почати безкоштовно', href: '/login' },
    },
    reflect: {
      chip: 'Думки й робота',
      h1: ['Твій тиждень,', 'записаний для тебе.'],
      sub: 'Говори чи пиши як другові. Memo перетворить нотатки на тижневу ретроспективу: що вдалося, що ні, і один експеримент на наступний тиждень.',
      demoInput: 'запустили сторінку цін, але рев’ю знову затягнулось',
      demoOut: [['Категорія', 'Робота'], ['Вдалося', 'Сторінка цін'], ['Звернути увагу', 'Довгі рев’ю'], ['У ретро', 'Пʼятниця']],
      benefits: [
        ['Голосові теж рахуються', 'Надиктуй хвилину дорогою додому. Memo розшифрує й збереже.'],
        ['Ретро, а не переказ', 'Що вдалося, що ні, почати чи кинути, один експеримент, один урок.'],
        ['Запитай свій щоденник', '«Коли я востаннє так втомився?» Відповідь з твоїх записів.'],
      ],
      magnet: { title: 'Приклад ретроспективи', body: 'Повна тижнева ретроспектива з тижня прикладових записів.', cta: 'Подивитися приклад', href: '/blog/what-a-weekly-retro-looks-like' },
    },
    money: {
      chip: 'Витрати',
      h1: ['Напиши, що витратив.', 'Memo порахує.'],
      sub: '«150 грн продукти» достатньо. Memo віднесе витрату до категорії й підсумує тиждень і місяць. Без доступу до банку й таблиць.',
      demoInput: '150 грн продукти, 90 грн кава',
      demoOut: [['Продукти', '150 грн'], ['Кава', '90 грн'], ['Сьогодні', '240 грн'], ['Категорія', 'Їжа']],
      benefits: [
        ['Без доступу до банку', 'Суму вводиш ти. Memo не підключається до банку.'],
        ['Різні валюти', 'Суми зберігають свою валюту, тож поїздки не ламають підсумки.'],
        ['Поруч з рештою життя', 'Витрати поруч зі сном, настроєм і тренуваннями.'],
      ],
      magnet: { title: 'Як одне повідомлення стає цифрами', body: 'Що Memo дістає з рядка «150 грн продукти», крок за кроком.', cta: 'Як це працює', href: '/blog/one-message-many-numbers' },
    },
    sleep: {
      chip: 'Сон і настрій',
      h1: ['Подивись, що кажуть', 'твої ночі.'],
      sub: 'Запиши сон і настрій одним рядком. Memo покаже їх на одному графіку, і буде видно, як коротка ніч відбивається на наступному дні.',
      demoInput: 'спав 6 год, прокидався двічі. настрій 6/10',
      demoOut: [['Сон', '6 год'], ['Настрій', '6 / 10'], ['Середнє за тиждень', '6 год 50 хв'], ['Нагадування', '22:30']],
      benefits: [
        ['Порівняння з собою', 'Твої ночі проти твоїх минулих ночей. Без рейтингів.'],
        ['Нагадування у твій час', 'Обери, коли Memo спитає, як ти спав.'],
        ['Закономірності, не діагнози', 'Memo описує твої цифри. Це не медична порада.'],
      ],
      magnet: { title: 'Двотижнева перевірка сну й настрою', body: 'Постав вечірнє нагадування, пиши рядок щоночі й прочитай ретро за два тижні.', cta: 'Почати перевірку', href: '/login' },
    },
    goals: {
      chip: 'Цілі й звички',
      h1: ['Цілі, що рухаються', 'від твоїх записів.'],
      sub: 'Постав ціль, наприклад 8 000 кроків чи сім годин сну. Записи, які ти вже робиш, рухають прогрес, а нагадування приходить у твій час.',
      demoInput: 'пішки на роботу й назад',
      demoOut: [['Кроки', '≈ 6 000'], ['Ціль', '8 000 кроків'], ['Прогрес', '75%'], ['Серія', '4 дні']],
      benefits: [
        ['Без зайвих записів', 'Цілі читають записи, які ти вже робиш.'],
        ['Нагадування на твій вибір', 'Одне нагадування, у зручний час.'],
        ['Чесний тижневий огляд', 'Ретро каже, що зрушило, а що ні.'],
      ],
      magnet: { title: 'Постав першу ціль', body: 'Обери одне число на цей тиждень. Memo відстежить його з записів.', cta: 'Поставити ціль', href: '/login' },
    },
    privacy: {
      chip: 'Приватний щоденник',
      h1: ['Щоденник, який', 'можна забрати з собою.'],
      sub: 'Записи шифруються на наших серверах за AES 256. Експортуй усе або видали акаунт у Налаштуваннях коли завгодно. Можна почати без акаунта.',
      demoInput: 'хвилювався перед дзвінком, після прогулянки краще',
      demoOut: [['Зберігання', 'Зашифровано'], ['Експорт', 'Коли завгодно'], ['Видалення', 'У Налаштуваннях'], ['Акаунт', 'Необовʼязковий']],
      benefits: [
        ['Шифрування на сервері', 'AES 256 GCM з ключем, виведеним для твого акаунта.'],
        ['Твоє, щоб забрати', 'Завантаж або видали всі дані в Налаштуваннях.'],
        ['Чесно', 'Шифрування працює на нашому сервері. Наскрізного шифрування поки немає.'],
      ],
      magnet: { title: 'Як Memo зберігає щоденник', body: 'Що зберігається, як шифрується і хто це обробляє.', cta: 'Читати деталі', href: '/blog/how-memo-stores-your-diary' },
    },
    telegram: {
      chip: 'Telegram',
      h1: ['Щоденник', 'прямо в Telegram.'],
      sub: 'Надішли повідомлення чи голосове боту Memo. Він відповість твоєю мовою, а застосунок у Telegram покаже графіки, не виходячи з чату.',
      demoInput: 'голосове: пробіг 5 км, настрій 8 з 10',
      demoOut: [['Дистанція', '5 км'], ['Настрій', '8 / 10'], ['Відповідь', 'Третя пробіжка за тиждень'], ['Графіки', 'У застосунку']],
      benefits: [
        ['Без нового застосунку', 'Memo живе в месенджері, який ти й так відкриваєш щодня.'],
        ['Голос якою завгодно мовою', 'Українською, англійською чи впереміш. Memo зрозуміє.'],
        ['Без картки', 'Платні плани, коли зʼявляться, будуть за Telegram Stars.'],
      ],
      magnet: { title: 'Відкрий Memo в Telegram', body: 'Надішли боту перший рядок. Це десять секунд.', cta: 'Відкрити бота', href: TELEGRAM_HREF },
    },
  },
  tagline: ['Пиши так, як розповів би другові.', 'Цифри Memo збереже сам.'],
  try: {
    eyebrow: 'Спробуй',
    title: 'Торкнись прикладу. Нічого не зберігається.',
    sub: 'Це робочі демо з прикладними цифрами. Познач завдання, посувай кільце сну, обери день.',
    checklist: { title: 'Сьогодні', progress: 'Зроблено {done} з {total}', items: ['Щоденне нагадування', 'Розтяжка і вода', 'Прочитати 10 сторінок', 'Чек-лист'] },
    sleep: { title: 'Годин сну', hours: '{h} год {m} хв', goal: 'з цілі 8 год', label: 'Посунь, щоб записати минулу ніч' },
    week: { title: 'Цей тиждень', days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'], stepsLabel: 'Кроки', moodLabel: 'Настрій' },
    steps: { title: 'Кроки', caption: 'Натисни день, щоб побачити' },
    reminders: { title: 'Нагадування', items: [['Записати день', '20:45'], ['Поставити ціль', '9:00']] },
    topics: {
      title: 'Що рахує Memo',
      exampleLabel: 'Приклад запису і що рахує Memo',
      note: 'Прикладний вміст для ілюстрації.',
      groups: [
        { name: 'Здоровʼя', topics: ['Кроки й дистанція', 'Сон і відпочинок', 'Їжа й білок'], examples: ['«пробіг 5 км» дає 5 км і близько 400 ккал.', '«спав 6 год, прокидався двічі» дає 6 год сну.', '«200 г курки» дає близько 330 ккал і 62 г білка.'] },
        { name: 'Гроші', topics: ['Щоденні витрати', 'Категорії', 'Підсумки за місяць'], examples: ['«150 грн продукти» дає 150 грн у категорії Їжа.', '«90 грн кава» додається до тієї ж суми.', '«витратив 240 грн цього тижня» сумує твої записи.'] },
        { name: 'Рефлексія', topics: ['Що вдалося', 'Що ні', 'Один експеримент'], examples: ['«гуляв три дні» іде в те, що вдалося.', '«екрани ввечері в будні» іде в те, що ні.', '«світло о 22:00» стає експериментом на наступний тиждень.'] },
      ],
    },
    reflection: { title: 'Тижнева ретро (приклад)', summary: 'Складено з прикладних записів за тиждень.', rows: [['Вдалося', 'Прогулянки три дні.'], ['Не спрацювало', 'Екрани ввечері в будні.'], ['Спробувати далі', 'Світло вимикати о 22:00.']] },
  },
  how: {
    eyebrow: 'Як це працює',
    title: 'Три кроки, жодних форм.',
    steps: [
      ['Напиши або скажи', 'Один рядок чи голосове, у Telegram або в браузері. Якою завгодно мовою.'],
      ['Memo розкладе', 'Обере категорію й дістане цифри: ккал, км, години, гроші, настрій.'],
      ['Прочитай свій тиждень', 'Графіки, цілі й тижнева ретроспектива з твоїх записів.'],
    ],
  },
  benefits: {
    eyebrow: 'Що ти отримуєш',
    title: 'Більше, ніж список записів.',
    items: [
      ['Запитай щоденник', '«Скільки я спав минулого тижня?» Memo відповість з твоїх записів.'],
      ['Графіки без налаштувань', 'Опиши графік словами, і Memo додасть віджет.'],
      ['Тижнева ретроспектива', 'Пʼять частин, від того, що вдалося, до одного експерименту.'],
      ['Мапа нотаток', 'Граф показує, які записи повʼязані, і теми стають видимими.'],
    ],
  },
  privacy: {
    eyebrow: 'Приватність',
    title: 'Твої записи належать тобі.',
    sub: 'Що відбувається із записом, простими словами.',
    items: [
      'Записи зберігаються зашифрованими за AES 256 GCM.',
      'Шифрування працює на нашому сервері. Наскрізного шифрування поки немає.',
      'Текст і голос надсилаються в AI сервіс, щоб розкласти й порахувати.',
      'Експортуй усі дані або видали акаунт у Налаштуваннях.',
      'Можна почати без акаунта й додати його пізніше.',
    ],
    link: 'Як Memo зберігає щоденник',
  },
  teaser: {
    eyebrow: 'Ціни',
    titleOpen: 'Безкоштовно, поки триває ранній доступ.',
    titlePaid: 'Починай безкоштовно. Оновлюй, коли треба більше.',
    sub: 'Сьогодні відкриті всі функції. Заплановані платні плани від 250 Telegram Stars на місяць, а безкоштовний план залишиться.',
    cta: 'Переглянути плани',
  },
  faq: {
    eyebrow: 'Питання',
    title: 'Перш ніж почати.',
    items: [
      ['Memo безкоштовний?', 'Так, на ранньому доступі всі функції відкриті, оплата вимкнена. Заплановані плани є на сторінці цін.'],
      ['Чи потрібен Telegram?', 'Ні. Увійди в браузері через email чи Google або почни без акаунта. Telegram лише ще один спосіб писати.'],
      ['Якими мовами можна писати?', 'Якими завгодно. Memo читає текст і голос мовою, якою ти пишеш. Сайт українською та англійською.'],
      ['Хто може читати мої записи?', 'Записи зберігаються зашифрованими на нашому сервері. Щоб розкласти й порахувати, текст надсилається в AI сервіс, названий у політиці приватності. Наскрізного шифрування поки немає.'],
      ['Чи можна експортувати або видалити дані?', 'Так. У Налаштуваннях є повний експорт і видалення акаунта.'],
      ['Чи можна писати голосом?', 'Так. Надішли голосове. Memo розшифрує його й збереже як звичайний запис.'],
      ['Звідки Memo бере цифри?', 'Читає рядок і застосовує сталі правила, наприклад 5 км бігу це близько 400 ккал. Кожен підсумок показує свої записи.'],
      ['Це медична порада?', 'Ні. Memo описує закономірності у твоїх записах. Щодо здоровʼя радься з фахівцем.'],
    ],
  },
  final: {
    title: 'Почни з одного рядка сьогодні.',
    anon: 'Почати без акаунта',
    anonBusy: 'Запускаємо…',
    anonError: 'Почати без акаунта зараз не вийде. Увійди через email чи Google.',
    anonOff: 'Вхід на цьому сервері не налаштований.',
  },
  footer: {
    tagline: 'Щоденник, що рахує за тебе.',
    product: 'Продукт',
    legal: 'Правове',
    privacy: 'Приватність',
    terms: 'Умови',
    note: 'Записи зберігаються зашифрованими на сервері. Наскрізного шифрування поки немає.',
  },
  pricing: {
    title: 'Плани',
    sub: 'Починай безкоштовно й лишайся на безкоштовному скільки хочеш. Платні плани додають місця й AI функцій.',
    early: 'Ранній доступ: оплата вимкнена, усі функції відкриті для всіх. Ціни нижче заплановані.',
    monthly: 'Місяць', quarterly: '3 місяці', annual: 'Рік',
    perMonth: '/ міс',
    billed: '{total} ⭐ кожні {months} міс',
    free: 'Безкоштовно',
    current: 'Зараз відкрито для всіх',
    cta: 'Почати безкоштовно',
    plans: { free: 'Безкоштовно, назавжди.', stars_basic: 'Повний AI щоденник.', stars_pro: 'Без обмежень, уся історія.' },
    rows: {
      entries: 'Записи: {n}', aiWidgets: 'AI віджети: {n}', reports: 'Ретроспективи: {n}', historyDays: 'Стрічка за {n} днів',
      historyYear: 'Стрічка за рік', historyAll: 'Уся історія', voice: 'Голосові до {n} с', unlimited: 'без обмежень',
      aiRetro: 'AI ретроспективи', aiRecs: 'AI поради', goals: 'Трекінг цілей', graph: 'Граф звʼязків',
      priority: 'Пріоритетна обробка', encryption: 'Шифрування записів', pin: 'Захист PIN кодом',
    },
    faq: [
      ['Що таке Telegram Stars?', 'Внутрішня валюта Telegram. Stars купуються в Telegram, і платиш без форми картки.'],
      ['Чи можна платити карткою?', 'Не на цьому сайті. Платні плани заплановані за Telegram Stars.'],
      ['Чи є безкоштовний план?', 'Так. Spark безкоштовний без кінцевої дати.'],
    ],
  },
  blog: { title: 'Блог', sub: 'Як працює Memo і як отримати більше з кількох рядків на день.', read: 'Читати', back: 'Усі статті', minutes: '{n} хв читання', onlyEn: 'Статті поки лише англійською.' },
  notFound: { title: 'Такої сторінки немає.', body: 'Можливо, посилання застаріло або сторінку перенесли.', cta: 'Назад до Memo' },
};

export const DICTS = { en, uk } as const;
export type SiteLocale = keyof typeof DICTS;

/** Replace {name} tokens. */
export function fill(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function isPersona(v: unknown): v is PersonaSlug {
  return typeof v === 'string' && (PERSONAS as readonly string[]).includes(v);
}
