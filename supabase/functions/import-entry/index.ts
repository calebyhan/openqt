import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import mammoth from 'npm:mammoth@1'
import { marked } from 'npm:marked@12'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

interface ImportRequest {
  /** Raw text for txt/paste; base64-encoded bytes for docx */
  content: string
  file_type: 'txt' | 'docx' | 'md' | 'paste'
  template_id: string
}

interface TemplateSection {
  key: string
  label: string
  type: 'text' | 'rich_text' | 'verse_picker'
  placeholder?: string
  required?: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  // Auth
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const callerClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authErr } = await callerClient.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  let body: ImportRequest
  try {
    body = await req.json() as ImportRequest
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS })
  }

  const { content, file_type, template_id } = body
  if (!content || !file_type || !template_id) {
    return new Response('Missing required fields', { status: 400, headers: CORS_HEADERS })
  }

  // Fetch template sections
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: template, error: tErr } = await adminClient
    .from('qt_templates')
    .select('sections')
    .eq('id', template_id)
    .single()

  if (tErr || !template) {
    return new Response('Template not found', { status: 404, headers: CORS_HEADERS })
  }

  const sections = template.sections as TemplateSection[]

  // Step 1: Convert input to plain text
  let plainText: string
  try {
    if (file_type === 'docx') {
      // content is base64-encoded docx bytes
      const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer })
      plainText = result.value
    } else if (file_type === 'md') {
      // Strip markdown to plain text
      const html = await marked(content)
      plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    } else {
      // txt or paste — already plain text
      plainText = content
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Failed to parse file: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Step 2: Build Gemini prompt
  // Filter out verse_picker sections — Gemini maps text content only
  const mappableSections = sections.filter((s) => s.type !== 'verse_picker')
  const sectionDefs = mappableSections.map((s) => ({
    key: s.key,
    label: s.label,
    type: s.type,
  }))

  const prompt = `You are helping a user import a quiet time journal entry into a structured template.

Template sections:
${JSON.stringify(sectionDefs, null, 2)}

Raw journal text:
${plainText}

Map the content to the template sections. Return ONLY valid JSON with section keys as keys and extracted content as values. If a section has no matching content, use an empty string. Do not include any explanation or markdown.`

  // Step 3: Call Gemini
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiApiKey) {
    return new Response('Gemini API key not configured', { status: 503, headers: CORS_HEADERS })
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  )

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    return new Response(
      JSON.stringify({ error: `Gemini error: ${errText}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const geminiJson = await geminiRes.json()
  const rawOutput: string =
    geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  // Step 4: Parse + validate against section keys
  let mapped: Record<string, string>
  try {
    mapped = JSON.parse(rawOutput) as Record<string, string>
  } catch {
    return new Response(
      JSON.stringify({ error: 'Gemini returned invalid JSON', raw: rawOutput }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Keep only keys that exist in the template; ensure all keys present
  const validKeys = new Set(mappableSections.map((s) => s.key))
  const result: Record<string, string> = {}
  for (const s of mappableSections) {
    const val = mapped[s.key]
    result[s.key] = typeof val === 'string' ? val : ''
  }
  // Discard any extra keys Gemini hallucinated
  for (const k of Object.keys(mapped)) {
    if (!validKeys.has(k)) delete mapped[k]
  }

  return new Response(
    JSON.stringify({ content: result, plain_text: plainText }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
