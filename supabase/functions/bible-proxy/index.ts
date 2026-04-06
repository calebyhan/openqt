import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const API_BASE = 'https://api.scripture.api.bible/v1'
const BIBLE_API_KEY = Deno.env.get('BIBLE_API_KEY') ?? ''

// Map common translation abbreviations to api.bible Bible IDs.
// IDs sourced from api.bible documentation (non-commercial use).
const BIBLE_IDS: Record<string, string> = {
  NIV: 'de4e12af7f28f599-02',
  ESV: '9879dbb7cfe39e4d-01',
  KJV: 'de4e12af7f28f599-01',
  NLT: '65eec8e0b60e656b-01',
  NASB: 'f72b840c855f362c-04',
  CSB: 'a556c5305ee15c3d-01',
}
const DEFAULT_BIBLE_ID = BIBLE_IDS.NIV

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

async function apiBibleFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'api-key': BIBLE_API_KEY },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`api.bible ${res.status}: ${body}`)
  }
  return res.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // Verify caller has a valid Supabase session.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  // Strip everything up to and including "/bible-proxy" to get the sub-path.
  const path = url.pathname.replace(/.*\/bible-proxy/, '') || '/'

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  try {
    // GET /books — list all books for the default translation
    if (req.method === 'GET' && path === '/books') {
      const data = await apiBibleFetch(`/bibles/${DEFAULT_BIBLE_ID}/books`)
      return json(data.data)
    }

    // GET /chapters/:bookId — list chapters for a book
    const chaptersMatch = path.match(/^\/chapters\/([A-Z0-9]+)$/)
    if (req.method === 'GET' && chaptersMatch) {
      const bookId = chaptersMatch[1]
      const data = await apiBibleFetch(
        `/bibles/${DEFAULT_BIBLE_ID}/books/${bookId}/chapters`,
      )
      return json(data.data)
    }

    // GET /passage?ref=JHN.3.16&translation=NIV
    if (req.method === 'GET' && path === '/passage') {
      const ref = url.searchParams.get('ref') ?? ''
      const translation = url.searchParams.get('translation') ?? 'NIV'
      const bibleId = BIBLE_IDS[translation] ?? DEFAULT_BIBLE_ID
      const params = new URLSearchParams({
        'content-type': 'text',
        'include-notes': 'false',
        'include-titles': 'false',
        'include-chapter-numbers': 'false',
        'include-verse-numbers': 'true',
        'include-verse-spans': 'false',
      })
      const data = await apiBibleFetch(
        `/bibles/${bibleId}/passages/${encodeURIComponent(ref)}?${params}`,
      )
      return json(data.data)
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
