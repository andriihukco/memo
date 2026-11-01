/**
 * Blog posts, English only for now. Plain blocks instead of MDX, so no new dependency.
 * Facts come from docs/04-ai-pipeline.md and src/lib/crypto.ts; keep them in step.
 */

export type Block = { h: string } | { p: string } | { ul: readonly string[] };

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  minutes: number;
  body: readonly Block[];
};

export const POSTS: readonly Post[] = [
  {
    slug: 'one-message-many-numbers',
    title: 'How one message becomes many numbers',
    description: 'What Memo pulls out of a line like “ran 5 km” or “150 UAH groceries”, and how you can check the result.',
    date: '2026-10-28',
    minutes: 3,
    body: [
      { p: 'Most trackers ask you to fill in a form. Memo asks for one line, the way you would text a friend. Here is what happens to that line.' },
      { h: 'Step 1. Memo works out what you meant' },
      { p: 'Each message is sorted into one of a few intents: a diary entry, a question about your past entries, a short chat, or a command such as “delete yesterday’s coffee”. Only diary entries are stored as entries.' },
      { h: 'Step 2. It picks a category' },
      { p: 'Food, training, sleep, mood, money and so on. If nothing fits, Memo creates a new category with a readable name, and uses your existing categories as context next time.' },
      { h: 'Step 3. It pulls out the numbers' },
      { p: 'Fixed rules turn one line into several metrics. A few examples:' },
      {
        ul: [
          '“ran 5 km” → distance 5 km, about 400 kcal burned, about 30 active minutes, about 6,000 steps',
          '“ate 200 g chicken” → about 330 kcal and 62 g of protein',
          '“slept 8 hours” → sleep 8 h',
          '“spent 150 UAH on groceries” → 150, in UAH',
          '“mood 7/10” → mood 7',
        ],
      },
      { p: 'One message can hold several entries. “Ran 5 km, then chicken with rice” becomes a workout and a meal.' },
      { h: 'Step 4. You can check the math' },
      { p: 'Every total on a chart links back to the entries it came from. If a number looks off, open the entry and fix it.' },
      { h: 'Voice works the same way' },
      { p: 'A voice note is transcribed and sorted in one pass. The audio is not written to disk.' },
    ],
  },
  {
    slug: 'what-a-weekly-retro-looks-like',
    title: 'What a weekly retro looks like',
    description: 'The five parts of a Memo retrospective, shown with a week of sample entries.',
    date: '2026-10-21',
    minutes: 4,
    body: [
      { p: 'A summary tells you what happened. A retro asks what to do about it. Memo borrows the format from team retrospectives and applies it to your week.' },
      { h: 'The five parts' },
      {
        ul: [
          'What went well',
          'What did not go well',
          'Start, stop, continue',
          'One experiment for next week',
          'The main lesson',
        ],
      },
      { p: 'Each retro also opens with a one or two sentence summary.' },
      { h: 'A sample week' },
      { p: 'Sample entries: three runs, two late evenings at work, sleep between 5.5 and 7.5 hours, coffee most afternoons, mood from 5 to 8.' },
      { h: 'The sample retro' },
      {
        ul: [
          'Summary: an active week with short sleep on workdays.',
          'Went well: three runs, 15 km in total. Mood was 7 or higher on run days.',
          'Did not go well: two nights under 6 hours, both after late work.',
          'Start, stop, continue: start a fixed end to work on weekdays, stop coffee after 3 pm, continue the runs.',
          'Experiment: no screens after 10:30 pm for five nights.',
          'Lesson: mood follows sleep more than training this week.',
        ],
      },
      { p: 'These lines are sample text written for this post. Your retro is built only from your own entries.' },
      { h: 'Getting one' },
      { p: 'Write for a few days, then open Reports in the app or ask the bot for a report. You can pick a day, a week, a month or a custom range.' },
    ],
  },
  {
    slug: 'how-memo-stores-your-diary',
    title: 'How Memo stores your diary',
    description: 'What is stored, how it is encrypted, who processes it, and how to take it with you.',
    date: '2026-10-14',
    minutes: 3,
    body: [
      { p: 'A diary is personal. Here is exactly what happens to it, without marketing words.' },
      { h: 'What is stored' },
      { p: 'Your entries, the metrics pulled from them, your categories, goals, widgets and reports, plus the account you sign in with: Telegram, email or Google, or an anonymous session.' },
      { h: 'How it is encrypted' },
      { p: 'Entry text is encrypted at rest with AES 256 GCM. The key is derived with HKDF SHA 256 using a salt stored for your account.' },
      { p: 'Encryption and decryption happen on our server, at the edge of the API. That means Memo is not end to end encrypted yet. We say so on every page where it matters.' },
      { h: 'Who processes it' },
      { p: 'To sort an entry and pull out numbers, the text or voice note is sent to Google Gemini. Embeddings for search are made with Gemini too. Data is stored in Supabase.' },
      { h: 'Taking it with you' },
      {
        ul: [
          'Export: Settings gives you a full download of your data.',
          'Delete: Settings also deletes your account and its entries.',
          'Lock: a PIN can lock the app on your device.',
        ],
      },
      { h: 'Not medical advice' },
      { p: 'Memo describes patterns in what you wrote. It does not diagnose anything.' },
    ],
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);
