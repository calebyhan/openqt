# Supabase

Local development setup, migration workflow, and seed data.

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`
- Docker (required for local Supabase)

---

## Local Development

```bash
# Start local Supabase (Postgres, Auth, Storage, Edge Functions)
supabase start

# Output includes local URLs and keys — copy to .env.local
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_ANON_KEY=<anon key from output>

# Stop local Supabase
supabase stop
```

---

## Migrations

Migration files live in `supabase/migrations/`. Named `YYYYMMDDHHMMSS_description.sql`.

```bash
# Create a new migration file
supabase migration new <description>

# Apply all pending migrations to local DB
supabase db push

# Reset local DB (drops, re-applies all migrations, runs seed.sql)
supabase db reset

# Generate TypeScript types from local DB schema
supabase gen types typescript --local > src/types/supabase.ts
```

**Never edit an existing migration file.** Always create a new one.

### Migration Order Notes

`profiles` and `qt_templates` have a circular foreign key. The migration sequence must be:

1. Create `profiles` without `default_template_id`
2. Create `qt_templates` (references `profiles.id`)
3. `ALTER TABLE profiles ADD COLUMN default_template_id uuid references qt_templates(id)`

---

## Seed Data

`supabase/seed.sql` is run automatically by `supabase db reset`. It inserts the three built-in system templates:

| Name | Sections |
|---|---|
| SOAP | Scripture, Observation, Application, Prayer |
| Free-form | Title, Entry |
| Simple Journal | Passage, Reflection |

System templates have `is_system = true` and `created_by = null`.

---

## Edge Functions

Functions live in `supabase/functions/<name>/index.ts`. Each is a Deno module.

```bash
# Serve all functions locally (hot reload)
supabase functions serve

# Serve a specific function
supabase functions serve bible-proxy

# Set local secrets for edge functions
supabase secrets set BIBLE_API_KEY=<key>
supabase secrets set GEMINI_API_KEY=<key>
supabase secrets set VAPID_PUBLIC_KEY=<key> VAPID_PRIVATE_KEY=<key> VAPID_SUBJECT=mailto:you@example.com

# Deploy a function to remote project
supabase functions deploy bible-proxy
```

---

## Connecting to a Remote Project

```bash
# Link to your Supabase project
supabase link --project-ref <project-ref>

# Push migrations to remote
supabase db push

# Pull remote schema changes (if edited in dashboard)
supabase db pull
```

---

## DB Webhooks

The `web-push` edge function is triggered by DB webhooks on:
- `INSERT` on `reactions`
- `INSERT` on `comments`

Configure these in the Supabase dashboard under Database → Webhooks, or via the CLI:

```bash
# Example (adjust URL to your project's function URL)
supabase db webhook create \
  --table reactions \
  --events INSERT \
  --url https://<project>.supabase.co/functions/v1/web-push
```

---

## pg_cron

Cron jobs are configured via the `pg_cron` extension. Enable it in the Supabase dashboard under Database → Extensions, then create jobs in SQL:

```sql
-- Daily reminder check (every minute)
SELECT cron.schedule('daily-reminders', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/web-push',
    body := '{"type": "daily_reminder"}'::jsonb
  );
$$);

-- Streak warning check (every minute)
SELECT cron.schedule('streak-warnings', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/web-push',
    body := '{"type": "streak_warning"}'::jsonb
  );
$$);

-- Campaign day unlock (midnight UTC)
SELECT cron.schedule('campaign-day-unlock', '0 0 * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/web-push',
    body := '{"type": "campaign_day"}'::jsonb
  );
$$);
```
