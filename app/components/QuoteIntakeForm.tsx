"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import PublicSiteShell from "@/app/components/PublicSiteShell";

type SubmitResponse = {
  success: boolean;
  quote_id?: string;
  error?: string;
};

function uploadLabel(files: File[]) {
  if (files.length === 0) return "No uploads selected";
  if (files.length === 1) return files[0].name;
  return `${files.length} uploads selected`;
}

function ClassicCarSilhouette() {
  return (
    <svg viewBox="0 0 900 360" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="carGlass" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
        <linearGradient id="carBody" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(29,44,68,0.98)" />
          <stop offset="100%" stopColor="rgba(9,13,22,0.98)" />
        </linearGradient>
      </defs>
      <g transform="translate(20 50)">
        <path d="M135 155c28-34 70-52 122-52h145c35 0 66 12 94 34l52 43h76c29 0 53 24 53 53v17H47v-19c0-33 22-61 53-66l35-10z" fill="url(#carBody)" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <path d="M259 107h144c32 0 62 11 87 31l29 23H201l58-54z" fill="url(#carGlass)" stroke="rgba(255,255,255,0.09)" strokeWidth="2" />
        <path d="M139 154h514" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle cx="191" cy="263" r="48" fill="#0a0f17" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
        <circle cx="191" cy="263" r="26" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
        <circle cx="585" cy="263" r="48" fill="#0a0f17" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
        <circle cx="585" cy="263" r="26" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" />
        <path d="M65 200h86" stroke="rgba(241,90,58,0.65)" strokeWidth="4" strokeLinecap="round" />
        <path d="M625 188h73" stroke="rgba(57,118,192,0.65)" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function MascotBubble() {
  return (
    <div className="flex items-end gap-3 rounded-[22px] border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-slate-100/90 text-2xl shadow-lg">
        ⚙️
      </div>
      <p className="max-w-[14rem] text-sm leading-6 text-slate-100">
        Hi, I’m Flangie. I help find parts that others can’t.
      </p>
    </div>
  );
}

export default function QuoteIntakeForm() {
  const searchParams = useSearchParams();
  const preleadId = searchParams.get("prelead_id")?.trim() ?? "";
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [material, setMaterial] = useState("not_sure");
  const [measurement, setMeasurement] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasUploads = files.length > 0;
  const uploadSummary = useMemo(() => uploadLabel(files), [files]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitted(false);

    if (!description.trim()) {
      setSubmitError("Tell us what part you need.");
      return;
    }

    if (!email.trim()) {
      setSubmitError("Add an email so we can reply.");
      return;
    }

    if (!hasUploads) {
      setSubmitError("Please upload at least one photo or file.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("companyName", companyName);
      formData.append("phone", phone);
      formData.append("material", material);
      formData.append("quantity", "1");
      formData.append("has_file", String(files.some((file) => !file.type.startsWith("image/"))));
      formData.append("has_photos", String(files.some((file) => file.type.startsWith("image/"))));
      formData.append("measurement", measurement);
      formData.append("measurements", measurement);
      formData.append("description", description);
      formData.append("notes", notes);
      if (preleadId) formData.append("prelead_id", preleadId);

      const photos = files.filter((file) => file.type.startsWith("image/"));
      const otherFiles = files.filter((file) => !file.type.startsWith("image/"));
      for (const photo of photos) formData.append("photos", photo);
      if (otherFiles[0]) formData.append("file", otherFiles[0]);

      const response = await fetch("/api/quote", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as SubmitResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit request.");
      }

      setSubmitted(true);
      setFiles([]);
      setDescription("");
      setEmail("");
      setNotes("");
      setMeasurement("");
      setName("");
      setPhone("");
      setCompanyName("");
      setMaterial("not_sure");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8 lg:pb-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,620px)] lg:items-start">
          <section className="relative min-w-0 overflow-hidden rounded-[32px] border border-white/10 bg-[#07111d]/85 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-9 lg:min-h-[860px] lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(58,107,185,0.16),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                  Built to fit
                  <span className="h-px w-16 bg-gradient-to-r from-[#3b6ec2] via-[#3b6ec2] to-[#f05a3a]" />
                  Recreated to match
                </div>

                <div className="max-w-2xl space-y-5">
                  <h1 className="text-4xl font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-7xl">
                    Can’t find a replacement car part?
                  </h1>
                  <p className="max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
                    Upload a few photos and tell us what broke. We’ll see if it can be recreated.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Trim & clips", "Interior and exterior"],
                    ["Brackets", "Mounts and fittings"],
                    ["Discontinued parts", "No longer available"],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                      <div className="mb-3 h-8 w-8 rounded-full border border-white/15 bg-white/10" />
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">{title}</p>
                      <p className="mt-1 text-sm text-slate-300">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="max-w-sm pt-2">
                  <MascotBubble />
                </div>
              </div>

              <div className="relative mt-auto pt-8">
                <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#050b14] to-transparent" />
                <div className="relative mx-auto max-w-[720px] translate-y-6 opacity-95">
                  <ClassicCarSilhouette />
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <form onSubmit={handleSubmit} className="w-full rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-5 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7 lg:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#355894]">Start here</p>
                  <div className="h-px w-20 bg-gradient-to-r from-[#355894] via-[#355894] to-[#f05a3a]" />
                  <h2 className="pt-3 text-3xl font-black tracking-tight text-slate-950">Upload photos or a file</h2>
                  <p className="text-base leading-7 text-slate-600">Photos are enough to start. CAD files are optional.</p>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-800">Upload photos or file</span>
                  <input
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp,.gif,.step,.stp,.dxf,.dwg,.pdf,.stl,.obj,.3mf"
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#355894] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#2d4b7f]"
                  />
                  <p className="text-sm text-slate-500">{uploadSummary}</p>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-800">What part do you need?</span>
                  <textarea
                    className="min-h-32 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Example: missing dashboard trim clip from an older car"
                    required
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-800">Email</span>
                  <input
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </label>

                <details className="group rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Add more details</summary>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Name</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Phone</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Company</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Material</span>
                        <select
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={material}
                          onChange={(e) => setMaterial(e.target.value)}
                        >
                          <option value="not_sure">Not sure</option>
                          <option value="pla_standard_plastic">PLA / standard plastic</option>
                          <option value="resin">Resin</option>
                          <option value="abs_asa">ABS / ASA</option>
                          <option value="nylon">Nylon</option>
                          <option value="petg">PETG</option>
                          <option value="aluminium">Aluminium</option>
                          <option value="steel">Steel</option>
                          <option value="stainless_steel">Stainless steel</option>
                          <option value="brass">Brass</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">Measurement</span>
                      <input
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                        value={measurement}
                        onChange={(e) => setMeasurement(e.target.value)}
                        placeholder="Optional"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">Notes</span>
                      <textarea
                        className="min-h-24 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional extra context"
                      />
                    </label>
                  </div>
                </details>

                {submitError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#355894] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#2d4b7f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Send photos"}
                </button>

                {submitted ? (
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#355894]">Request received</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">Thanks — we’ve got it.</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">We’ll review the photos and come back with a clear next step.</p>
                    <p className="mt-4 text-sm leading-7 text-slate-500">Most projects fall between £100–£400 depending on complexity.</p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setSubmitted(false)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Add more details
                      </button>
                      <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-full bg-[#f05a3a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6948]"
                      >
                        Done
                      </Link>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 sm:grid-cols-4">
                  {[
                    ["Precision made", "Exact fit, every time"],
                    ["Durable materials", "Built to last"],
                    ["Fast turnaround", "Get back on the road"],
                    ["UK based", "Engineered locally"],
                  ].map(([title, body]) => (
                    <div key={title} className="space-y-1 rounded-2xl px-2 py-1">
                      <p className="font-semibold uppercase tracking-[0.18em] text-slate-900">{title}</p>
                      <p>{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </PublicSiteShell>
  );
}
