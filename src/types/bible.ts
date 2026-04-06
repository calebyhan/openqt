export interface BibleBook {
  id: string
  bibleId: string
  name: string
  nameLong: string
  abbreviation: string
}

export interface BibleChapter {
  id: string
  bibleId: string
  bookId: string
  number: string
  reference: string
}

export interface BiblePassage {
  id: string
  bibleId: string
  reference: string
  content: string
  verseCount: number
}

export interface VerseRef {
  book: string       // OSIS abbreviation e.g. "JHN"
  chapter: number
  verse: number
  text: string
  translation: string
}
