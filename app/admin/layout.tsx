import { Suspense } from 'react'
import type { ReactNode } from 'react'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <div className="w-64 shrink-0 lg:sticky lg:top-0 lg:h-screen">
        <Suspense fallback={<div className="w-64 shrink-0 border-r border-slate-200 bg-white p-4" />}>
          <AdminSidebar />
        </Suspense>
      </div>
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
