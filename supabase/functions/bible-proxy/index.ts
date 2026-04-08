import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOLLS_BASE = 'https://bolls.life'

// Standard English names and abbreviations for the 66 canonical books (1-indexed).
const BOOK_NAMES: Record<number, string> = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
  6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
  11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
  15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
  20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
  24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
  28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
  33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
  38: 'Zechariah', 39: 'Malachi', 40: 'Matthew', 41: 'Mark', 42: 'Luke',
  43: 'John', 44: 'Acts', 45: 'Romans', 46: '1 Corinthians',
  47: '2 Corinthians', 48: 'Galatians', 49: 'Ephesians', 50: 'Philippians',
  51: 'Colossians', 52: '1 Thessalonians', 53: '2 Thessalonians',
  54: '1 Timothy', 55: '2 Timothy', 56: 'Titus', 57: 'Philemon',
  58: 'Hebrews', 59: 'James', 60: '1 Peter', 61: '2 Peter', 62: '1 John',
  63: '2 John', 64: '3 John', 65: 'Jude', 66: 'Revelation',
}

// Used to build verse citations like "Jhn 3:16".
const BOOK_ABBREVIATIONS: Record<number, string> = {
  1: 'Gen', 2: 'Exo', 3: 'Lev', 4: 'Num', 5: 'Deu', 6: 'Jos', 7: 'Jdg',
  8: 'Rut', 9: '1Sa', 10: '2Sa', 11: '1Ki', 12: '2Ki', 13: '1Ch', 14: '2Ch',
  15: 'Ezr', 16: 'Neh', 17: 'Est', 18: 'Job', 19: 'Psa', 20: 'Pro',
  21: 'Ecc', 22: 'Sng', 23: 'Isa', 24: 'Jer', 25: 'Lam', 26: 'Eze',
  27: 'Dan', 28: 'Hos', 29: 'Joe', 30: 'Amo', 31: 'Oba', 32: 'Jon',
  33: 'Mic', 34: 'Nah', 35: 'Hab', 36: 'Zep', 37: 'Hag', 38: 'Zec',
  39: 'Mal', 40: 'Mat', 41: 'Mrk', 42: 'Luk', 43: 'Jhn', 44: 'Act',
  45: 'Rom', 46: '1Co', 47: '2Co', 48: 'Gal', 49: 'Eph', 50: 'Php',
  51: 'Col', 52: '1Th', 53: '2Th', 54: '1Ti', 55: '2Ti', 56: 'Tit',
  57: 'Phm', 58: 'Heb', 59: 'Jas', 60: '1Pe', 61: '2Pe', 62: '1Jn',
  63: '2Jn', 64: '3Jn', 65: 'Jud', 66: 'Rev',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

async function bollsFetch(path: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const res = await fetch(`${BOLLS_BASE}${path}`, {
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`bolls.life ${res.status}: ${body}`)
  }
  return res.json()
}

/** Strip HTML tags returned by Bolls (e.g. <e>, <pb>, <br/>) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
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
  const path = url.pathname.replace(/.*\/bible-proxy/, '') || '/'

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  try {
    // GET /books — list all books (translation-independent for the 66 canon books)
    if (req.method === 'GET' && path === '/books') {
      const translation = url.searchParams.get('translation') ?? 'NIV'
      const raw: Array<{ bookid: number; name: string; chapters: number }> =
        await bollsFetch(`/get-books/${translation}/`)
      const books = raw
        .filter((b) => b.bookid >= 1 && b.bookid <= 66)
        .map((b) => ({
          id: String(b.bookid),
          bibleId: translation,
          name: b.name,
          nameLong: b.name,
          abbreviation: BOOK_ABBREVIATIONS[b.bookid] ?? b.name.slice(0, 3),
        }))
      return json(books)
    }

    // GET /chapters/:bookId — generate chapter list from book's chapter count
    const chaptersMatch = path.match(/^\/chapters\/(\d+)$/)
    if (req.method === 'GET' && chaptersMatch) {
      const bookId = parseInt(chaptersMatch[1], 10)
      const translation = url.searchParams.get('translation') ?? 'NIV'
      const raw: Array<{ bookid: number; name: string; chapters: number }> =
        await bollsFetch(`/get-books/${translation}/`)
      const book = raw.find((b) => b.bookid === bookId)
      if (!book) return json({ error: 'Book not found' }, 404)
      const chapters = Array.from({ length: book.chapters }, (_, i) => ({
        id: `${bookId}:${i + 1}`,
        bibleId: translation,
        bookId: String(bookId),
        number: String(i + 1),
        reference: `${book.name} ${i + 1}`,
      }))
      return json(chapters)
    }

    // GET /passage?ref=43:3&translation=NIV
    // ref format: "{bookId}:{chapterNum}"
    if (req.method === 'GET' && path === '/passage') {
      const ref = url.searchParams.get('ref') ?? ''
      const translation = url.searchParams.get('translation') ?? 'NIV'
      const [bookIdStr, chapterStr] = ref.split(':')
      const bookId = parseInt(bookIdStr, 10)
      const chapter = parseInt(chapterStr, 10)
      if (isNaN(bookId) || isNaN(chapter)) {
        return json({ error: 'Invalid ref' }, 400)
      }
      const verses: Array<{ pk: number; verse: number; text: string }> =
        await bollsFetch(`/get-text/${translation}/${bookId}/${chapter}/`)
      const content = verses
        .map((v) => `[${v.verse}] ${stripHtml(v.text)}`)
        .join('\n')
      const bookName = BOOK_NAMES[bookId] ?? ''
      return json({
        id: ref,
        bibleId: translation,
        reference: `${bookName} ${chapter}`,
        content,
        verseCount: verses.length,
      })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
