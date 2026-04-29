'use client'

import { useState } from 'react'

function buildFollowupText(questions: string[]) {
  return [
    'Hi,',
    '',
    'To move this forward, could you provide:',
    '',
    ...questions.map((question) => `- ${question}`),
    '',
    'Thanks 👍',
  ].join('\n')
}

export default function CopyFollowupQuestionsButton({
  questions,
}: {
  questions: string[]
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(buildFollowupText(questions))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Copy follow-up questions
      </button>
      {copied ? <span className="text-sm text-emerald-700">Copied</span> : null}
    </div>
  )
}
