import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, PenLine, Users, Trophy, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/entries', icon: BookOpen, label: 'Journal' },
  { to: '/write', icon: PenLine, label: 'Write' },
  { to: '/groups', icon: Users, label: 'Groups' },
  { to: '/campaigns', icon: Trophy, label: 'Campaigns' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background px-4">
        <span className="font-semibold tracking-tight">OpenQT</span>
        <Link to="/settings" aria-label="Settings">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Link>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
