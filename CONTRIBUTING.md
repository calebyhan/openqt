# Contributing to OpenQT

---

## Branch Naming

```
feature/<short-description>     # new functionality
fix/<short-description>         # bug fixes
chore/<short-description>       # tooling, deps, config
docs/<short-description>        # documentation only
```

Examples: `feature/split-pane-editor`, `fix/realtime-reconnect`, `chore/update-tailwind`

---

## Commit Messages

Use the imperative mood. Keep the subject line under 72 characters.

```
Add SplitPaneEditor auto-save draft logic
Fix RLS policy for qt_shares visibility check
Update Bible proxy to support chapter range queries
```

No ticket numbers required. No emoji.

---

## Pull Requests

- PRs target `main`.
- Keep PRs scoped to one feature or fix. Don't bundle unrelated changes.
- CI must pass (lint, type-check, tests) before merging.
- At least one review required before merge.
- Squash merge to keep history clean.

PR description should include:
1. What changed and why
2. How to test it
3. Any migration steps required (if DB schema changed)

---

## Local Setup

See [README.md](README.md) for full setup instructions.

Before pushing:

```bash
npm run lint
npm run typecheck
npm run test
```

---

## Build Phases

Implementation follows this sequence. Do not skip phases — each builds on the previous.

### Phase 1 — Foundation
- [ ] Vite + React + TypeScript scaffold
- [ ] Tailwind + shadcn/ui setup
- [ ] Supabase project init + all migrations
- [ ] RLS policies
- [ ] Auth (Google + email/password)
- [ ] Profile creation trigger
- [ ] Seed built-in templates

### Phase 2 — Core Writing
- [ ] `bible-proxy` edge function
- [ ] `BibleReader` component
- [ ] `TemplateForm` component (Tiptap rich text)
- [ ] `SplitPaneEditor` (split pane, verse insertion, auto-save)
- [ ] Save entry (private, no sharing yet)
- [ ] Personal journal (`/entries`)

### Phase 3 — Groups & Sharing
- [ ] Create/join groups (invite link flow)
- [ ] `SharingDrawer`
- [ ] Share entry to groups
- [ ] `GroupFeed` with Realtime
- [ ] Reactions (fixed set)
- [ ] Comments (flat)

### Phase 4 — Campaigns
- [ ] `CampaignCreator` (all 3 types)
- [ ] `campaign-import` edge function (CSV/JSON)
- [ ] Attach campaigns to groups
- [ ] `CampaignDetail` (progress, leaderboard)
- [ ] Pre-fill editor from campaign day
- [ ] Streak tracking

### Phase 5 — Import
- [ ] `import-entry` edge function (mammoth + marked + Gemini)
- [ ] `ImportFlow` UI

### Phase 6 — Notifications
- [ ] VAPID key generation
- [ ] `web-push` edge function
- [ ] `NotificationPermissionPrompt`
- [ ] DB webhooks for reaction/comment push
- [ ] `pg_cron` jobs for reminder + streak warning + campaign day

### Phase 7 — PWA & Polish
- [ ] `vite-plugin-pwa` config + manifest
- [ ] PWA icons
- [ ] Settings page (all prefs)
- [ ] Custom template manager
- [ ] Mobile responsiveness pass
- [ ] Accessibility pass

---

## Database Changes

Any schema change requires a new migration file in `supabase/migrations/`. Never edit existing migration files. See [supabase/README.md](supabase/README.md) for the migration workflow.
