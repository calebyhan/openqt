import { useState, useEffect } from 'react'
import { ChevronLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchBooks, fetchChapters, fetchPassage } from '@/lib/bible'
import { useAuthStore } from '@/store/authStore'
import type { BibleBook, BibleChapter, BiblePassage } from '@/types/bible'

const TRANSLATIONS = ['NIV2011', 'ESV', 'NLT', 'NASB', 'NKJV', 'KJV', 'ASV', 'WEB']
const TRANSLATION_LABELS: Record<string, string> = { NIV2011: 'NIV' }

type View = 'books' | 'chapters' | 'passage'

interface Props {
  /** Called with a citation string like "JHN 3:16" when the user inserts a verse */
  onInsertVerse?: (citation: string) => void
  defaultTranslation?: string
  onTranslationChange?: (translation: string) => void
}

export default function BibleReader({
  onInsertVerse,
  defaultTranslation = 'NIV2011',
  onTranslationChange,
}: Props) {
  const [translation, setTranslation] = useState(defaultTranslation)
  const [view, setView] = useState<View>('books')
  const [books, setBooks] = useState<BibleBook[]>([])
  const [chapters, setChapters] = useState<BibleChapter[]>([])
  const [passage, setPassage] = useState<BiblePassage | null>(null)
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<BibleChapter | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Verse insertion: user types a verse number to insert
  const [verseInput, setVerseInput] = useState('')

  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)

  useEffect(() => {
    if (authLoading || !session) return
    setLoading(true)
    setError(null)
    fetchBooks()
      .then((data: BibleBook[]) => setBooks(data))
      .catch(() => setError('Could not load books. Check your connection.'))
      .finally(() => setLoading(false))
  }, [session, authLoading])

  async function selectBook(book: BibleBook) {
    setSelectedBook(book)
    setView('chapters')
    setLoading(true)
    setError(null)
    try {
      const data: BibleChapter[] = await fetchChapters(book.id)
      // Remove the intro chapter (id ends with ".intro")
      setChapters(data.filter((c) => !c.id.endsWith('.intro')))
    } catch {
      setError('Could not load chapters.')
    } finally {
      setLoading(false)
    }
  }

  async function selectChapter(chapter: BibleChapter) {
    setSelectedChapter(chapter)
    setView('passage')
    setVerseInput('')
    setLoading(true)
    setError(null)
    try {
      const data: BiblePassage = await fetchPassage(chapter.id, translation)
      setPassage(data)
    } catch {
      setError('Could not load passage.')
    } finally {
      setLoading(false)
    }
  }

  function handleTranslationChange(t: string) {
    setTranslation(t)
    onTranslationChange?.(t)
    // Re-fetch current passage in new translation
    if (view === 'passage' && selectedChapter) {
      selectChapter(selectedChapter)
    }
  }

  function handleInsert() {
    if (!selectedBook || !selectedChapter || !onInsertVerse) return
    const verseNum = parseInt(verseInput, 10)
    if (isNaN(verseNum) || verseNum < 1) return
    const citation = `[${selectedBook.abbreviation} ${selectedChapter.number}:${verseNum}]`
    onInsertVerse(citation)
    setVerseInput('')
  }

  const filteredBooks = books.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {view !== 'books' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              if (view === 'passage') setView('chapters')
              else setView('books')
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <span className="flex-1 truncate text-sm font-medium">
          {view === 'books' && 'Bible'}
          {view === 'chapters' && selectedBook?.name}
          {view === 'passage' &&
            `${selectedBook?.abbreviation} ${selectedChapter?.number}`}
        </span>
        <Select value={translation} onValueChange={handleTranslationChange}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue>{TRANSLATION_LABELS[translation] ?? translation}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TRANSLATIONS.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {TRANSLATION_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {error && !loading && (
          <div className="p-4 text-sm text-destructive">{error}</div>
        )}

        {/* Book list */}
        {!loading && !error && view === 'books' && (
          <>
            <div className="sticky top-0 z-10 bg-background px-3 pb-2 pt-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-sm"
                  placeholder="Search books…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ul>
              {filteredBooks.map((book) => (
                <li key={book.id}>
                  <button
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent"
                    onClick={() => selectBook(book)}
                  >
                    {book.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Chapter grid */}
        {!loading && !error && view === 'chapters' && (
          <div className="grid grid-cols-5 gap-2 p-3">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                className="rounded-md border py-2 text-center text-sm hover:bg-accent"
                onClick={() => selectChapter(ch)}
              >
                {ch.number}
              </button>
            ))}
          </div>
        )}

        {/* Passage display */}
        {!loading && !error && view === 'passage' && passage && (
          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {passage.reference} · {translation}
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {passage.content}
            </div>
          </div>
        )}
      </div>

      {/* Verse insertion footer — only shown in editor context */}
      {onInsertVerse && view === 'passage' && !loading && (
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">Verse</span>
          <Input
            className="h-7 w-16 text-center text-sm"
            type="number"
            min={1}
            value={verseInput}
            onChange={(e) => setVerseInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
            placeholder="1"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!verseInput}
            onClick={handleInsert}
          >
            Insert
          </Button>
        </div>
      )}
    </div>
  )
}
