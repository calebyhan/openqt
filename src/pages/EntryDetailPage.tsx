import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Pencil } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import TemplateForm from '@/components/editor/TemplateForm'
import SharingDrawer from '@/components/sharing/SharingDrawer'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'
import type { TemplateSection, EntryContent } from '@/types/template'
import type { VerseRef } from '@/types/bible'

export default function EntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [entry, setEntry] = useState<Tables<'qt_entries'> | null>(null)
  const [sections, setSections] = useState<TemplateSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!entryId || !user) return

    async function load() {
      const { data: entryData, error: entryErr } = await supabase
        .from('qt_entries')
        .select('*')
        .eq('id', entryId!)
        .single()

      if (entryErr || !entryData) {
        setError('Entry not found.')
        setLoading(false)
        return
      }
      setEntry(entryData)

      const { data: tmpl, error: tmplErr } = await supabase
        .from('qt_templates')
        .select('sections')
        .eq('id', entryData.template_id)
        .single()

      if (tmplErr || !tmpl) {
        setError('Template not found.')
        setLoading(false)
        return
      }

      setSections(
        Array.isArray(tmpl.sections)
          ? (tmpl.sections as unknown as TemplateSection[])
          : [],
      )
      setLoading(false)
    }

    load()
  }, [entryId, user])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </AppLayout>
    )
  }

  if (error || !entry) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <p className="text-sm text-destructive">{error ?? 'Entry not found.'}</p>
          <Link to="/entries" className="mt-2 inline-block text-sm text-primary hover:underline">
            Back to journal
          </Link>
        </div>
      </AppLayout>
    )
  }

  const entryContent =
    entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content)
      ? (entry.content as EntryContent)
      : {}

  const entryVerseRefs =
    entry.verse_refs &&
    typeof entry.verse_refs === 'object' &&
    !Array.isArray(entry.verse_refs)
      ? (entry.verse_refs as Record<string, VerseRef[]>)
      : {}

  const isOwn = entry.user_id === user?.id

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {isOwn && (
            <div className="flex gap-2">
              <SharingDrawer entryId={entry.id} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/write/${entry.id}`)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          )}
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {formatDate(entry.created_at)}
        </p>

        <TemplateForm
          sections={sections}
          content={entryContent}
          verseRefs={entryVerseRefs}
          onChange={() => {}}
          onVerseRefsChange={() => {}}
          onFocusSection={() => {}}
          activeSectionKey={null}
          readOnly
        />
      </div>
    </AppLayout>
  )
}
