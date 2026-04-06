export interface TemplateSection {
  key: string
  label: string
  type: 'text' | 'rich_text' | 'verse_picker'
  placeholder?: string
  required?: boolean
}

// Stored as JSON in qt_entries.content
export type EntryContent = Record<string, string>
