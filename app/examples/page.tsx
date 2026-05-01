import type { Metadata } from "next";
import Link from "next/link";
import PublicSiteShell from "@/app/components/PublicSiteShell";

export const metadata: Metadata = {
  title: "Examples | Flangie",
  description: "See the kinds of car parts Flangie helps with: trim clips, brackets, covers and fittings.",
};

const examples = [
  ["Interior trim clips", "A clip snaps and the trim no longer sits flush. These are often tiny, discontinued and annoying to match."],
  ["Dashboard covers", "A corner breaks off or the whole cover is missing, leaving an unfinished interior."],
  ["Door panel brackets", "A mounting tab or bracket breaks and the panel starts rattling or sagging."],
  ["Mirror covers", "A mirror cap or cover cracks and the manufacturer no longer sells the exact part."],
  ["Bumper trim", "A small trim section goes missing after a knock or repair."],
  ["Caravan and motorhome fittings", "A latch, cover or fitting breaks and the original part is hard to source."],
];

export default function Page() {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <article className="space-y-8 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-9">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">Examples</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Real-world part problems we see often</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              These are the kinds of requests that suit Flangie best: small physical parts, awkward clips, discontinued trim and hard-to-find fittings.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            {examples.map(([title, body]) => (
              <section key={title} className="rounded-[28px] border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-black text-slate-950">{title}</h2>
                <p className="mt-3 text-slate-700 leading-7">{body}</p>
              </section>
            ))}
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">Why these are hard to find</h2>
            <p className="mt-3 max-w-3xl text-slate-700 leading-7">
              Often the original part is discontinued, sold only as part of a bigger assembly, or never sold separately at all.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/submit-part" className="inline-flex rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]">
                Send photos
              </Link>
              <Link href="/how-it-works" className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                How it works
              </Link>
            </div>
          </section>
        </article>
      </div>
    </PublicSiteShell>
  );
}
