"use client";

import { useState } from "react";
import { calculateQuote, Material, Complexity } from "@/lib/pricing";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [material, setMaterial] = useState<Material>("aluminium_6082");
  const [complexity, setComplexity] = useState<Complexity>("medium");
  const [volumeCm3, setVolumeCm3] = useState(100);
  const [quantity, setQuantity] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [quoteRef] = useState(
    () => `CNC-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`
  );

  const quote = calculateQuote({
    material,
    complexity,
    volumeCm3,
    quantity,
  });

  async function handleSubmit() {
    setSubmitted(true);

    const formData = new FormData();

    formData.append("name", name);
    formData.append("email", email);
    formData.append("companyName", companyName);
    formData.append("phone", phone);
    formData.append("notes", notes);
    formData.append("material", material);
    formData.append("complexity", complexity);
    formData.append("volumeCm3", String(volumeCm3));
    formData.append("quantity", String(quantity));
    formData.append("quoteLow", String(quote.low));
    formData.append("quoteHigh", String(quote.high));
    formData.append("quoteTotal", String(quote.totalIncVat));

    if (file) {
      formData.append("file", file);
    }

    await fetch("/api/quote", {
      method: "POST",
      body: formData,
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section className="space-y-6 lg:sticky lg:top-8">
            <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
              Flangie · UK CNC supplier network
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Flangie – Custom CNC machining quotes
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-300">
                Upload your CAD file and get an indicative quote for custom or
                small-batch CNC parts from our UK supplier network.
              </p>
            </div>

            <ul className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
              {[
                "UK supplier network",
                "Manual engineering review",
                "Prototype and low-volume production",
                "STEP, STP, DXF and PDF accepted",
              ].map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm"
                >
                  {item}
                </li>
              ))}
            </ul>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Trust & process
              </p>
              <div className="mt-3 space-y-2 text-slate-200">
                <p>Indicative pricing only</p>
                <p>All quotes reviewed by engineers</p>
                <p>We specialise in custom and small-batch CNC work</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="space-y-2 border-b border-slate-200 pb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Request a quote
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                Tell us about your part
              </h2>
              <p className="text-slate-600">
                Keep it short if you like — we’ll review the details manually.
              </p>
            </div>

            <div className="mt-6 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Name</span>
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Company name
                  </span>
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your company"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Phone</span>
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 ..."
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  CAD file / drawing
                </span>
                <input
                  className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                  type="file"
                  accept=".step,.stp,.dxf,.dwg,.pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Material</span>
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value as Material)}
                  >
                    <option value="aluminium_6082">Aluminium 6082</option>
                    <option value="mild_steel">Mild Steel</option>
                    <option value="stainless_steel">Stainless Steel</option>
                    <option value="acetal_pom">Acetal / POM</option>
                    <option value="brass">Brass</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">Quantity</span>
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Volume (cm³)
                  </span>
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    type="number"
                    min="1"
                    value={volumeCm3}
                    onChange={(e) => setVolumeCm3(Number(e.target.value))}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Complexity
                  </span>
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value as Complexity)}
                  >
                    <option value="simple">Simple</option>
                    <option value="medium">Medium</option>
                    <option value="complex">Complex</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Notes / requirements
                </span>
                <textarea
                  className="min-h-32 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tolerances, finish, quantities, deadlines, or anything else useful"
                />
              </label>

              <button
                type="button"
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 hover:shadow-cyan-500/30"
                onClick={handleSubmit}
              >
                Generate indicative quote
              </button>
            </div>

            {submitted && (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
                  Indicative quote
                </p>

                <p className="mt-3 text-3xl font-bold sm:text-4xl">
                  {quoteRef}
                </p>

                <p className="mt-4 text-4xl font-bold text-cyan-300">
                  £{quote.low}–£{quote.high} inc. VAT
                </p>

                <p className="mt-4 text-slate-300">Estimated lead time: 7–10 working days</p>
                <p className="mt-1 text-slate-300">Status: Pending engineering review</p>
                <p className="mt-5 text-sm text-slate-400">
                  This estimate is not a final manufacturing quote.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
