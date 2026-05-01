import type { Metadata } from "next";
import Link from "next/link";
import PublicSiteShell from "@/app/components/PublicSiteShell";

export const metadata: Metadata = {
  title: "For garages | Flangie",
  description: "Help garages and workshops turn awkward part requests into clearer replacement-part jobs.",
};

export default function Page() {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <article className="space-y-8 rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-7 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.16)] sm:p-9">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#355894]">For garages</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Useful for garages, restorers and small workshops</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              We help turn vague part problems into clearer replacement-part requests.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            {[
              "Discontinued trim and awkward clips",
              "Brackets, covers and small fixings",
              "Customer-supplied photos and context",
              "No need to promise every part can be made",
            ].map((item) => (
              <div key={item} className="rounded-[24px] border border-slate-200 bg-white p-5 text-slate-700">
                {item}
              </div>
            ))}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">How it helps your workflow</h2>
            <p className="mt-3 max-w-3xl text-slate-700 leading-7">
              Instead of spending time chasing part numbers and cross-references, send the photos through and let us figure out whether the request is a good fit for recreation.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/submit-part" className="inline-flex rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]">
                Send a part request
              </Link>
              <Link href="/examples" className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                See examples
              </Link>
            </div>
          </section>
        </article>
      </div>
    </PublicSiteShell>
  );
}
