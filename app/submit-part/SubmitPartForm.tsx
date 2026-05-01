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
      if (!image) {
        throw new Error('Upload a photo or file before sending.');
      }

      const formData = new FormData()
      formData.append('description', description)
      formData.append('email', email)
      formData.append('quantity', '1')
      formData.append('material', 'not_sure')
      formData.append('notes', '')
      if (image) {
        formData.append('has_file', String(!image.type.startsWith('image/')))
        formData.append('has_photos', String(image.type.startsWith('image/')))
        if (image.type.startsWith('image/')) {
          formData.append('photos', image)
        } else {
          formData.append('file', image)
        }
      }

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
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-8">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-800">Upload photo or file</label>
        <input
          type="file"
          accept="image/*,.step,.stp,.dxf,.dwg,.pdf,.stl,.obj,.3mf"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-slate-900 file:mr-4 file:rounded-full file:border-0 file:bg-[#355894] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="text-sm text-slate-500">Photos are enough to start. CAD files are optional.</p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        What part do you need?
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
          placeholder="Example: missing dashboard trim clip from an older car"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
          placeholder="you@example.com"
          required
        />
      </label>
      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[#355894] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d4b7f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Send photos'}
      </button>
    </form>
  )
}
