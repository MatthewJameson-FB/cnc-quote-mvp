'use client'

import { useState } from 'react'

export default function CopyReplyButton({ reply }: { reply: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(reply)
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
        Copy reply
      </button>
      {copied ? <span className="text-sm text-emerald-700">Copied</span> : null}
    </div>
  )
}
