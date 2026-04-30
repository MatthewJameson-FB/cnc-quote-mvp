'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const quickActions = [
  { label: 'Add Lead', href: '/admin/manual-lead' },
  { label: 'High Value Leads', href: '/admin/preleads?value=high' },
  { label: 'Inbound Leads', href: '/admin/preleads?source=inbound' },
]

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
  const searchParams = useSearchParams()

  function isActiveHref(href: string) {
    const [basePath, queryString] = href.split('?')
    const currentQuery = searchParams.toString()

    if (queryString) {
      return pathname === basePath && currentQuery === queryString
    }

    return basePath === '/submit-part'
      ? pathname === '/submit-part'
      : pathname === basePath || pathname.startsWith(`${basePath}/`)
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <p className="mt-1 text-lg font-bold text-slate-900">Flangie</p>
      </div>
      <nav className="space-y-4">
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Actions</p>
          <div className="space-y-1">
            {quickActions.map((item) => {
              const active = isActiveHref(item.href)

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
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</p>
          <div className="space-y-1">
        {navItems.map((item) => {
          const active = isActiveHref(item.href)

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
          </div>
        </div>
      </nav>
    </aside>
  )
}
