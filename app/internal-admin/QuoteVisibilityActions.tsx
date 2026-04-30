'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export default function QuoteVisibilityActions({
  quoteId,
  status,
}: {
  quoteId: string
  status: 'active' | 'contacted' | 'converted' | 'dismissed'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function submit(action: 'dismiss' | 'undo' | 'contacted' | 'converted') {
    startTransition(async () => {
      const response = await fetch(`/api/internal-admin/quotes/${quoteId}/visibility`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        return
      }

      router.refresh()
    })
  }

  const dismissLabel = status === 'dismissed' ? 'Undo dismiss' : 'Dismiss'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => submit('contacted')}
        disabled={pending}
        className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Mark contacted
      </button>
      <button
        type="button"
        onClick={() => submit('converted')}
        disabled={pending}
        className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Mark converted
      </button>
      <button
        type="button"
        onClick={() => submit(status === 'dismissed' ? 'undo' : 'dismiss')}
        disabled={pending}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {dismissLabel}
      </button>
    </div>
  )
}
