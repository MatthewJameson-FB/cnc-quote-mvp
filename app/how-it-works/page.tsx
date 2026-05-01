import type { Metadata } from "next";
import Link from "next/link";
import PublicSiteShell from "@/app/components/PublicSiteShell";

export const metadata: Metadata = {
  title: "How it works | Flangie",
  description: "See how Flangie turns photos into clearer replacement-part requests.",
};

export default function Page() {
  const steps = [
    "Upload photos",
    "We review the part",
    "We confirm what’s needed",
    "We help recreate it",
    "You get a clear next step",
  ];

  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <article className="space-y-8 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-9">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">How it works</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Turn photos into a clearer part request</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              Start with photos. If the part is broken, missing or discontinued, we’ll look at the shape, fit and fixings and work out the best next step.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#355894]">{index + 1}</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">What we look for</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 text-slate-700">
              <li className="rounded-2xl bg-slate-50 p-4">Photos of the part and the area it fits into</li>
              <li className="rounded-2xl bg-slate-50 p-4">Any measurements you already know</li>
              <li className="rounded-2xl bg-slate-50 p-4">Where it came from and what it should do</li>
              <li className="rounded-2xl bg-slate-50 p-4">Whether the part is broken, missing or unavailable</li>
            </ul>
          </section>

          <section className="rounded-[28px] border border-[#355894]/20 bg-[#07111d] p-6 text-white">
            <h2 className="text-2xl font-black">Ready to start?</h2>
            <p className="mt-3 max-w-3xl text-slate-300 leading-7">Upload your part and we’ll take it from there.</p>
            <Link href="/submit-part" className="mt-5 inline-flex rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]">
              Upload your part
            </Link>
          </section>
        </article>
      </div>
    </PublicSiteShell>
  );
}
