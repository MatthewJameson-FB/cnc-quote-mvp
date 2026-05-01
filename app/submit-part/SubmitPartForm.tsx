'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'

export default function SubmitPartForm() {
  const [image, setImage] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('description', description)
      formData.append('email', email)
      if (image) formData.append('image', image)

      const response = await fetch('/api/submit-part', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to submit part request.')
      }

      setMessage('Thanks — we’ll take a look and get back to you.')
      setImage(null)
      setDescription('')
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit part request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Upload photo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        What part do you need?
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
          placeholder="Example: missing dashboard trim clip from a 2012 BMW 3 Series"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
          placeholder="you@example.com"
          required
        />
      </label>
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Send photo'}
      </button>
    </form>
  )
}
