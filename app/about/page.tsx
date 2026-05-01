import type { Metadata } from "next";
import Link from "next/link";
import PublicSiteShell from "@/app/components/PublicSiteShell";

export const metadata: Metadata = {
  title: "About us | Flangie",
  description: "Flangie helps people deal with hard-to-find car parts by starting with photos, not CAD files.",
};

export default function Page() {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-4xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <article className="space-y-8 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-9">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">About us</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">A practical way to deal with hard-to-find parts</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              Flangie helps people deal with hard-to-find car parts by starting with photos, not CAD files.
            </p>
          </header>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6">
            <p className="max-w-3xl text-slate-700 leading-7">
              The idea is simple: if a part is missing, broken or discontinued, start by showing the shape, the fit and the surrounding area. That usually gets you to a clearer answer faster than trying to describe the part from memory.
            </p>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">What we care about</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 text-slate-700">
              <li className="rounded-2xl bg-slate-50 p-4">Clear photos over jargon</li>
              <li className="rounded-2xl bg-slate-50 p-4">Practical replacement-part requests</li>
              <li className="rounded-2xl bg-slate-50 p-4">No hype, no overpromising</li>
              <li className="rounded-2xl bg-slate-50 p-4">A straightforward next step</li>
            </ul>
          </section>

          <section className="rounded-[28px] border border-[#355894]/20 bg-[#07111d] p-6 text-white">
            <h2 className="text-2xl font-black">Need help now?</h2>
            <Link href="/submit-part" className="mt-5 inline-flex rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]">
              Upload your part
            </Link>
          </section>
        </article>
      </div>
    </PublicSiteShell>
  );
}
