'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const todayItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Top Leads', href: '/admin/preleads?value=high' },
  { label: 'Inbound Leads', href: '/admin/preleads?source=inbound' },
]

const discoveryItems = [
  { label: 'Find Leads', href: '/admin/discovery-groups' },
  { label: 'Discovery Runs', href: '/admin/discovery-runs' },
  { label: 'Discovery Optimisation', href: '/admin/discovery-optimisation' },
  { label: 'Add Manual Lead', href: '/admin/manual-lead' },
]

const pipelineItems = [
  { label: 'All Leads', href: '/admin/preleads' },
  { label: 'Quotes', href: '/admin/quotes' },
  { label: 'Converted Quotes', href: '/admin/quotes?status=converted' },
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

    return pathname === basePath
  }

  function renderItems(items: Array<{ label: string; href: string }>) {
    return items.map((item) => {
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
    })
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <p className="mt-1 text-lg font-bold text-slate-900">Flangie</p>
      </div>
      <nav className="space-y-4">
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">TODAY</p>
          <div className="space-y-1">{renderItems(todayItems)}</div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">DISCOVERY</p>
          <div className="space-y-1">{renderItems(discoveryItems)}</div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PIPELINE</p>
          <div className="space-y-1">{renderItems(pipelineItems)}</div>
        </div>
      </nav>
    </aside>
  )
}
