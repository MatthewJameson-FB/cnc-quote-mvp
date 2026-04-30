import Link from 'next/link'

export default function SeoLandingPage({
  title,
  intro,
  examples,
}: {
  title: string
  intro: string
  examples: string[]
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Flangie</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">{intro}</p>
          <Link href="/submit-part" className="inline-flex rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
            Upload your broken part
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {examples.map((example) => (
            <div key={example} className="rounded-3xl border bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Example use case</p>
              <p className="mt-2 text-base text-slate-800">{example}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-bold">Can’t find the part?</h2>
          <p className="text-slate-600">
            Upload a photo and tell us what it needs to fit or do. We’ll recreate the part and work out the best way to get it made.
          </p>
          <Link href="/submit-part" className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Upload your broken part
          </Link>
        </section>
      </div>
    </main>
  )
}
