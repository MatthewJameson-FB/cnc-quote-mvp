import { Suspense } from 'react'
import type { ReactNode } from 'react'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <div className="lg:sticky lg:top-0 lg:h-screen">
        <Suspense fallback={<div className="w-[230px] shrink-0 border-r border-slate-200 bg-white p-4" />}>
          <AdminSidebar />
        </Suspense>
      </div>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
