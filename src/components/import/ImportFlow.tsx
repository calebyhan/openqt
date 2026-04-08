import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Loader2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SharingDrawer from '@/components/sharing/SharingDrawer'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TemplateSection, EntryContent } from '@/types/template'
import type { Tables } from '@/types/supabase'

type FileType = 'txt' | 'docx' | 'md' | 'paste'
type Step = 'input' | 'template' | 'processing' | 'review' | 'sharing'

interface TemplateRow extends Tables<'qt_templates'> {
  parsedSections: TemplateSection[]
}

const ACCEPTED_EXTENSIONS: Record<string, FileType> = {
  txt: 'txt',
  md: 'md',
  docx: 'docx',
}

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/** Read a file as base64 (for docx) or plain text (for txt/md). */
async function readFile(file: File, fileType: FileType): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    if (fileType === 'docx') {
      reader.onload = () => {
        const arr = reader.result as ArrayBuffer
        let binary = ''
        const bytes = new Uint8Array(arr)
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        resolve(btoa(binary))
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = () => resolve(reader.result as string)
      reader.readAsText(file)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

export default function ImportFlow() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('input')
  const [pasteText, setPasteText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<FileType>('paste')
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  const [processingError, setProcessingError] = useState<string | null>(null)
  const [rawText, setRawText] = useState('')
  const [mappedContent, setMappedContent] = useState<EntryContent>({})
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null)
  const [sharingOpen, setSharingOpen] = useState(false)

  // ── Step 1 → 2: move to template picker ──────────────────────────────────
  async function handleInputNext() {
    setTemplatesError(null)
    setTemplatesLoading(true)
    setStep('template')

    const { data, error } = await supabase
      .from('qt_templates')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user!.id}`)
      .order('is_system', { ascending: false })
      .order('name')

    setTemplatesLoading(false)
    if (error) {
      setTemplatesError('Could not load templates.')
      return
    }
    setTemplates(
      (data ?? []).map((t) => ({
        ...t,
        parsedSections: Array.isArray(t.sections)
          ? (t.sections as unknown as TemplateSection[])
          : [],
      })),
    )
  }

  // ── Step 2 → 3: pick template, call edge fn ───────────────────────────────
  async function handleTemplatePick(tmpl: TemplateRow) {
    setSelectedTemplate(tmpl)
    setProcessingError(null)
    setStep('processing')

    try {
      // Resolve content string
      let contentStr: string
      let resolvedFileType: FileType
      if (inputMode === 'upload' && uploadedFile) {
        resolvedFileType = fileType
        contentStr = await readFile(uploadedFile, resolvedFileType)
      } else {
        resolvedFileType = 'paste'
        contentStr = pasteText
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token ?? ''

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-entry`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: contentStr,
            file_type: resolvedFileType,
            template_id: tmpl.id,
          }),
        },
      )

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(errBody || `Request failed (${res.status})`)
      }

      const result = await res.json() as { content: EntryContent; plain_text: string }
      setMappedContent(result.content)
      setRawText(result.plain_text)
      setStep('review')
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : 'Import failed')
      setStep('template')
    }
  }

  // ── Step 4: save entry ────────────────────────────────────────────────────
  async function handleSave() {
    if (!user || !selectedTemplate) return
    setSaving(true)
    setSaveError(null)

    const { data, error } = await supabase
      .from('qt_entries')
      .insert({
        user_id: user.id,
        template_id: selectedTemplate.id,
        content: mappedContent,
        is_draft: false,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setSavedEntryId(data.id)
    setStep('sharing')
    setSharingOpen(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = fileExtension(file.name)
    const detectedType = ACCEPTED_EXTENSIONS[ext]
    if (!detectedType) return
    setUploadedFile(file)
    setFileType(detectedType)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const hasInput =
    inputMode === 'paste' ? pasteText.trim().length > 0 : uploadedFile !== null

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* ── Step 1: Input ── */}
      {step === 'input' && (
        <>
          <div>
            <h2 className="text-xl font-semibold">Import Entry</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste your journal text or upload a file — we'll map it to a template using AI.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                inputMode === 'paste'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setInputMode('paste')}
            >
              Paste text
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                inputMode === 'upload'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setInputMode('upload')}
            >
              Upload file
            </button>
          </div>

          {inputMode === 'paste' && (
            <textarea
              className="w-full h-56 rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Paste your journal entry here…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          )}

          {inputMode === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-10 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6" />
                <span>
                  {uploadedFile ? (
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <FileText className="h-4 w-4" />
                      {uploadedFile.name}
                    </span>
                  ) : (
                    'Click to upload .txt, .md, or .docx'
                  )}
                </span>
              </button>
            </div>
          )}

          <Button onClick={() => void handleInputNext()} disabled={!hasInput} className="w-full">
            Next — pick template
          </Button>
        </>
      )}

      {/* ── Step 2: Template picker ── */}
      {step === 'template' && (
        <>
          <div className="flex items-center gap-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setStep('input')}
            >
              <ChevronLeft className="inline h-4 w-4" /> Back
            </button>
            <h2 className="text-xl font-semibold">Choose a template</h2>
          </div>

          {processingError && (
            <p className="text-sm text-destructive">{processingError}</p>
          )}

          {templatesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
            </div>
          )}
          {templatesError && (
            <p className="text-sm text-destructive">{templatesError}</p>
          )}

          {!templatesLoading && !templatesError && (
            <div className="flex flex-col gap-3">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  className="rounded-lg border p-4 text-left hover:bg-accent"
                  onClick={() => void handleTemplatePick(tmpl)}
                >
                  <div className="font-medium">{tmpl.name}</div>
                  {tmpl.description && (
                    <div className="mt-0.5 text-sm text-muted-foreground">{tmpl.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Step 3: Processing ── */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="font-medium">Mapping your entry…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gemini is mapping your text to the template sections.
            </p>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 'review' && selectedTemplate && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Review</h2>
              <p className="text-sm text-muted-foreground">
                Edit any field before saving.
              </p>
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? 'Hide' : 'Show'} raw text
            </button>
          </div>

          {showRaw && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
              {rawText}
            </div>
          )}

          <div className="space-y-4">
            {selectedTemplate.parsedSections
              .filter((s) => s.type !== 'verse_picker')
              .map((section) => (
                <div key={section.key} className="space-y-1">
                  <label className="text-sm font-medium">{section.label}</label>
                  {section.type === 'text' ? (
                    <input
                      type="text"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={mappedContent[section.key] ?? ''}
                      onChange={(e) =>
                        setMappedContent((prev) => ({ ...prev, [section.key]: e.target.value }))
                      }
                      placeholder={section.placeholder}
                    />
                  ) : (
                    <textarea
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={4}
                      value={mappedContent[section.key] ?? ''}
                      onChange={(e) =>
                        setMappedContent((prev) => ({ ...prev, [section.key]: e.target.value }))
                      }
                      placeholder={section.placeholder}
                    />
                  )}
                </div>
              ))}

            {selectedTemplate.parsedSections.some((s) => s.type === 'verse_picker') && (
              <p className="text-xs text-muted-foreground">
                Verse references can be added after saving via the entry editor.
              </p>
            )}
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep('template')}
              disabled={saving}
            >
              Back
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save entry'
              )}
            </Button>
          </div>
        </>
      )}

      {/* ── Step 5: Sharing ── */}
      {step === 'sharing' && savedEntryId && (
        <>
          <div>
            <h2 className="text-xl font-semibold">Entry saved!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share it with your groups, or skip to go to your journal.
            </p>
          </div>

          <SharingDrawer
            entryId={savedEntryId}
            open={sharingOpen}
            onOpenChange={setSharingOpen}
            showTrigger={false}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setSharingOpen(true)}
            >
              Share with groups
            </Button>
            <Button onClick={() => navigate('/entries')} className="flex-1">
              Go to journal
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
