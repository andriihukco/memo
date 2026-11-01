# Landing plan: personas, AIDA, site map

Status: phase 1 built 2026-11-01 (landing, pricing, blog, legal, 404). Phase 2: /for/<slug> pages, /features/*, og:image, testimonials.

## Facts the page may claim (verified in code)

| Claim | Source |
|---|---|
| Text and voice entries, any language; AI extracts metrics | `README.md`, `docs/04-ai-pipeline.md` |
| Free plan Spark; Nova 250 ⭐/mo; Supernova 500 ⭐/mo; −15% quarterly, −30% annual | `docs/08-subscription-system.md`, `src/components/ui/paywall-modal.tsx` |
| 3 day Nova trial, once per account | `src/app/api/profile/trial/route.ts` |
| Start without an account | `src/components/features/landing/start-anonymously.tsx` |
| Data export and account delete | `src/app/api/profile/export`, `src/app/api/profile/delete` |
| Referral invites | `src/app/api/profile/referral`, `mobile/app/invite.tsx` |
| Entries encrypted at rest with AES-256-GCM **on the server**, not end to end | `src/lib/crypto.ts:18` |

Do not claim: "client side encryption" or "even the server cannot read your diary" (`docs/01-project-overview.md` says so, the code does not). No user counts, ratings, testimonials or logos exist; use `{{placeholder}}`.

## Personas

| # | Persona | Job to be done | Main objection | Lead magnet (product backed) | Hero proof widget |
|---|---|---|---|---|---|
| 1 | Self optimizer, 25 to 35 | One place for food, training, sleep | "Another app to feed" | Free 7 day weekly retro, sent in Telegram | "ran 5 km" → 4 metrics |
| 2 | Reflective professional, 28 to 40 | See patterns in work and thoughts | "Journaling takes too long" | Sample retrospective report (real format, sample data) | Retro card: went well / to improve |
| 3 | Casual budget tracker, 22 to 32 | Know where money went, no spreadsheets | "Bank apps already do this" | Monthly spending recap after 30 days, free tier | "spent 200 on groceries" → category + total |
| 4 | Sleep and mood watcher | Link sleep, mood, energy | "Trackers judge me" | 14 day sleep and mood check (reminder + recap) | Night hero sleep card |
| 5 | Habit and goal builder | Hit a goal without a coach | "I quit after a week" | Goal starter templates + daily reminder | Goal progress bar, streak |
| 6 | Privacy first writer | Diary they control | "Who reads this?" | Plain privacy explainer + export anytime | Encryption + export + delete list |
| 7 | Telegram native, UA/CIS | Stay inside Telegram, pay without a card | "Card payments, English only" | Open in Telegram, pay in Stars, Ukrainian UI | Bot chat bubble in Ukrainian |

## AIDA per persona (one block each on `/for/<slug>`, compressed into the hero switcher on `/`)

| Persona | Attention (headline) | Interest | Desire | Action (one CTA) |
|---|---|---|---|---|
| 1 | Log a workout in one message | "ran 5 km" becomes distance, time, kcal, steps | Weekly numbers against your own past weeks | Start free |
| 2 | Your week, written back to you | Voice notes become a structured retro | Five section retro every Friday | Get a sample retro |
| 3 | Type what you spent. That is it. | Auto categories, plain monthly totals | No bank login, no spreadsheet | Start free |
| 4 | See what your nights say | Sleep, mood and energy on one chart | Compared with you, never with others | Start the 14 day check |
| 5 | Goals that check in with you | Reminder at the hour you pick | Progress bar fed by what you already log | Set my first goal |
| 6 | Your diary, kept plainly | What is stored, how it is encrypted, who can read it | Export or delete in two taps | Start without an account |
| 7 | Щоденник прямо в Telegram | Пишеш як другу, Memo рахує | Оплата зірками, без картки | Відкрити в Telegram |

Adaptive mechanics: `?for=<slug>` or a UTM campaign maps to a persona; the hero swaps headline, sub, proof widget and CTA. Default `/` shows a persona picker chip row ("I want to track…"). Choice is kept in localStorage only. Each persona also gets an indexable `/for/<slug>` page.

## Site map

```
/                 landing (adaptive hero)
/for/<slug>       7 persona pages
/features         overview → /features/{voice,insights,goals,privacy}
/pricing          Spark / Nova / Supernova, Stars, period toggle, FAQ
/blog             index → /blog/<slug> (MDX in repo)
/changelog        from git tags or a MDX file
/privacy /terms   legal (required, missing today)
/not-found        branded 404
```

Header: floating pill, Product (mega menu: features + personas), Pricing, Blog, Sign in, primary CTA "Start free", theme switch. Mobile: full height panel, staggered links.

## Landing outline (layout A, classic hero + sections)

1. Hero: sky scene (day sun + clouds / night moon + stars), persona chips, one CTA, proof line
2. Persona proof band: the widget for the chosen persona
3. Tagline reveal (word by word): "Write it the way you would tell a friend. / Memo keeps the numbers."
4. How it works: write or speak → Memo sorts it → see your week
5. Benefits (4)
6. Privacy, plainly
7. Pricing teaser → `/pricing`
8. Proof: `{{testimonials}}`
9. FAQ (8)
10. Final CTA, same as hero
