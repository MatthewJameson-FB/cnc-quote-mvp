'use client'

import { useState } from 'react'

export default function CopySupplierBriefButton({
  brief,
}: {
  brief: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(brief)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Copy supplier brief
      </button>
      {copied ? <span className="text-sm text-emerald-700">Copied</span> : null}
    </div>
  )
}
