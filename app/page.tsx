import { Suspense } from "react";
import QuoteIntakeForm from "@/app/components/QuoteIntakeForm";
import PublicSiteShell from "@/app/components/PublicSiteShell";

function QuoteIntakeFallback() {
  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)] lg:gap-12">
          <section className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="mt-6 h-16 w-4/5 animate-pulse rounded-2xl bg-white/10" />
            <div className="mt-4 h-8 w-3/5 animate-pulse rounded-2xl bg-white/10" />
            <div className="mt-10 h-40 rounded-[28px] border border-white/10 bg-white/5" />
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
              <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-[520px] animate-pulse rounded-[28px] bg-slate-100" />
            </div>
          </section>
        </div>
      </div>
    </PublicSiteShell>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<QuoteIntakeFallback />}>
      <QuoteIntakeForm />
    </Suspense>
  );
}
