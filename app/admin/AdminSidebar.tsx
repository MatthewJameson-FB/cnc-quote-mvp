'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Preleads', href: '/admin/preleads' },
  { label: 'Discovery Groups', href: '/admin/discovery-groups' },
  { label: 'Manual Lead', href: '/admin/manual-lead' },
  { label: 'Quotes', href: '/admin/quotes' },
  { label: 'Submit Part', href: '/submit-part' },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[230px] shrink-0 border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <p className="mt-1 text-lg font-bold text-slate-900">Flangie</p>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = item.href === '/submit-part' ? pathname === '/submit-part' : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-slate-950 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
