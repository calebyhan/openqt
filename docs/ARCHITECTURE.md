# Architecture

---

## System Overview

```
Browser (PWA)
    │
    ├── Supabase Auth (Google OAuth / email+password)
    ├── Supabase Postgres (via RLS — no service role on client)
    ├── Supabase Realtime (group feed, comments, reactions)
    │
    └── Supabase Edge Functions (Deno)
            ├── bible-proxy  →  api.bible
            ├── web-push     →  Web Push / VAPID
            ├── import-entry →  Gemini API (gemini-2.5-flash-lite)
            └── campaign-import (CSV/JSON parsing)
```

---

## Authentication & Users

### Auth Methods
- Google OAuth (via Supabase)
- Email + password (with email verification)

### Discovery Model
Invite-only. No public user search. Users can only find each other via group invite links. Profiles are not publicly visible — display name and avatar are visible only to shared group members.

### User Profile Shape

```ts
interface UserProfile {
  id: string                   // Supabase auth UUID
  display_name: string
  avatar_url: string | null
  email: string
  default_translation: string  // default: 'NIV'
  default_template_id: string | null
  timezone: string             // IANA string, e.g. "America/New_York" — default: 'UTC'
  push_subscription: Json | null
  notif_daily_reminder: boolean
  notif_reminder_time: string  // e.g. "07:00"
  notif_reactions: boolean
  notif_comments: boolean
  notif_campaign_day: boolean
  notif_streak_warning: boolean
  created_at: string
}
```

A `profiles` row is created automatically via a Postgres trigger on `auth.users` insert.

---

## Edge Functions

All functions require a valid Supabase JWT. Secrets (`BIBLE_API_KEY`, `GEMINI_API_KEY`, `VAPID_PRIVATE_KEY`) are stored in Supabase secrets and never exposed to the client.

### `bible-proxy`

Proxies requests to api.bible to keep the API key server-side.

| Endpoint | Description |
|---|---|
| `GET /bible-proxy/books` | List all books |
| `GET /bible-proxy/chapters/:bookId` | List chapters for a book |
| `GET /bible-proxy/passage?ref=John+3:16&translation=NIV` | Fetch passage text |

**NIV licensing note:** api.bible includes NIV for non-commercial use. OpenQT is non-commercial; this is acceptable at launch. If the app is ever monetized, a commercial license must be arranged with Biblica before continuing to serve NIV.

### `web-push`

Sends Web Push notifications via VAPID. Called by DB webhooks (reactions, comments) and pg_cron jobs (reminders, streak warnings, campaign day unlocks). See [NOTIFICATIONS.md](NOTIFICATIONS.md) for full design.

### `import-entry`

Parses uploaded files or pasted text and maps content to QT template sections using Gemini.

**Input:**
```ts
{
  content: string
  file_type: 'txt' | 'docx' | 'md' | 'paste'
  template_id: string
}
```

**Process:**
1. `docx` → parse with mammoth to plain text
2. `md` → parse with marked to plain text
3. Plain text + template section definitions → Gemini API (`gemini-2.5-flash-lite`)
4. Gemini returns JSON mapped to section keys
5. Response validated against template section keys
6. Return to client for user review before saving

**Gemini prompt:**
```
You are helping a user import a quiet time journal entry into a structured template.

Template sections:
{{sections as JSON}}

Raw journal text:
{{user text}}

Map the content to the template sections. Return ONLY valid JSON with section keys as keys and extracted content as values. If a section has no matching content, use an empty string. Do not include any explanation or markdown.
```

### `campaign-import`

Parses CSV or JSON uploaded by a campaign creator to bulk-create `campaign_days`. Validates that the caller is the campaign creator.

**CSV format:**
```csv
day_number,title,passage_ref,prompt,notes
1,Day 1: The Beginning,Genesis 1:1-5,What does it mean that God created from nothing?,Optional note
2,Day 2: Light and Dark,Genesis 1:6-8,Where do you see light and darkness in your life?,
```

**JSON format:**
```json
[
  {
    "day_number": 1,
    "title": "Day 1: The Beginning",
    "passage_ref": "Genesis 1:1-5",
    "prompt": "What does it mean that God created from nothing?",
    "notes": "Optional note"
  }
]
```

---

## Frontend

### Routes

```
/                         Home (feed + today's campaign prompt)
/write                    New entry — template picker → editor
/write/:entryId           Edit existing entry
/import                   Import flow
/bible                    Standalone Bible reader
/entries                  Personal journal list
/entries/:entryId         View own entry
/campaigns                Campaign list — joined + discover
                          "discover" = published campaigns attached to your groups that you haven't joined yet
/campaigns/new            Campaign creator — step 1: metadata
/campaigns/:id            Campaign detail (progress, leaderboard, days)
/campaigns/:id/edit       Edit campaign (creator only)
/groups                   Your groups list
/groups/new               Create group
/groups/:id               Group feed + members + attached campaigns
/join/:inviteCode         Invite link landing → join group
/settings                 Profile, notifications, translation, default template
/settings/templates       Custom template manager
```

### Components

#### `SplitPaneEditor`
- Left pane: dynamic form rendered from template `sections` config
- Right pane: `BibleReader` (book/chapter nav, verse list, translation switcher)
- Verse click in right pane → inserts `[Book Chapter:Verse]` citation into the focused left pane field
- Mobile: toggle between panes via tab bar at bottom
- Auto-saves draft to Supabase every 30s (`is_draft = true`)

#### `BibleReader`
- Book list → chapter grid → verse list
- Translation switcher (persists to `profiles.default_translation`)
- When opened from editor: verse selection shows "Insert" button
- Also usable standalone at `/bible`

#### `TemplateForm`
- Renders dynamically from `sections: TemplateSection[]`
- `type: 'text'` → single-line input
- `type: 'rich_text'` → Tiptap editor (headless, Tailwind prose styling)
- `type: 'verse_picker'` → shows linked verses, opens Bible pane on focus

#### `SharingDrawer`
- Bottom sheet (mobile) / side panel (desktop)
- Lists all groups the user is a member of
- Toggle share per group with per-group visibility: `reactions only | comments | full`
- Auto-share toggle per group — persisted to `group_members.auto_share`

#### `GroupFeed`
- Realtime feed of shared QT entries in a group (Supabase Realtime)
- Entry card: avatar, display name, title, template type, timestamp, reaction bar, comment count
- Reaction bar: 👍 🙏 ❤️ 🔥 — tap to toggle, shows counts
- Tap → expand or navigate to `/entries/:id`

#### `CampaignCreator`
- Step 1: Title, description, type (`reading_plan | guided_series | streak_challenge`), template, dates
- Step 2: Days — inline row editor or CSV/JSON import (not shown for `streak_challenge`)
- Step 3: Attach to groups — multi-select from groups where caller is owner or admin
- Step 4: Review + publish or save as draft
- Unpublished campaigns are invisible to non-creators

#### `CampaignDetail`
- Progress bar (days completed / total)
- Streak counter
- Leaderboard (group members sorted by `current_streak`)
- Today's day card (passage + prompt) → "Start Today's QT" pre-fills editor

#### `ImportFlow`
- Step 1: Input method — paste text or upload `.txt`, `.docx`, `.md`
- Step 2: Pick template to map to
- Step 3: Loading state while edge function processes
- Step 4: Review — side-by-side raw import vs. mapped sections, editable before saving
- Step 5: Sharing drawer before final save

#### `NotificationPermissionPrompt`
- Shown after first QT entry is saved
- Explains what notifications are used for
- Requests Web Push permission
- Stores subscription object to `profiles.push_subscription`

---

## Campaign Types

| Type | `campaign_days` used | Behavior |
|---|---|---|
| `reading_plan` | Yes | A passage is assigned per day. No prompt. |
| `guided_series` | Yes | A passage + prompt per day. |
| `streak_challenge` | No | Write any QT entry every day for the campaign duration (`start_date` → `end_date`). Streak is tracked on `campaign_members`. |

---

## Bible Integration

- **Provider:** api.bible — free tier, 1,600+ translations
- **Default translation:** NIV (see licensing note under `bible-proxy` above)
- **User-changeable:** Settings → persists to `profiles.default_translation`
- **Always proxied** — API key is never on the client
- **Verse reference stored as:**
  ```json
  { "book": "JHN", "chapter": 3, "verse": 16, "text": "...", "translation": "NIV" }
  ```
