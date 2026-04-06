# Database

Supabase Postgres. RLS is enabled on every table. The client never uses a service role key — all access goes through RLS policies.

---

## Migration Notes

- Never edit an existing migration file. Always create a new one.
- `profiles` and `qt_templates` have a circular foreign key:
  - `profiles.default_template_id → qt_templates(id)`
  - `qt_templates.created_by → profiles(id)`
- **Resolution:** Create both tables without the circular FK, then add `default_template_id` via `ALTER TABLE` in a subsequent migration step.
- After any schema change, regenerate types: `supabase gen types typescript --local > src/types/supabase.ts`

---

## Schema

### `profiles`
Extends `auth.users`. Created automatically via trigger on signup.

```sql
id uuid primary key references auth.users
display_name text not null
avatar_url text
default_translation text default 'NIV'
default_template_id uuid references qt_templates(id)  -- added via ALTER TABLE (see circular FK note above)
timezone text not null default 'UTC'                  -- IANA string, e.g. "America/New_York"
push_subscription jsonb                               -- Web Push subscription object
notif_daily_reminder boolean default true
notif_reminder_time time default '07:00'
notif_reactions boolean default true
notif_comments boolean default true
notif_campaign_day boolean default true
notif_streak_warning boolean default true
created_at timestamptz default now()
```

---

### `qt_templates`
```sql
id uuid primary key default gen_random_uuid()
name text not null
description text
is_system boolean default false   -- true for built-in templates
created_by uuid references profiles(id)
sections jsonb not null
-- sections shape: Array<{ key: string, label: string, type: 'text' | 'verse_picker' | 'rich_text', placeholder?: string, required?: boolean }>
created_at timestamptz default now()
```

**Built-in templates (seeded via `seed.sql`):**

| Name | Sections |
|---|---|
| SOAP | Scripture (verse_picker), Observation (rich_text), Application (rich_text), Prayer (rich_text) |
| Free-form | Title (text), Entry (rich_text) |
| Simple Journal | Passage (verse_picker), Reflection (rich_text) |

---

### `qt_entries`
```sql
id uuid primary key default gen_random_uuid()
user_id uuid references profiles(id) not null
template_id uuid references qt_templates(id) not null
campaign_id uuid references campaigns(id)       -- nullable
campaign_day int                                -- which day of the campaign (reading_plan/guided_series)
title text
content jsonb not null                          -- keyed by template section key
verse_refs jsonb                                -- Array<{ book, chapter, verse, text, translation }>
is_draft boolean default false
created_at timestamptz default now()
updated_at timestamptz default now()
```

---

### `qt_shares`
```sql
id uuid primary key default gen_random_uuid()
qt_entry_id uuid references qt_entries(id) not null
group_id uuid references groups(id) not null
visibility text check (visibility in ('reactions_only', 'comments', 'full')) not null
shared_at timestamptz default now()
```

---

### `reactions`
```sql
id uuid primary key default gen_random_uuid()
qt_entry_id uuid references qt_entries(id) not null
user_id uuid references profiles(id) not null
emoji text check (emoji in ('👍','🙏','❤️','🔥')) not null
created_at timestamptz default now()
unique(qt_entry_id, user_id, emoji)
```

---

### `comments`
Flat (no threading).

```sql
id uuid primary key default gen_random_uuid()
qt_entry_id uuid references qt_entries(id) not null
user_id uuid references profiles(id) not null
body text not null
created_at timestamptz default now()
updated_at timestamptz default now()
```

---

### `groups`
```sql
id uuid primary key default gen_random_uuid()
name text not null
description text
invite_code text unique not null default encode(gen_random_bytes(6), 'base64')
created_by uuid references profiles(id) not null
created_at timestamptz default now()
```

> `gen_random_bytes` requires the `pgcrypto` extension. `nanoid()` is not a built-in Postgres function.

---

### `group_members`
```sql
id uuid primary key default gen_random_uuid()
group_id uuid references groups(id) not null
user_id uuid references profiles(id) not null
role text check (role in ('owner', 'admin', 'member')) default 'member'
auto_share boolean default false   -- auto-share new entries to this group
joined_at timestamptz default now()
unique(group_id, user_id)
```

---

### `campaigns`
```sql
id uuid primary key default gen_random_uuid()
title text not null
description text
type text check (type in ('reading_plan', 'guided_series', 'streak_challenge')) not null
-- reading_plan: daily passage per campaign_days row, no prompt
-- guided_series: daily passage + prompt per campaign_days row
-- streak_challenge: no campaign_days rows; write any QT entry every day for the duration
created_by uuid references profiles(id) not null
template_id uuid references qt_templates(id)
start_date date
end_date date
is_published boolean default false
created_at timestamptz default now()
```

---

### `campaign_days`
Only used for `reading_plan` and `guided_series`. `streak_challenge` campaigns do not use this table.

```sql
id uuid primary key default gen_random_uuid()
campaign_id uuid references campaigns(id) not null
day_number int not null
title text
passage_ref text    -- e.g. "John 3:1-21"
prompt text         -- guided_series only
notes text
unique(campaign_id, day_number)
```

---

### `campaign_groups`
```sql
campaign_id uuid references campaigns(id) not null
group_id uuid references groups(id) not null
added_at timestamptz default now()
primary key (campaign_id, group_id)
```

---

### `campaign_members`
> `current_streak`, `longest_streak`, and `last_completed_day` are denormalized for fast leaderboard queries. They must be updated atomically whenever a qualifying `qt_entry` is saved (via DB trigger or edge function). Do not treat these as ground truth for entry history — query `qt_entries` for that.

```sql
campaign_id uuid references campaigns(id) not null
user_id uuid references profiles(id) not null
joined_at timestamptz default now()
current_streak int default 0
longest_streak int default 0
last_completed_day int default 0
-- reading_plan/guided_series: last campaign day number completed
-- streak_challenge: epoch day number of last qualifying entry
primary key (campaign_id, user_id)
```

---

## Row-Level Security Policies

| Table | Policy |
|---|---|
| `profiles` | User can read/update their own. Group members can read each other's `display_name` and `avatar_url`. |
| `qt_templates` | System templates (`is_system = true`) readable by all authenticated users. Custom templates readable/writable by creator only. |
| `qt_entries` | Owner can CRUD. Others can read only if a `qt_shares` row links the entry to a group they're a member of. |
| `qt_shares` | Entry owner can insert/delete. Group members can read. |
| `reactions` | Group members who can see the entry can insert/delete their own reaction. Read if can see entry. |
| `comments` | Group members with `comments` or `full` visibility can insert. Comment author OR entry owner can delete. Read if can see entry. |
| `groups` | Members can read. Owner/admin can update. Any authenticated user can insert (create). |
| `group_members` | Members can read their own group's member list. Owner can insert/delete. User can delete themselves (leave). |
| `campaigns` | Creator can CRUD. Published campaigns readable by members of attached groups. |
| `campaign_days` | Same as `campaigns`. |
| `campaign_groups` | Campaign creator can manage. Attaching to a group requires caller to be owner or admin of that group. |
| `campaign_members` | User can insert/delete themselves. Members of attached groups can read. |
