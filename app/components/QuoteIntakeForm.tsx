"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { calculateQuote, type Material, type Complexity } from "@/lib/pricing";
import type { EstimateQuoteResult } from "@/lib/estimate-quote";
import {
  descriptionPresent,
  determineStage,
  inferManufacturingType,
  measurementsPresent,
  routeLead,
  validateLeadIntake,
  type IntakeMaterialPreference,
} from "@/lib/intake";

type SubmitResponse = {
  success: boolean;
  quote_id?: string;
  estimate?: EstimateQuoteResult;
  confirmation_yes_url?: string | null;
  confirmation_no_url?: string | null;
  error?: string;
};

function mapMaterialPreferenceToPricingMaterial(material: IntakeMaterialPreference): Material {
  switch (material) {
    case "steel":
      return "mild_steel";
    case "stainless_steel":
      return "stainless_steel";
    case "brass":
      return "brass";
    case "pla_standard_plastic":
    case "resin":
    case "abs_asa":
    case "nylon":
    case "petg":
      return "acetal_pom";
    case "other":
    case "not_sure":
    case "aluminium":
    default:
      return "aluminium_6082";
  }
}

function UploadCard({
  title,
  description,
  valueLabel,
  emptyLabel,
  buttonLabel,
  accept,
  multiple = false,
  onPick,
  onClear,
}: {
  title: string;
  description: string;
  valueLabel: string | null;
  emptyLabel: string;
  buttonLabel: string;
  accept: string;
  multiple?: boolean;
  onPick: (files: FileList | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {valueLabel ? (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="shrink-0 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {buttonLabel}
          </button>
          <p className="mt-3 break-words text-sm text-slate-500">{valueLabel || emptyLabel}</p>
        </div>
      </div>
    </div>
  );
}

export default function QuoteIntakeForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [material, setMaterial] = useState<IntakeMaterialPreference>("not_sure");
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [measurement, setMeasurement] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [quoteRef] = useState(
    () => `CNC-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`
  );
  const preleadId = searchParams.get("prelead_id")?.trim() ?? "";

  const hasFile = Boolean(file);
  const hasPhotos = photos.length > 0;
  const stage = determineStage(hasFile, hasPhotos);
  const measurementsReady = measurementsPresent(measurement);
  const descriptionReady = descriptionPresent(description);
  const manufacturingType = inferManufacturingType(material, hasFile);
  const routingDecision = routeLead({ stage, manufacturing_type: manufacturingType });
  const intakeValidation = validateLeadIntake({
    has_file: hasFile,
    has_photos: hasPhotos,
    measurements: measurement,
    description,
  });

  const pricingMaterial = mapMaterialPreferenceToPricingMaterial(material);
  const complexity: Complexity = hasPhotos && !hasFile ? "complex" : hasFile ? "medium" : "simple";
  const quote = useMemo(
    () =>
      calculateQuote({
        material: pricingMaterial,
        complexity,
        volumeCm3: 100,
        quantity: 1,
      }),
    [pricingMaterial, complexity]
  );

  const fileLabel = file ? file.name : null;
  const photoLabel = photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} selected` : null;

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitted(false);
    setSubmitResult(null);

    if (!intakeValidation.isValid) {
      setSubmitError(
        intakeValidation.reason === "missing_file_or_photo"
          ? "Upload at least one file or photo."
          : intakeValidation.reason === "photos_missing_measurements"
            ? "Add one measurement when you upload photos."
            : "Add a short description when you upload photos."
      );
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
      formData.append("complexity", complexity);
      formData.append("volumeCm3", "100");
      formData.append("quantity", "1");
      formData.append("quoteLow", String(quote.low));
      formData.append("quoteHigh", String(quote.high));
      formData.append("quoteTotal", String(quote.totalIncVat));
      formData.append("has_file", String(hasFile));
      formData.append("has_photos", String(hasPhotos));
      formData.append("stage", stage);
      formData.append("manufacturing_type", manufacturingType);
      formData.append("routing_decision", routingDecision);
      formData.append("measurement", measurement);
      formData.append("measurements", measurement);
      formData.append("description", description);
      formData.append("notes", "");
      if (preleadId) {
        formData.append("prelead_id", preleadId);
      }

      if (file) {
        formData.append("file", file);
      }

      for (const photo of photos) {
        formData.append("photos", photo);
      }

      const response = await fetch("/api/quote", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as SubmitResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit request.");
      }

      setSubmitResult(payload);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

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
                Upload a file for the fastest quote, or upload photos if the part needs recreating.
              </p>
            </div>

            <ul className="space-y-3 text-base text-slate-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 text-cyan-300">✓</span>
                <span>Upload file or photos</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-cyan-300">✓</span>
                <span>We review &amp; route</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 text-cyan-300">✓</span>
                <span>You get it made</span>
              </li>
            </ul>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-400/30 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Lane 1</p>
                <h2 className="mt-2 text-xl font-semibold text-white">I have a file</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  STL, STEP, CAD or drawing — fastest route to quote.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Lane 2</p>
                <h2 className="mt-2 text-xl font-semibold text-white">I only have photos</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Upload photos and measurements so we can assess CAD recreation.
                </p>
              </div>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              Photo-based requests may need CAD recreation before manufacturing.
            </p>
          </section>

          <section className="min-w-0">
            <div className="w-full rounded-xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium text-slate-700">Name</span>
                    <input
                      className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium text-slate-700">Email</span>
                    <input
                      className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium text-slate-700">Company</span>
                    <input
                      className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium text-slate-700">Phone</span>
                    <input
                      className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <UploadCard
                      title="I have a file"
                      description="STL, STEP, CAD or drawing — fastest route to quote."
                      valueLabel={fileLabel}
                      emptyLabel="No file selected"
                      buttonLabel="Choose file"
                      accept=".step,.stp,.dxf,.dwg,.pdf,.stl,.obj,.3mf"
                      onPick={(files) => setFile(files?.[0] || null)}
                      onClear={() => setFile(null)}
                    />

                    <UploadCard
                      title="I only have photos"
                      description="Upload photos and measurements so we can assess CAD recreation."
                      valueLabel={photoLabel}
                      emptyLabel="No photos selected"
                      buttonLabel="Choose photos"
                      accept=".png,.jpg,.jpeg,.webp"
                      multiple
                      onPick={(files) => setPhotos(Array.from(files ?? []))}
                      onClear={() => setPhotos([])}
                    />
                  </div>

                  <p className="text-sm text-slate-500">
                    Upload at least one: a file or photos of the part.
                  </p>
                  <p className="text-sm text-slate-500">
                    Photo-based requests may need CAD recreation before manufacturing.
                  </p>
                </div>

                <label className="grid min-w-0 gap-2">
                  <span className="text-sm font-medium text-slate-700">Material</span>
                  <select
                    className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value as IntakeMaterialPreference)}
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

                {hasPhotos ? (
                  <div className="grid gap-4">
                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-medium text-slate-700">Measurement</span>
                      <input
                        className="min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        value={measurement}
                        onChange={(e) => setMeasurement(e.target.value)}
                        placeholder="e.g. width = 45mm"
                      />
                      <span className="text-xs leading-5 text-slate-500">
                        Include at least one real-world measurement, e.g. width = 45mm.
                      </span>
                    </label>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-medium text-slate-700">Description</span>
                      <textarea
                        className="min-h-28 min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What is this part? What does it connect to? What needs to fit exactly?"
                      />
                      <span className="text-xs leading-5 text-slate-500">
                        If the part must fit something exactly, mention that in the description.
                      </span>
                    </label>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p>For best results, upload front, side and top views.</p>
                    </div>
                  </div>
                ) : null}

                {hasPhotos ? (
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className={`rounded-full px-3 py-1 ${measurementsReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      Measurement {measurementsReady ? "included" : "needed"}
                    </span>
                    <span className={`rounded-full px-3 py-1 ${descriptionReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      Description {descriptionReady ? "included" : "needed"}
                    </span>
                  </div>
                ) : null}

                {submitError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {submitError}
                  </p>
                ) : null}

                <div className="space-y-3">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit part request"}
                  </button>
                  <p className="text-center text-sm text-slate-500">We&apos;ll review and get back to you.</p>
                </div>
              </div>

              {submitted && submitResult?.estimate ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Thanks — we’ve received your request.</p>
                  <p className="mt-2 text-2xl font-bold">{quoteRef}</p>
                  <div className="mt-4 rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-300">Rough estimate</p>
                    <p className="mt-1 text-3xl font-bold text-cyan-300">£{submitResult.estimate.min_price}–£{submitResult.estimate.max_price}</p>
                    <p className="mt-2 text-sm text-slate-300">Confidence: <span className="font-semibold capitalize text-white">{submitResult.estimate.confidence}</span></p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{submitResult.estimate.disclaimer}</p>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    This is not a final quote. If this range looks reasonable, confirm and we’ll look for an accurate supplier quote.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    {submitResult.confirmation_yes_url ? (
                      <a
                        href={submitResult.confirmation_yes_url}
                        className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                      >
                        Yes, proceed to exact quote
                      </a>
                    ) : null}
                    {submitResult.confirmation_no_url ? (
                      <a
                        href={submitResult.confirmation_no_url}
                        className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                      >
                        This is higher than expected
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : submitted ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Request received</p>
                  <p className="mt-2 text-2xl font-bold">{quoteRef}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">We&apos;ll review your upload and get back to you.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
