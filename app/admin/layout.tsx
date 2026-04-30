import type { ReactNode } from 'react'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <AdminSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
