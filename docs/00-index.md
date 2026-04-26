# Memo — Documentation Index

> AI-powered personal diary as a Telegram Bot + Mini App

---

## Documents

| # | File | Description |
|---|------|-------------|
| 01 | [project-overview.md](./01-project-overview.md) | Product vision, mission, core features, user personas |
| 02 | [architecture.md](./02-architecture.md) | System architecture, data flow, infrastructure |
| 03 | [database-schema.md](./03-database-schema.md) | Full DB schema, RLS policies, SQL functions |
| 04 | [ai-pipeline.md](./04-ai-pipeline.md) | Gemini integration, classification, RAG, embeddings |
| 05 | [bot-logic.md](./05-bot-logic.md) | Telegram bot handlers, commands, thread system |
| 06 | [api-reference.md](./06-api-reference.md) | All API routes, request/response shapes |
| 07 | [auth-and-security.md](./07-auth-and-security.md) | Auth flow, encryption, RLS, security model |
| 08 | [subscription-system.md](./08-subscription-system.md) | Tiers, Telegram Stars payments, paywall logic |
| 09 | [design-system.md](./09-design-system.md) | Full design system: tokens, typography, color, spacing |
| 10 | [component-library.md](./10-component-library.md) | Atomic design: atoms, molecules, organisms, templates |
| 11 | [tone-of-voice.md](./11-tone-of-voice.md) | Brand voice, copy guidelines, UX writing |
| 12 | [team-report.md](./12-team-report.md) | Multi-role audit: engineering, QA, UX, product, marketing |
| 13 | [gaps-and-roadmap.md](./13-gaps-and-roadmap.md) | Identified gaps, 2026 improvement scope, prioritized backlog |
| 14 | [environment-and-deployment.md](./14-environment-and-deployment.md) | Env vars, Vercel setup, Supabase, cron jobs |

---

## Quick Facts

- **Stack:** Next.js 14 · TypeScript · Supabase (pgvector) · Gemini 2.5 Flash · grammY · Tailwind · shadcn/ui
- **Platform:** Telegram Bot + Mini App (WebApp)
- **Language:** Ukrainian (primary UI), multi-language input supported
- **Monetization:** Telegram Stars (XTR) — 3 tiers: Spark (free), Nova (250⭐/mo), Supernova (500⭐/mo)
- **Deployment:** Vercel (Edge + Node.js) + Supabase cloud
