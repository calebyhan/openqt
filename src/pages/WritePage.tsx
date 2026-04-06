import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import SplitPaneEditor from '@/components/editor/SplitPaneEditor'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'
import type { TemplateSection } from '@/types/template'

interface TemplateRow extends Tables<'qt_templates'> {
  parsedSections: TemplateSection[]
}

type Step = 'picking' | 'editing'

export default function WritePage() {
  const { entryId } = useParams<{ entryId?: string }>()
  const { user } = useAuthStore()

  const [step, setStep] = useState<Step>(entryId ? 'editing' : 'picking')
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null)
  const [existingEntry, setExistingEntry] = useState<Tables<'qt_entries'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load templates (always needed)
  useEffect(() => {
    if (!user) return
    supabase
      .from('qt_templates')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('name')
      .then(({ data, error: err }) => {
        if (err) {
          setError('Could not load templates.')
          return
        }
        const rows: TemplateRow[] = (data ?? []).map((t) => ({
          ...t,
          parsedSections: Array.isArray(t.sections)
            ? (t.sections as unknown as TemplateSection[])
            : [],
        }))
        setTemplates(rows)

        // If editing, load entry first
        if (!entryId) {
          setLoading(false)
        }
      })
  }, [user, entryId])

  // Load existing entry when editing
  useEffect(() => {
    if (!entryId || !user) return
    supabase
      .from('qt_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Entry not found.')
          setLoading(false)
          return
        }
        setExistingEntry(data)
        setLoading(false)
      })
  }, [entryId, user])

  // Once both entry and templates are loaded, find matching template
  useEffect(() => {
    if (!existingEntry || templates.length === 0) return
    const tmpl = templates.find((t) => t.id === existingEntry.template_id)
    if (tmpl) {
      setSelectedTemplate(tmpl)
      setStep('editing')
    } else {
      setError('Template for this entry could not be found.')
    }
  }, [existingEntry, templates])

  function pickTemplate(tmpl: TemplateRow) {
    setSelectedTemplate(tmpl)
    setStep('editing')
  }

  if (error) {
    return (
      <AppLayout>
        <div className="px-4 py-6 text-sm text-destructive">{error}</div>
      </AppLayout>
    )
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

  // Template picker step
  if (step === 'picking') {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <h2 className="mb-1 text-xl font-semibold">New Entry</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose a template to get started.
          </p>
          <div className="flex flex-col gap-3">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                className="rounded-lg border p-4 text-left hover:bg-accent"
                onClick={() => pickTemplate(tmpl)}
              >
                <div className="font-medium">{tmpl.name}</div>
                {tmpl.description && (
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {tmpl.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  // Editor step — full height, no extra padding
  if (!selectedTemplate) return null

  return (
    <div className="flex h-screen flex-col">
      {/* Minimal top bar with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setStep('picking')}
        >
          ← Templates
        </button>
        <span className="text-sm font-medium">{selectedTemplate.name}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <SplitPaneEditor
          templateId={selectedTemplate.id}
          sections={selectedTemplate.parsedSections}
          entry={existingEntry}
        />
      </div>
    </div>
  )
}
