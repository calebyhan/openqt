/**
 * campaign-import edge function
 *
 * POST /campaign-import
 * Authorization: Bearer <user JWT>
 * Content-Type: application/json  OR  text/csv
 *
 * JSON body:
 *   { campaign_id: string; days: Array<CampaignDayInput> }
 *
 * CSV body (header row required):
 *   day_number,title,passage_ref,prompt,notes
 *
 * CampaignDayInput:
 *   { day_number: number; title?: string; passage_ref?: string; prompt?: string; notes?: string }
 *
 * Validation:
 *   - Caller must be the campaign creator.
 *   - Campaign type must be reading_plan or guided_series (streak_challenge has no days).
 *   - day_number must be a positive integer, unique within the batch.
 *   - Max 366 days per campaign.
 *
 * Response:
 *   200  { upserted: number }
 *   400  { error: string }
 *   401  Unauthorized
 *   403  Forbidden
 *   500  { error: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

interface CampaignDayInput {
  day_number: number
  title?: string | null
  passage_ref?: string | null
  prompt?: string | null
  notes?: string | null
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function parseCsv(text: string): CampaignDayInput[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const dayNumIdx = headers.indexOf('day_number')
  if (dayNumIdx === -1) throw new Error('CSV must include a day_number column')

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const get = (name: string) => {
      const i = headers.indexOf(name)
      return i >= 0 && cols[i] !== '' ? cols[i] : null
    }
    const dayNum = parseInt(cols[dayNumIdx], 10)
    if (isNaN(dayNum)) throw new Error(`Invalid day_number: "${cols[dayNumIdx]}"`)
    return {
      day_number: dayNum,
      title: get('title'),
      passage_ref: get('passage_ref'),
      prompt: get('prompt'),
      notes: get('notes'),
    }
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // --- Auth ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  // --- Parse body ---
  let campaignId: string
  let days: CampaignDayInput[]

  try {
    const contentType = req.headers.get('Content-Type') ?? ''

    if (contentType.includes('text/csv')) {
      const text = await req.text()
      const url = new URL(req.url)
      campaignId = url.searchParams.get('campaign_id') ?? ''
      if (!campaignId) throw new Error('campaign_id query param required for CSV upload')
      days = parseCsv(text)
    } else {
      const body = await req.json() as { campaign_id?: string; days?: unknown }
      campaignId = body.campaign_id ?? ''
      if (!campaignId) throw new Error('campaign_id is required')
      if (!Array.isArray(body.days)) throw new Error('days must be an array')
      days = body.days as CampaignDayInput[]
    }
  } catch (err) {
    return json({ error: `Parse error: ${String(err)}` }, 400)
  }

  // --- Validate campaign_id and ownership ---
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, type, created_by')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign) {
    return json({ error: 'Campaign not found' }, 400)
  }
  if (campaign.created_by !== user.id) {
    return new Response('Forbidden', { status: 403, headers: CORS_HEADERS })
  }
  if (campaign.type === 'streak_challenge') {
    return json({ error: 'streak_challenge campaigns have no days to import' }, 400)
  }

  // --- Validate days ---
  if (days.length === 0) {
    return json({ error: 'days array is empty' }, 400)
  }
  if (days.length > 366) {
    return json({ error: 'Maximum 366 days per campaign' }, 400)
  }

  const seen = new Set<number>()
  for (const d of days) {
    if (!Number.isInteger(d.day_number) || d.day_number < 1) {
      return json({ error: `Invalid day_number: ${d.day_number}` }, 400)
    }
    if (seen.has(d.day_number)) {
      return json({ error: `Duplicate day_number: ${d.day_number}` }, 400)
    }
    seen.add(d.day_number)
  }

  // --- Upsert using service role so RLS insert policy isn't a blocker ---
  // We already verified ownership above using the user's JWT.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const rows = days.map((d) => ({
    campaign_id: campaignId,
    day_number: d.day_number,
    title: d.title ?? null,
    passage_ref: d.passage_ref ?? null,
    prompt: d.prompt ?? null,
    notes: d.notes ?? null,
  }))

  const { error: upsertErr } = await serviceClient
    .from('campaign_days')
    .upsert(rows, { onConflict: 'campaign_id,day_number' })

  if (upsertErr) {
    return json({ error: `DB error: ${upsertErr.message}` }, 500)
  }

  return json({ upserted: rows.length })
})
