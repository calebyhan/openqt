import { supabase } from '@/lib/supabase'

const BIBLE_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bible-proxy`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchBooks() {
  const headers = await authHeaders()
  const res = await fetch(`${BIBLE_PROXY}/books`, { headers })
  if (!res.ok) throw new Error('Failed to fetch books')
  return res.json()
}

export async function fetchChapters(bookId: string) {
  const headers = await authHeaders()
  const res = await fetch(`${BIBLE_PROXY}/chapters/${bookId}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch chapters')
  return res.json()
}

export async function fetchPassage(ref: string, translation = 'NIV') {
  const headers = await authHeaders()
  const params = new URLSearchParams({ ref, translation })
  const res = await fetch(`${BIBLE_PROXY}/passage?${params}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch passage')
  return res.json()
}
