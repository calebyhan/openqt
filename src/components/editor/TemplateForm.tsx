import { forwardRef, useImperativeHandle, useRef } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RichTextEditor, { type RichTextEditorHandle } from '@/components/editor/RichTextEditor'
import type { TemplateSection, EntryContent } from '@/types/template'
import type { VerseRef } from '@/types/bible'

export interface TemplateFormHandle {
  /** Insert text (e.g. a verse citation) into the currently active rich_text section. */
  insertIntoActive: (text: string) => void
  /** Insert a verse ref into a verse_picker section by key. */
  addVerseRef: (sectionKey: string, ref: VerseRef) => void
}

interface Props {
  sections: TemplateSection[]
  content: EntryContent
  verseRefs: Record<string, VerseRef[]>
  onChange: (key: string, value: string) => void
  onVerseRefsChange: (key: string, refs: VerseRef[]) => void
  onFocusSection: (key: string) => void
  activeSectionKey: string | null
  readOnly?: boolean
}

const TemplateForm = forwardRef<TemplateFormHandle, Props>(
  (
    {
      sections,
      content,
      verseRefs,
      onChange,
      onVerseRefsChange,
      onFocusSection,
      activeSectionKey,
      readOnly = false,
    },
    ref,
  ) => {
    // One ref per rich_text section
    const editorRefs = useRef<Map<string, React.RefObject<RichTextEditorHandle>>>(new Map())

    function getOrCreateEditorRef(key: string) {
      if (!editorRefs.current.has(key)) {
        editorRefs.current.set(key, { current: null })
      }
      return editorRefs.current.get(key)!
    }

    useImperativeHandle(ref, () => ({
      insertIntoActive: (text) => {
        if (!activeSectionKey) return
        editorRefs.current.get(activeSectionKey)?.current?.insertText(text)
      },
      addVerseRef: (sectionKey, verseRef) => {
        const existing = verseRefs[sectionKey] ?? []
        onVerseRefsChange(sectionKey, [...existing, verseRef])
      },
    }))

    function removeVerseRef(sectionKey: string, index: number) {
      const updated = (verseRefs[sectionKey] ?? []).filter((_, i) => i !== index)
      onVerseRefsChange(sectionKey, updated)
    }

    return (
      <div className="flex flex-col gap-6 p-4">
        {sections.map((section) => (
          <div key={section.key} className="flex flex-col gap-1.5">
            <Label htmlFor={section.key} className="text-sm font-medium">
              {section.label}
              {section.required && (
                <span className="ml-1 text-destructive">*</span>
              )}
            </Label>

            {section.type === 'text' && (
              <Input
                id={section.key}
                value={content[section.key] ?? ''}
                placeholder={section.placeholder}
                readOnly={readOnly}
                onChange={(e) => onChange(section.key, e.target.value)}
                onFocus={() => onFocusSection(section.key)}
              />
            )}

            {section.type === 'rich_text' && (
              <div onFocus={() => onFocusSection(section.key)}>
                <RichTextEditor
                  ref={getOrCreateEditorRef(section.key)}
                  initialContent={content[section.key] ?? ''}
                  placeholder={section.placeholder}
                  onChange={(html) => onChange(section.key, html)}
                  readOnly={readOnly}
                />
              </div>
            )}

            {section.type === 'verse_picker' && (
              <div className="flex flex-col gap-2">
                {!readOnly && (
                  <p className="text-xs text-muted-foreground">
                    Open the Bible pane and click Insert to add verses here.
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {(verseRefs[section.key] ?? []).map((vr, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 text-xs"
                    >
                      {vr.book} {vr.chapter}:{vr.verse}
                      {!readOnly && (
                        <button
                          className="ml-0.5 opacity-60 hover:opacity-100"
                          onClick={() => removeVerseRef(section.key, i)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit text-xs"
                    onClick={() => onFocusSection(section.key)}
                  >
                    Select verse
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  },
)
TemplateForm.displayName = 'TemplateForm'

export default TemplateForm
