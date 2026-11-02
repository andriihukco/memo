/**
 * Copy for the public marketing site (landing, pricing, blog index, legal chrome).
 * Server rendered, so it lives here and not in the client catalogs under src/i18n.
 * `uk` is typed as `Dict`, so a missing key fails the type check.
 *
 * Every claim must trace to code: plans and limits to src/lib/billing/plans.ts, encryption to
 * src/lib/crypto.ts, metric examples to docs/04-ai-pipeline.md. See docs/marketing/landing-plan.md.
 */

export const PERSONAS = ['food', 'money', 'water', 'quit', 'sleep', 'fitness'] as const;
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
  auth: {
    back: string; signInTitle: string; signUpTitle: string; signInSub: string; signUpSub: string;
    modeSignIn: string; modeSignUp: string; email: string; emailHint: string; sendLink: string; sending: string;
    sent: string; sentBody: string; or: string; google: string; telegram: string; telegramOff: string;
    anon: string; legal: string; terms: string; privacy: string; notConfigured: string; failed: string;
    home: string; cont: string; welcomeBack: string; newHere: string; usePassword: string; password: string;
    signInPassword: string; magicLink: string; createAccount: string; wrongPassword: string; guest: string;
  };
  meta: { title: string; description: string };
  nav: {
    home: string; product: string; pricing: string; blog: string; signIn: string; startFree: string;
    menu: string; close: string; skip: string; theme: string; light: string; dark: string; language: string; soundOn: string; soundOff: string;
  };
  hero: {
    h1: readonly string[]; sub: string;
    pickLabel: string; cta: string; telegramCta: string; proofOpen: string; proofPaid: string;
    you: string; memo: string; parsed: string; analyzing: string; placeholder: string;
    kinds: { record: string; reminder: string; note: string; thought: string; chart: string; ring: string; todo: string };
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
    calc: {
      title: string; sub: string; costLabel: string; costHint: string; perMonth: string; youPay: string;
      youGet: string; margin: string; noCost: string; bestUser: string; bestDev: string; assumption: string;
      starRateLabel: string; fxLabel: string;
    };
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
  auth: {
    back: 'Back', signInTitle: 'Sign in to Memo', signUpTitle: 'Create your Memo account',
    signInSub: 'We email you a one-time link. No password to remember.',
    signUpSub: 'Start with your email. We create the account when you open the link.',
    modeSignIn: 'Sign in', modeSignUp: 'Sign up', email: 'Email', emailHint: 'you@example.com',
    sendLink: 'Email me a link', sending: 'Sending…', sent: 'Check your inbox',
    sentBody: 'Open the link we sent to {email}. You can close this tab after you open it.',
    or: 'or', google: 'Continue with Google', telegram: 'Continue with Telegram', telegramOff: 'Telegram sign-in is not set up on this server.',
    anon: 'Start as Guest', legal: 'By continuing you agree to our', terms: 'Terms', privacy: 'Privacy policy',
    notConfigured: 'Sign-in is not set up on this server yet.', failed: 'Something went wrong. Try again.', home: 'Memo home',
    cont: 'Continue', welcomeBack: 'Welcome back', newHere: 'New here? Let’s create your account.', usePassword: 'Use a password instead',
    password: 'Password', signInPassword: 'Sign in with password', magicLink: 'Email me a link', createAccount: 'Create account',
    wrongPassword: 'That password did not match. Try again or use a link.', guest: 'Start as Guest',
  },
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
    analyzing: 'Reading your entry',
    placeholder: 'Write or say what happened',
    kinds: { record: 'Record', reminder: 'Reminder', note: 'Note', thought: 'Thought', chart: 'Chart', ring: 'Progress', todo: 'To do' },
  },
  band: { eyebrow: 'Made for this', magnet: 'Free to try' },
  personas: {
    food: {
      chip: 'Food',
      h1: ['Log a meal', 'in one line.'],
      sub: 'Type what you ate. Memo counts calories and protein, and shows where your day stands.',
      demoInput: 'chicken and rice for lunch, apple after the gym',
      demoOut: [['Calories', '≈ 610 kcal'], ['Protein', '48 g'], ['Today', '1,420 kcal'], ['Meals', '3 of 4']],
      benefits: [
        ['Counted from your words', 'Calories and protein come from what you wrote, with the math shown.'],
        ['A daily chart', 'See each day against your goal, and the week at a glance.'],
        ['A meal checklist', 'Tick what you ate. Missed meals show up in the week view.'],
      ],
      magnet: { title: 'Your first day of meals', body: 'Write what you eat for one day. Memo builds the chart and the checklist from it.', cta: 'Start free', href: '/login' },
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
    water: {
      chip: 'Water',
      h1: ['Water, counted', 'without another app.'],
      sub: 'Say "500 ml after the gym". Memo adds it up against your daily goal.',
      demoInput: 'glass of water, 500 ml after the gym, coffee at 3 pm',
      demoOut: [['Today', '1.5 L'], ['Goal', '2 L'], ['Progress', '75%'], ['Next', 'Water at 4 pm']],
      benefits: [
        ['A goal in one line', 'Set a daily target once. Every drink adds up against it.'],
        ['A progress ring', 'See how close you are today, at a glance.'],
        ['Gentle reminders', 'Pick the hours Memo nudges you to drink.'],
      ],
      magnet: { title: 'Set your daily water goal', body: 'Pick a number for today. Memo tracks it from what you write.', cta: 'Start free', href: '/login' },
    },
    quit: {
      chip: 'Quit',
      h1: ['Quit one habit,', 'one day at a time.'],
      sub: 'Log a slip or a win in a line. Memo keeps your streak and shows what sets off a slip.',
      demoInput: 'no cigarettes today, one slip on Friday after work',
      demoOut: [['Streak', '9 days'], ['This week', '1 slip'], ['Trigger', 'Evenings'], ['Next check-in', 'Fri 9 pm']],
      benefits: [
        ['A streak that stays honest', 'A slip does not erase what you did right. The count keeps going.'],
        ['Triggers, named', 'Memo groups slips by time and place, so the pattern shows.'],
        ['A check-in you choose', 'Pick a time each week to review the streak.'],
      ],
      magnet: { title: 'Start your streak', body: 'Log today in one line. Memo starts the count.', cta: 'Start free', href: '/login' },
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
  },
  tagline: ['Write it the way you would tell a friend.', 'Memo keeps the numbers.'],
  try: {
    eyebrow: 'Chapter one · Your day',
    title: 'Your day, in a few taps.',
    sub: 'Tick a task, drag the sleep ring, pick a day. The numbers are samples, and nothing is saved.',
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
    calc: {
      title: 'Unit economics',
      sub: 'See what each plan costs you, and what it returns us. Change the blue numbers to your own.',
      costLabel: 'Your cost per active user, per month',
      costHint: 'Enter your own figure. Gemini, Supabase and hosting all count here.',
      perMonth: 'per month',
      youPay: 'You pay',
      youGet: 'We receive (before Telegram fees)',
      margin: 'Margin per user per month',
      noCost: 'Enter a cost to see the margin.',
      bestUser: 'Best for you: the lowest price per month.',
      bestDev: 'Best for us: the most cash up front and the fewest renewals.',
      assumption: 'Assumptions, not live rates. Edit them before you rely on the numbers.',
      starRateLabel: 'Value of one Star (USD)',
      fxLabel: 'UAH per USD',
    },
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
  auth: {
    back: 'Назад', signInTitle: 'Увійти в Memo', signUpTitle: 'Створити акаунт Memo',
    signInSub: 'Ми надішлемо одноразове посилання на email. Пароль не потрібен.',
    signUpSub: 'Почни з email. Акаунт створюється, коли відкриєш посилання.',
    modeSignIn: 'Увійти', modeSignUp: 'Реєстрація', email: 'Email', emailHint: 'you@example.com',
    sendLink: 'Надіслати посилання на email', sending: 'Надсилаємо…', sent: 'Перевір пошту',
    sentBody: 'Відкрий посилання, яке ми надіслали на {email}. Цю вкладку можна закрити після відкриття.',
    or: 'або', google: 'Продовжити з Google', telegram: 'Продовжити з Telegram', telegramOff: 'Вхід через Telegram не налаштований на цьому сервері.',
    anon: 'Почати як гість', legal: 'Продовжуючи, ти погоджуєшся з', terms: 'умовами', privacy: 'політикою приватності',
    notConfigured: 'Вхід ще не налаштований на цьому сервері.', failed: 'Щось пішло не так. Спробуй ще раз.', home: 'Memo, головна',
    cont: 'Продовжити', welcomeBack: 'З поверненням', newHere: 'Вперше тут? Створімо твій акаунт.', usePassword: 'Увійти з паролем',
    password: 'Пароль', signInPassword: 'Увійти з паролем', magicLink: 'Надіслати посилання на email', createAccount: 'Створити акаунт',
    wrongPassword: 'Пароль не підійшов. Спробуй ще раз або скористайся посиланням.', guest: 'Почати як гість',
  },
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
    analyzing: 'Читаю запис',
    placeholder: 'Напиши або скажи, що сталося',
    kinds: { record: 'Запис', reminder: 'Нагадування', note: 'Нотатка', thought: 'Думка', chart: 'Графік', ring: 'Прогрес', todo: 'Завдання' },
  },
  band: { eyebrow: 'Саме для цього', magnet: 'Спробуй безкоштовно' },
  personas: {
    food: {
      chip: 'Їжа',
      h1: ['Запиши їжу', 'одним рядком.'],
      sub: 'Напиши, що їв. Memo порахує калорії й білок і покаже, де стоїть твій день.',
      demoInput: 'курка з рисом на обід, яблуко після залу',
      demoOut: [['Калорії', '≈ 610 ккал'], ['Білок', '48 г'], ['Сьогодні', '1 420 ккал'], ['Прийоми їжі', '3 з 4']],
      benefits: [
        ['Рахує з твоїх слів', 'Калорії й білок беруться з того, що ти написав, і видно розрахунок.'],
        ['Денний графік', 'Бачиш кожен день відносно цілі й тиждень одним поглядом.'],
        ['Список прийомів їжі', 'Познач, що їв. Пропущені прийоми видно в тижневому огляді.'],
      ],
      magnet: { title: 'Твій перший день харчування', body: 'Запиши, що їв за один день. Memo збере з цього графік і список.', cta: 'Почати безкоштовно', href: '/login' },
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
    water: {
      chip: 'Вода',
      h1: ['Вода, порахована', 'без ще одного застосунку.'],
      sub: 'Напиши «500 мл після залу». Memo додасть до денної цілі.',
      demoInput: 'склянка води, 500 мл після залу, кава о третій',
      demoOut: [['Сьогодні', '1,5 л'], ['Ціль', '2 л'], ['Прогрес', '75%'], ['Далі', 'Вода о 16:00']],
      benefits: [
        ['Ціль в один рядок', 'Задай денну ціль один раз. Кожен напій додається до неї.'],
        ['Кільце прогресу', 'Одним поглядом видно, наскільки ти близько сьогодні.'],
        ['Мʼякі нагадування', 'Обери години, коли Memo нагадує пити.'],
      ],
      magnet: { title: 'Постав денну ціль води', body: 'Обери число на сьогодні. Memo відстежить його з того, що ти пишеш.', cta: 'Почати безкоштовно', href: '/login' },
    },
    quit: {
      chip: 'Відмова',
      h1: ['Відмовся від однієї звички,', 'день за днем.'],
      sub: 'Запиши зрив або перемогу одним рядком. Memo веде серію і показує, що провокує зрив.',
      demoInput: 'сьогодні без сигарет, один зрив у пʼятницю після роботи',
      demoOut: [['Серія', '9 днів'], ['Цей тиждень', '1 зрив'], ['Тригер', 'Вечори'], ['Наступна перевірка', 'Пт 21:00']],
      benefits: [
        ['Серія, яка чесна', 'Зрив не стирає того, що ти зробив добре. Лічильник іде далі.'],
        ['Тригери, названі', 'Memo групує зриви за часом і місцем, тож видно закономірність.'],
        ['Перевірка, яку обереш ти', 'Обери час щотижня, щоб переглянути серію.'],
      ],
      magnet: { title: 'Почни свою серію', body: 'Запиши сьогодні одним рядком. Memo почне лічильник.', cta: 'Почати безкоштовно', href: '/login' },
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
  },
  tagline: ['Пиши так, як розповів би другові.', 'Цифри Memo збереже сам.'],
  try: {
    eyebrow: 'Розділ перший · Твій день',
    title: 'Твій день, за кілька дотиків.',
    sub: 'Познач завдання, посувай кільце сну, обери день. Цифри прикладні, і нічого не зберігається.',
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
    calc: {
      title: 'Економіка одного користувача',
      sub: 'Що коштує кожен план вам і що він приносить нам. Змінюйте сині числа під свої.',
      costLabel: 'Ваша вартість одного активного користувача на місяць',
      costHint: 'Введіть власну цифру. Gemini, Supabase і хостинг входять сюди.',
      perMonth: 'на місяць',
      youPay: 'Ви платите',
      youGet: 'Ми отримуємо (до комісії Telegram)',
      margin: 'Маржа з користувача на місяць',
      noCost: 'Введіть вартість, щоб побачити маржу.',
      bestUser: 'Найвигідніше для вас: найнижча ціна за місяць.',
      bestDev: 'Найвигідніше для нас: більше грошей наперед і менше продовжень.',
      assumption: 'Це припущення, а не курс у реальному часі. Змініть їх перед тим, як покладатися на цифри.',
      starRateLabel: 'Вартість однієї зірки (USD)',
      fxLabel: 'UAH за USD',
    },
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
