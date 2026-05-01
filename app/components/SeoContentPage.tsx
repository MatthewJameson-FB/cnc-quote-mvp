import Link from "next/link";

type SeoContentPageProps = {
  title: string
  intro: [string, string]
  processTitle: string
  processSteps: string[]
  exampleTitle: string
  exampleBody: string
}

export default function SeoContentPage({
  title,
  intro,
  processTitle,
  processSteps,
  exampleTitle,
  exampleBody,
}: SeoContentPageProps) {
  return (
    <main className="bg-white px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="text-lg leading-8 text-slate-700">{intro[0]}</p>
          <p className="text-lg leading-8 text-slate-700">{intro[1]}</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-950">{processTitle}</h2>
          <ol className="list-decimal space-y-3 pl-5 text-slate-700">
            {processSteps.map((step) => (
              <li key={step} className="leading-7">
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-950">{exampleTitle}</h2>
          <p className="leading-8 text-slate-700">{exampleBody}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">Ready to get your part made?</h2>
          <p className="mt-3 leading-8 text-slate-700">
            If you have a file, upload it for the fastest route. If you only have photos, we can review them and assess whether CAD recreation is needed.
          </p>
          <Link
            href="/submit-part"
            className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Upload your part
          </Link>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
            <Link href="/replacement-car-parts-uk" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100">Car parts</Link>
            <Link href="/replacement-caravan-parts-uk" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100">Caravan parts</Link>
            <Link href="/submit-part" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100">Upload your part</Link>
          </div>
        </section>
      </article>
    </main>
  )
}
