import { Suspense } from "react";
import QuoteIntakeForm from "@/app/components/QuoteIntakeForm";

function QuoteIntakeFallback() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-14">
          <section className="min-w-0 space-y-6 pt-2 lg:pt-10">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Get your custom part made
              </h1>
              <p className="text-lg leading-8 text-slate-300 sm:text-xl">
                Upload a file or photos — we&apos;ll handle CAD, 3D printing, CNC, or fabrication.
              </p>
              <p className="text-base leading-7 text-slate-400">
                No CAD file? Upload photos with one measurement — we can recreate it.
              </p>
            </div>
          </section>

          <section className="min-w-0">
            <div className="w-full rounded-xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
              <div className="h-[720px] animate-pulse rounded-xl bg-slate-100" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<QuoteIntakeFallback />}>
      <QuoteIntakeForm />
    </Suspense>
  );
}
