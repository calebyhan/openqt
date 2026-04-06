import AppLayout from '@/components/layout/AppLayout'
import BibleReader from '@/components/bible/BibleReader'

export default function BiblePage() {
  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        <BibleReader />
      </div>
    </AppLayout>
  )
}
