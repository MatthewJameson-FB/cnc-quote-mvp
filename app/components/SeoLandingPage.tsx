import Link from "next/link";
import PublicSiteShell from "@/app/components/PublicSiteShell";

export default function SeoLandingPage({
  title,
  intro,
  examples,
}: {
  title: string;
  intro: string;
  examples: string[];
}) {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <section className="space-y-6 rounded-[32px] border border-white/10 bg-white/10 p-7 backdrop-blur-sm sm:p-9">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7ea6e8]">Automotive replacement parts</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">{intro}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/submit-part" className="inline-flex rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]">
                Upload your part
              </Link>
              <Link href="/examples" className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                See examples
              </Link>
            </div>
          </section>

          <aside className="space-y-4 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">Common requests</p>
            <div className="space-y-3">
              {examples.map((example) => (
                <div key={example} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  {example}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Trim and clips", "Interior and exterior pieces that snapped or went missing."],
            ["Brackets and mounts", "Small fixings that are hard to source by themselves."],
            ["Discontinued parts", "Older car parts that the dealer no longer sells."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[28px] border border-white/10 bg-white/10 p-5 text-slate-100">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7ea6e8]">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </PublicSiteShell>
  );
}
