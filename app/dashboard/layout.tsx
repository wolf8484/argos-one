'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Home, Plus, Settings } from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/jobs', icon: ClipboardList, label: 'Jobs' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto bg-background">
      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card border-t border-[var(--hairline)] flex items-center justify-around px-4 py-2 z-50">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              <span className="text-caption font-medium">{label}</span>
            </Link>
          )
        })}

        <Link href="/dashboard/jobs/new" className="flex flex-col items-center gap-1 px-4 py-2">
          <div className="bg-primary rounded-full p-3 -mt-6 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <Plus size={22} className="text-primary-foreground" strokeWidth={2.25} />
          </div>
          <span className="text-caption font-medium text-muted-foreground">New</span>
        </Link>
      </nav>
    </div>
  )
}
