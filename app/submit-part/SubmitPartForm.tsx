'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'

export default function SubmitPartForm() {
  const [image, setImage] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [modelSpecifics, setModelSpecifics] = useState('')
  const [issueType, setIssueType] = useState('')
  const [sizeEstimate, setSizeEstimate] = useState('')
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
        throw new Error('Upload a photo or file before sending.')
      }

      const formData = new FormData()
      formData.append('description', description)
      formData.append('email', email)
      formData.append('vehicle_make', vehicleMake)
      formData.append('vehicle_model', vehicleModel)
      formData.append('vehicle_year', vehicleYear)
      formData.append('model_specifics', modelSpecifics)
      formData.append('issue_type', issueType)
      formData.append('size_estimate', sizeEstimate)
      formData.append('quantity', '1')
      formData.append('material', 'not_sure')
      formData.append('notes', '')
      formData.append('has_file', String(!image.type.startsWith('image/')))
      formData.append('has_photos', String(image.type.startsWith('image/')))
      if (image.type.startsWith('image/')) {
        formData.append('photos', image)
      } else {
        formData.append('file', image)
      }

      const response = await fetch('/api/quote', {
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
      setVehicleMake('')
      setVehicleModel('')
      setVehicleYear('')
      setModelSpecifics('')
      setIssueType('')
      setSizeEstimate('')
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
        <div className="rounded-[28px] border-2 border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50 px-4 py-5 shadow-inner shadow-slate-100/80 sm:px-5 sm:py-6">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#355894]/20 bg-[#355894]/10 text-[#355894]">
              <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V5" />
                <path d="M8 9l4-4 4 4" />
                <path d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" />
                <path d="M7 15h10" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-slate-900">Choose photos or a file</p>
              <p className="text-sm leading-6 text-slate-500">Photos are enough to start. CAD files are optional.</p>
            </div>
          </div>
          <input
            type="file"
            accept="image/*,.step,.stp,.dxf,.dwg,.pdf,.stl,.obj,.3mf"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="mt-4 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#355894] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </div>
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

      <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Add more details</summary>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Vehicle make</span>
              <input
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                value={vehicleMake}
                onChange={(e) => setVehicleMake(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Vehicle model</span>
              <input
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Vehicle year</span>
              <input
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                value={vehicleYear}
                onChange={(e) => setVehicleYear(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Model specifics</span>
              <input
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                value={modelSpecifics}
                onChange={(e) => setModelSpecifics(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Issue type</span>
              <select
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
              >
                <option value="">Optional</option>
                <option value="broken">Broken</option>
                <option value="missing">Missing</option>
                <option value="worn">Worn</option>
                <option value="can't find replacement">Can’t find replacement</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Size estimate</span>
              <select
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                value={sizeEstimate}
                onChange={(e) => setSizeEstimate(e.target.value)}
              >
                <option value="">Optional</option>
                <option value="<5cm">&lt;5cm</option>
                <option value="5–15cm">5–15cm</option>
                <option value="15–30cm">15–30cm</option>
                <option value="30cm+">30cm+</option>
              </select>
            </label>
          </div>
        </div>
      </details>

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
