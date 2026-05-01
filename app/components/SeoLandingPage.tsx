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
            Upload your part
          </Link>
        </header>

        <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-bold">Why this exists</h2>
          <p className="text-slate-600">
            Replacement parts go missing, get discontinued, or stop being sold all the time. We help recreate small physical parts instead of replacing the whole item.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Interior trim clips and dashboard covers</p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Door panel brackets and mirror casings</p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Caravan and motorhome fittings</p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Small plastic or metal trim pieces</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {examples.map((example) => (
            <div key={example} className="rounded-3xl border bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Example use case</p>
              <p className="mt-2 text-base text-slate-800">{example}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-bold">When to use Flangie</h2>
          <ul className="space-y-2 text-slate-600">
            <li>• You can’t find the part anywhere</li>
            <li>• The manufacturer doesn’t sell it</li>
            <li>• The item still works but one part is broken</li>
            <li>• Replacing the whole item would be expensive</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-bold">Not suitable for</h2>
          <ul className="space-y-2 text-slate-600">
            <li>• Engines or gearboxes</li>
            <li>• Sensors, wiring or electronics</li>
            <li>• Safety-critical components</li>
          </ul>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-2xl font-bold">Can’t find the part?</h2>
            <p className="text-slate-600">
            Upload a photo and tell us what it needs to fit or do. We help recreate hard-to-find parts and work out the best way to get it made.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Home
            </Link>
            <Link href="/submit-part" className="inline-flex rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Upload your part
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
