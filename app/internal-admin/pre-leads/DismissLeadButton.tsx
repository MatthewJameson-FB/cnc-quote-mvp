'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export default function DismissLeadButton({
  leadId,
  dismissed,
}: {
  leadId: string
  dismissed: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [localDismissed, setLocalDismissed] = useState(dismissed)

  const action = localDismissed ? 'undo' : 'dismiss'
  const label = localDismissed ? 'Undo' : 'Dismiss'

  async function handleClick() {
    startTransition(async () => {
      const response = await fetch(`/api/internal-admin/pre-leads/${leadId}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })

      if (!response.ok) {
        return
      }

      setLocalDismissed((value) => !value)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  )
}
