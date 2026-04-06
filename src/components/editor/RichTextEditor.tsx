import { forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

export interface RichTextEditorHandle {
  insertText: (text: string) => void
  getHTML: () => string
}

interface Props {
  initialContent?: string
  placeholder?: string
  onChange: (html: string) => void
  readOnly?: boolean
}

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  ({ initialContent = '', placeholder, onChange, readOnly = false }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: placeholder ?? 'Write here…' }),
      ],
      content: initialContent,
      editable: !readOnly,
      onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    })

    useImperativeHandle(ref, () => ({
      insertText: (text) => {
        editor?.chain().focus().insertContent(text).run()
      },
      getHTML: () => editor?.getHTML() ?? '',
    }))

    return (
      <div className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:outline-none focus-within:ring-1 focus-within:ring-ring">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none focus:outline-none [&_.tiptap]:outline-none [&_.tiptap.ProseMirror-focused]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
        />
      </div>
    )
  },
)
RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor
