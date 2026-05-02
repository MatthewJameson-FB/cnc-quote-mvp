"use client";

import { FormEvent, useState } from "react";

const features = [
  "Identify wasted ad spend",
  "Improve ROAS and CPA decisions",
  "Get clear, actionable recommendations",
  "Human-reviewed before anything is changed",
];

const steps = [
  "Share your campaign data",
  "Our AI agent team analyzes and debates the findings",
  "You receive a prioritized action plan",
];

export default function Home() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-12 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-[0.24em] text-slate-500 uppercase">Flangie</p>
            <p className="mt-1 text-sm text-slate-500">pilot.flangie.co.uk</p>
          </div>
          <a
            href="#contact"
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Get a free analysis
          </a>
        </header>

        <div className="grid flex-1 items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              AI marketing decision team for clearer campaign choices
            </div>

            <div className="space-y-5">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Improve your ad performance with an AI marketing team
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                We use a team of AI agents to analyze campaigns, challenge assumptions, and recommend better decisions.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#contact"
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Get a free analysis
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
              >
                See how it works
              </a>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Built for</p>
              <p className="mt-3 text-lg leading-8 text-slate-700">
                businesses and marketers who want clearer decisions, less wasted spend, and measurable ROI.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">What Flangie does</p>
              <div className="mt-5 grid gap-4">
                {features.map((feature) => (
                  <div key={feature} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-900 p-6 text-white sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Free pilot offer</p>
              <p className="mt-4 text-2xl font-semibold tracking-tight">We’re accepting 3 pilot companies for a free campaign analysis.</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Share your data and we’ll show where the team sees wasted spend, missed opportunity, and the next best move.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Why teams use it</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Faster decisions, fewer guesswork-driven changes, and a second opinion before budgets move.
            </p>
          </article>
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="how-it-works" className="text-lg font-semibold text-slate-950">How it works</h2>
            <ol className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
              {steps.map((step, index) => (
                <li key={step}>
                  <span className="font-medium text-slate-900">Step {index + 1}:</span> {step}
                </li>
              ))}
            </ol>
          </article>
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">What you get</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A prioritized action plan with clear recommendations your team can actually use.
            </p>
          </article>
        </div>
      </section>

      <section id="contact" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Contact</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Get a free analysis</h2>
            <p className="max-w-md text-sm leading-7 text-slate-600">
              Tell us a little about your business and campaigns. We’ll use the pilot to review your ad data and share the first set of recommendations.
            </p>
          </div>

          <div>
            {!submitted ? (
              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Name
                  <input required name="name" className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-900" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input required type="email" name="email" className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-900" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  Website
                  <input name="website" placeholder="https://" className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-900" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Ad platform
                  <input name="platform" placeholder="Google Ads, Meta, LinkedIn" className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-900" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Monthly ad spend
                  <input name="spend" placeholder="£10k / $20k" className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-900" />
                </label>
                <button
                  type="submit"
                  className="sm:col-span-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Send request
                </button>
              </form>
            ) : (
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
                <p className="text-lg font-semibold">Thanks — your request is in.</p>
                <p className="mt-2 text-sm leading-7">
                  We’ll review your details and follow up with the next step for the free campaign analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        © 2026 Flangie
      </footer>
    </main>
  );
}
