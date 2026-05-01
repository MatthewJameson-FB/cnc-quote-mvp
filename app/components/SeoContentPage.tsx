import Link from "next/link";
import PublicSiteShell from "@/app/components/PublicSiteShell";

type SeoContentPageProps = {
  title: string;
  intro: [string, string];
  processTitle: string;
  processSteps: string[];
  exampleTitle: string;
  exampleBody: string;
};

export default function SeoContentPage({
  title,
  intro,
  processTitle,
  processSteps,
  exampleTitle,
  exampleBody,
}: SeoContentPageProps) {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <article className="space-y-8 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-9">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">Flangie guidance</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">{intro[0]}</p>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">{intro[1]}</p>
          </header>

          <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 sm:grid-cols-2">
            {processSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#355894]">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            <div className="space-y-3 rounded-[28px] border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-black text-slate-950">{processTitle}</h2>
              <ol className="space-y-3 text-slate-700">
                {processSteps.map((step, index) => (
                  <li key={step} className="flex gap-3 leading-7">
                    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#355894] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="rounded-[28px] border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-black text-slate-950">{exampleTitle}</h2>
              <p className="mt-3 text-slate-700 leading-7">{exampleBody}</p>
            </aside>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-6 text-white">
            <h2 className="text-2xl font-black">Ready to get your part made?</h2>
            <p className="mt-3 max-w-3xl text-slate-300 leading-7">
              Upload a few photos or a file and we’ll work out whether the part can be recreated.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/submit-part" className="inline-flex rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]">
                Upload your part
              </Link>
              <Link href="/examples" className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                View examples
              </Link>
            </div>
          </section>
        </article>
      </div>
    </PublicSiteShell>
  );
}
