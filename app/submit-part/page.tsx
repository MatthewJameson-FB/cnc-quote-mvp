import SubmitPartForm from './SubmitPartForm'

export const dynamic = 'force-dynamic'

export default function SubmitPartPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Flangie</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Upload your car part</h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            If you can’t find a replacement trim, clip, cover or fitting, send us a photo and a short description.
          </p>
        </header>
        <SubmitPartForm />
      </div>
    </main>
  )
}
