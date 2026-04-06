# CLAUDE.md — OpenQT

Project-specific instructions for Claude Code. These override the global `~/.claude/CLAUDE.md` where they conflict.

---

## Start Here

Before writing any code:
1. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — auth, components, edge functions, Bible integration
2. Read [docs/DATABASE.md](docs/DATABASE.md) — full schema and RLS policies
3. Read [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) — push notification design
4. Read [supabase/README.md](supabase/README.md) — local Supabase workflow

When starting a new phase, break it into atomic, testable tasks before writing any code.

---

## Non-Negotiables

- **Never expose `BIBLE_API_KEY`, `GEMINI_API_KEY`, or `VAPID_PRIVATE_KEY` on the client.** All must be used only inside Supabase Edge Functions.
- **All client database access must go through Supabase RLS.** No service role key on the client, ever.
- **TypeScript strict mode.** No `any`. No `@ts-ignore` without an inline comment explaining why.
- **Mobile-first.** Design every component for a 375px viewport first. Desktop is an enhancement.

---

## Code Conventions

- **Rich text editor:** Tiptap headless with Tailwind prose styling. Do not use other editors.
- **State management:** Zustand for global state (auth session, Bible pane open/closed). Prefer local state and Supabase hooks for everything else.
- **Data flexibility:** When a schema decision isn't covered in the docs, prefer JSONB over rigid columns and document the decision with an inline comment.
- **Component naming:** PascalCase for components, camelCase for hooks (`useAuth`, `useBible`). Hooks live in `src/hooks/`.
- **Path aliases:** Use `@/` for `src/`. Configure in `vite.config.ts` and `tsconfig.json`.

---

## Database & Migrations

- **Never edit an existing migration file.** Always create a new one.
- Migration files are named `YYYYMMDDHHMMSS_description.sql`.
- The `profiles` and `qt_templates` tables have a circular FK. `profiles.default_template_id` must be added via `ALTER TABLE` in a migration step after both tables exist. See [docs/DATABASE.md](docs/DATABASE.md).
- After any schema change, regenerate Supabase types: `supabase gen types typescript --local > src/types/supabase.ts`

---

## Edge Functions

All functions live in `supabase/functions/`. Each is a Deno module. Auth check pattern:

```ts
const authHeader = req.headers.get('Authorization')
const { data: { user }, error } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
if (error || !user) return new Response('Unauthorized', { status: 401 })
```

---

## File Structure

```
openqt/
├── public/
│   ├── icons/              # PWA icons (all sizes)
│   └── manifest.webmanifest
├── src/
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── bible/          # BibleReader, VerseCard, TranslationSwitcher
│   │   ├── editor/         # SplitPaneEditor, TemplateForm, RichTextEditor
│   │   ├── entries/        # EntryCard, EntryList, EntryDetail
│   │   ├── groups/         # GroupFeed, GroupCard, MemberList
│   │   ├── campaigns/      # CampaignCreator, CampaignDetail, DayCard, Leaderboard
│   │   ├── sharing/        # SharingDrawer
│   │   ├── import/         # ImportFlow
│   │   └── notifications/  # NotificationPermissionPrompt
│   ├── pages/              # Route-level components (mirrors screen map in ARCHITECTURE.md)
│   ├── hooks/              # useAuth, useBible, useRealtime, usePush, etc.
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client
│   │   ├── bible.ts        # Bible API client (calls proxy)
│   │   └── utils.ts
│   ├── types/              # Shared TypeScript interfaces + generated Supabase types
│   ├── store/              # Zustand stores
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── bible-proxy/
│   │   ├── web-push/
│   │   ├── import-entry/
│   │   └── campaign-import/
│   └── seed.sql
├── .env.example
├── vite.config.ts
└── tailwind.config.ts
```
