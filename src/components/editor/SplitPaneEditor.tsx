import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, PenLine, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import BibleReader from '@/components/bible/BibleReader'
import TemplateForm, { type TemplateFormHandle } from '@/components/editor/TemplateForm'
import type { TemplateSection, EntryContent } from '@/types/template'
import type { VerseRef } from '@/types/bible'
import type { Tables } from '@/types/supabase'

type MobilePane = 'write' | 'bible'

interface Props {
  templateId: string
  sections: TemplateSection[]
  /** Existing entry to edit; null for new entry */
  entry?: Tables<'qt_entries'> | null
  defaultTranslation?: string
}

const AUTO_SAVE_INTERVAL_MS = 30_000

export default function SplitPaneEditor({
  templateId,
  sections,
  entry = null,
  defaultTranslation = 'NIV',
}: Props) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const formRef = useRef<TemplateFormHandle>(null)

  // Form state
  const [content, setContent] = useState<EntryContent>(() => {
    if (entry?.content && typeof entry.content === 'object' && !Array.isArray(entry.content)) {
      return entry.content as EntryContent
    }
    return {}
  })
  const [verseRefs, setVerseRefs] = useState<Record<string, VerseRef[]>>(() => {
    if (entry?.verse_refs && typeof entry.verse_refs === 'object' && !Array.isArray(entry.verse_refs)) {
      return entry.verse_refs as Record<string, VerseRef[]>
    }
    return {}
  })
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>('write')

  // Save state
  const [entryId, setEntryId] = useState<string | null>(entry?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const contentRef = useRef(content)
  const verseRefsRef = useRef(verseRefs)
  contentRef.current = content
  verseRefsRef.current = verseRefs

  const saveDraft = useCallback(
    async (isDraft: boolean) => {
      if (!user) return
      setSaving(true)
      setSaveError(null)
      try {
        const payload = {
          template_id: templateId,
          user_id: user.id,
          content: contentRef.current,
          verse_refs: verseRefsRef.current,
          is_draft: isDraft,
          updated_at: new Date().toISOString(),
        }
        if (entryId) {
          const { error } = await supabase
            .from('qt_entries')
            .update(payload)
            .eq('id', entryId)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('qt_entries')
            .insert(payload)
            .select('id')
            .single()
          if (error) throw error
          setEntryId(data.id)
        }
        setLastSaved(new Date())
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [user, templateId, entryId],
  )

  // Auto-save every 30s as draft
  useEffect(() => {
    const id = setInterval(() => saveDraft(true), AUTO_SAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [saveDraft])

  function handleContentChange(key: string, value: string) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  function handleVerseRefsChange(key: string, refs: VerseRef[]) {
    setVerseRefs((prev) => ({ ...prev, [key]: refs }))
  }

  function handleInsertVerse(citation: string) {
    if (!activeSectionKey) return
    const activeSection = sections.find((s) => s.key === activeSectionKey)
    if (!activeSection) return

    if (activeSection.type === 'rich_text' || activeSection.type === 'text') {
      formRef.current?.insertIntoActive(citation)
    } else if (activeSection.type === 'verse_picker') {
      // Parse citation [ABBREV CH:V] to VerseRef
      const match = citation.match(/^\[(\S+)\s+(\d+):(\d+)\]$/)
      if (match) {
        const ref: VerseRef = {
          book: match[1],
          chapter: parseInt(match[2], 10),
          verse: parseInt(match[3], 10),
          text: '',
          translation: defaultTranslation,
        }
        formRef.current?.addVerseRef(activeSectionKey, ref)
      }
    }
  }

  async function handleSave() {
    await saveDraft(false)
    navigate('/entries')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="text-sm text-muted-foreground">
          {saving && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
          {!saving && lastSaved && (
            <span>
              Saved{' '}
              {lastSaved.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          {!saving && saveError && (
            <span className="text-destructive">{saveError}</span>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Save
        </Button>
      </div>

      {/* Mobile pane toggle */}
      <div className="flex border-b md:hidden">
        <button
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-2 text-sm',
            mobilePane === 'write'
              ? 'border-b-2 border-primary font-medium text-primary'
              : 'text-muted-foreground',
          )}
          onClick={() => setMobilePane('write')}
        >
          <PenLine className="h-4 w-4" />
          Write
        </button>
        <button
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-2 text-sm',
            mobilePane === 'bible'
              ? 'border-b-2 border-primary font-medium text-primary'
              : 'text-muted-foreground',
          )}
          onClick={() => setMobilePane('bible')}
        >
          <BookOpen className="h-4 w-4" />
          Bible
        </button>
      </div>

      {/* Split panes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — template form */}
        <div
          className={cn(
            'flex-1 overflow-y-auto',
            mobilePane === 'bible' ? 'hidden md:block' : 'block',
          )}
        >
          <TemplateForm
            ref={formRef}
            sections={sections}
            content={content}
            verseRefs={verseRefs}
            onChange={handleContentChange}
            onVerseRefsChange={handleVerseRefsChange}
            onFocusSection={setActiveSectionKey}
            activeSectionKey={activeSectionKey}
          />
        </div>

        {/* Divider */}
        <div className="hidden w-px bg-border md:block" />

        {/* Right — Bible reader */}
        <div
          className={cn(
            'w-full overflow-hidden md:w-80 lg:w-96',
            mobilePane === 'write' ? 'hidden md:flex md:flex-col' : 'flex flex-col',
          )}
        >
          <BibleReader
            onInsertVerse={handleInsertVerse}
            defaultTranslation={defaultTranslation}
          />
        </div>
      </div>
    </div>
  )
}
