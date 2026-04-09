import { useEffect, useState } from 'react'
import { ChevronLeft, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Tables } from '@/types/supabase'
import type { TemplateSection } from '@/types/template'

type TemplateRow = Tables<'qt_templates'>
type SectionType = TemplateSection['type']
type View = 'list' | 'edit'

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'rich_text', label: 'Rich text' },
  { value: 'verse_picker', label: 'Verse picker' },
]

function emptySection(): TemplateSection {
  return { key: crypto.randomUUID().slice(0, 8), label: '', type: 'rich_text' }
}

interface EditState {
  id: string | null  // null = new template
  name: string
  description: string
  sections: TemplateSection[]
}

function blankEdit(): EditState {
  return { id: null, name: '', description: '', sections: [emptySection()] }
}

export default function TemplatesPage() {
  const { user } = useAuthStore()
  const [view, setView] = useState<View>('list')
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState>(blankEdit())

  useEffect(() => {
    if (!user) return
    supabase
      .from('qt_templates')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('name')
      .then(({ data }) => {
        setTemplates(data ?? [])
        setLoading(false)
      })
  }, [user])

  function startNew() {
    setEdit(blankEdit())
    setError(null)
    setView('edit')
  }

  function startEdit(tmpl: TemplateRow) {
    setEdit({
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description ?? '',
      sections: Array.isArray(tmpl.sections)
        ? (tmpl.sections as unknown as TemplateSection[])
        : [emptySection()],
    })
    setError(null)
    setView('edit')
  }

  function updateSection(idx: number, patch: Partial<TemplateSection>) {
    setEdit((prev) => {
      const sections = [...prev.sections]
      sections[idx] = { ...sections[idx], ...patch }
      return { ...prev, sections }
    })
  }

  function addSection() {
    setEdit((prev) => ({ ...prev, sections: [...prev.sections, emptySection()] }))
  }

  function removeSection(idx: number) {
    setEdit((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx),
    }))
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setEdit((prev) => {
      const sections = [...prev.sections]
      const swap = idx + dir
      if (swap < 0 || swap >= sections.length) return prev
      ;[sections[idx], sections[swap]] = [sections[swap], sections[idx]]
      return { ...prev, sections }
    })
  }

  async function handleSave() {
    if (!user) return
    setError(null)

    if (!edit.name.trim()) {
      setError('Template name is required.')
      return
    }
    if (edit.sections.length === 0) {
      setError('Add at least one section.')
      return
    }
    const emptyLabel = edit.sections.find((s) => !s.label.trim())
    if (emptyLabel) {
      setError('All sections need a label.')
      return
    }

    setSaving(true)
    const payload = {
      name: edit.name.trim(),
      description: edit.description.trim() || null,
      sections: edit.sections as unknown as TemplateRow['sections'],
      created_by: user.id,
      is_system: false,
    }

    if (edit.id) {
      const { error: err } = await supabase
        .from('qt_templates')
        .update(payload)
        .eq('id', edit.id)
        .eq('created_by', user.id)
      setSaving(false)
      if (err) { setError(err.message); return }
      setTemplates((prev) =>
        prev.map((t) => (t.id === edit.id ? { ...t, ...payload } : t)),
      )
    } else {
      const { data, error: err } = await supabase
        .from('qt_templates')
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (err || !data) { setError(err?.message ?? 'Save failed'); return }
      setTemplates((prev) => [...prev, data])
    }
    setView('list')
  }

  async function handleDelete(id: string) {
    if (!user) return
    const { error: err } = await supabase
      .from('qt_templates')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)
    if (!err) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <AppLayout>
        <div className="px-4 py-6 space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Custom Templates</h2>
            <Button size="sm" onClick={startNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!loading && (
            <div className="space-y-2">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tmpl.name}</div>
                    {tmpl.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {tmpl.description}
                      </div>
                    )}
                    {tmpl.is_system && (
                      <span className="text-xs text-muted-foreground">Built-in</span>
                    )}
                  </div>
                  {!tmpl.is_system && (
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(tmpl)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${tmpl.name}`}
                        onClick={() => void handleDelete(tmpl.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    )
  }

  // ── Edit view ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setView('list')}
          >
            <ChevronLeft className="inline h-4 w-4" /> Templates
          </button>
          <h2 className="text-xl font-semibold">
            {edit.id ? 'Edit template' : 'New template'}
          </h2>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="tmpl-name">
            Name
          </label>
          <input
            id="tmpl-name"
            type="text"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. SOAP, Lectio Divina"
            value={edit.name}
            onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="tmpl-desc">
            Description{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="tmpl-desc"
            type="text"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Shown in the template picker"
            value={edit.description}
            onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* Sections */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sections</span>
            <button
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={addSection}
            >
              <Plus className="h-3.5 w-3.5" /> Add section
            </button>
          </div>

          {edit.sections.map((section, idx) => (
            <div key={section.key} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move section up"
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                  >
                    <GripVertical className="h-4 w-4 -rotate-90" />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move section down"
                    disabled={idx === edit.sections.length - 1}
                    onClick={() => moveSection(idx, 1)}
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground flex-1">
                  Section {idx + 1}
                </span>
                {edit.sections.length > 1 && (
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove section"
                    onClick={() => removeSection(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Label</label>
                  <input
                    type="text"
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Observation"
                    value={section.label}
                    onChange={(e) => updateSection(idx, { label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={section.type}
                    onChange={(e) =>
                      updateSection(idx, { type: e.target.value as SectionType })
                    }
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Placeholder <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Hint text shown in the empty field"
                  value={section.placeholder ?? ''}
                  onChange={(e) =>
                    updateSection(idx, { placeholder: e.target.value || undefined })
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={section.required ?? false}
                  onChange={(e) => updateSection(idx, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setView('list')} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Save template'
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
