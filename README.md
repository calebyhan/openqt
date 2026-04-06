# OpenQT

A quiet time app for individuals, small groups, and churches.

OpenQT makes daily quiet time (QT) a shared, accountable, and structured practice. Write or import personal QT entries, join groups, participate in campaigns (reading plans, guided series, streak challenges), and share entries with granular visibility controls.

**Platform:** Progressive Web App (PWA) — mobile-first, installable on iOS 16.4+ and Android, accessible on desktop via browser. Future: Capacitor wrapper for native App Store distribution.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Strict mode, path aliases |
| Styling | Tailwind CSS + shadcn/ui | Mobile-first, CSS variables for theming |
| PWA | `vite-plugin-pwa` + Workbox | No offline support in v1 — install + Web Push only |
| Auth | Supabase Auth | Google SSO + email/password |
| Database | Supabase Postgres | Row-level security (RLS) on all tables |
| Realtime | Supabase Realtime | Comments, reactions, group feed live updates |
| Edge Functions | Supabase Edge Functions (Deno) | Bible API proxy, Web Push dispatch, import processing |
| Bible API | api.bible | Proxied — API key never exposed client-side |
| File Parsing | mammoth (docx), marked (md) | Used in import edge function |
| AI Mapping | Gemini API (`gemini-2.5-flash-lite`) | Maps imported text to QT template sections |
| Notifications | Web Push API + VAPID | Supabase Edge Function as push dispatcher |
| Hosting | Vercel | Preview deploys on PRs, production on main |
| CI | GitHub Actions | Lint, type-check, test on PR |

---

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (or local instance)
- An [api.bible](https://scripture.api.bible) API key
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- VAPID keys (generate with `npx web-push generate-vapid-keys`)

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env.local

# Start Supabase locally
supabase start

# Apply migrations and seed
supabase db reset

# Start dev server
npm run dev
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

Client-side variables are prefixed with `VITE_`. All secret keys (`BIBLE_API_KEY`, `GEMINI_API_KEY`, `VAPID_PRIVATE_KEY`) are set only in Supabase secrets — never on the client.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — auth, edge functions, frontend components, Bible integration, import/AI mapping
- [Database](docs/DATABASE.md) — full schema, RLS policies, migration notes
- [Notifications](docs/NOTIFICATIONS.md) — Web Push, VAPID, cron strategy
- [Supabase Setup](supabase/README.md) — local dev, migrations, seed data
- [Contributing](CONTRIBUTING.md) — branch conventions, PR process, build phases
