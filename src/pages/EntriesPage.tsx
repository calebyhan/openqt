import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'

type EntryRow = Tables<'qt_entries'>

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function EntriesPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('qt_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('Could not load entries.')
        else setEntries(data ?? [])
        setLoading(false)
      })
  }, [user])

  return (
    <AppLayout>
      <div className="px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Journal</h2>
          <Button size="sm" onClick={() => navigate('/write')}>
            <PenLine className="mr-1.5 h-3.5 w-3.5" />
            New entry
          </Button>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && entries.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-muted-foreground">No entries yet.</p>
            <Button onClick={() => navigate('/write')}>Write your first entry</Button>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={`/entries/${entry.id}`}
                  className="block rounded-lg border p-4 hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {entry.title || formatDate(entry.created_at)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
