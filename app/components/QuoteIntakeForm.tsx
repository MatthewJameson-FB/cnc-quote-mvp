"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  determineStage,
  inferManufacturingType,
  routeLead,
  validateLeadIntake,
  type IntakeMaterialPreference,
} from "@/lib/intake";

type SubmitResponse = {
  success: boolean;
  quote_id?: string;
  error?: string;
};

function UploadArea({
  valueLabel,
  emptyLabel,
  buttonLabel,
  accept,
  onPick,
  onClear,
}: {
  valueLabel: string | null;
  emptyLabel: string;
  buttonLabel: string;
  accept: string;
  onPick: (files: FileList | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        multiple
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-3">
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
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {buttonLabel}
          </button>
          <p className="mt-3 break-words text-sm text-slate-600">{valueLabel || emptyLabel}</p>
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
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [quoteRef] = useState(
    () => `CNC-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`
  );
  const preleadId = searchParams.get("prelead_id")?.trim() ?? "";

  const hasFile = Boolean(file);
  const hasPhotos = photos.length > 0;
  const stage = determineStage(hasFile, hasPhotos);
  const effectiveMeasurement = measurement.trim() || (hasPhotos ? "photos only" : "");
  const manufacturingType = inferManufacturingType(material, hasFile);
  const routingDecision = routeLead({ stage, manufacturing_type: manufacturingType });
  const intakeValidation = validateLeadIntake({
    has_file: hasFile,
    has_photos: hasPhotos,
    measurements: effectiveMeasurement,
    description,
  });

  const uploadLabel = [
    photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : null,
    file ? file.name : null,
  ]
    .filter(Boolean)
    .join(" • ") || null;

  function handleMixedUpload(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const isImage = (item: File) => /\.(png|jpe?g|webp|gif)$/i.test(item.name) || item.type.startsWith("image/");
    const nextPhotos = selected.filter(isImage);
    const nextFile = selected.find((item) => !isImage(item)) ?? null;

    setPhotos(nextPhotos);
    setFile(nextFile);
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitted(false);

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
      formData.append("quantity", "1");
      formData.append("has_file", String(hasFile));
      formData.append("has_photos", String(hasPhotos));
      formData.append("stage", stage);
      formData.append("manufacturing_type", manufacturingType);
      formData.append("routing_decision", routingDecision);
      formData.append("measurement", effectiveMeasurement);
      formData.append("measurements", effectiveMeasurement);
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
                Can’t find a replacement car part?
              </h1>
              <p className="text-lg leading-8 text-slate-300 sm:text-xl">
                Upload a few photos and tell us what broke. We&apos;ll see if it can be recreated.
              </p>
              <a
                href="#upload"
                className="inline-flex rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
              >
                Start with photos
              </a>

              <div className="flex flex-wrap gap-2 pt-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">Interior trim clip</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">Dashboard cover</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">Door panel bracket</span>
              </div>

              <p className="pt-1 text-sm text-slate-300">Best for trim, clips, covers, brackets and discontinued parts.</p>
            </div>
          </section>

          <section className="min-w-0">
            <div id="upload" className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Start here</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">Upload photos or a file</h2>
                  <p className="text-sm leading-6 text-slate-600">Photos are enough to start. CAD files are optional.</p>
                </div>

                <UploadArea
                  valueLabel={uploadLabel}
                  emptyLabel="No uploads selected"
                  buttonLabel="Choose photos or file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.step,.stp,.dxf,.dwg,.pdf,.stl,.obj,.3mf"
                  onPick={handleMixedUpload}
                  onClear={() => {
                    setFile(null);
                    setPhotos([]);
                  }}
                />

                <div className="grid gap-4">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium text-slate-700">What part do you need?</span>
                    <textarea
                      className="min-h-28 min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Example: missing dashboard trim clip from a 2012 BMW 3 Series"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium text-slate-700">Email</span>
                    <input
                      className="min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                  </label>
                </div>

                <details ref={detailsRef} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Add more details</summary>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2">
                        <span className="text-sm font-medium text-slate-700">Name</span>
                        <input
                          className="min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>

                      <label className="grid min-w-0 gap-2">
                        <span className="text-sm font-medium text-slate-700">Phone</span>
                        <input
                          className="min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2">
                        <span className="text-sm font-medium text-slate-700">Company</span>
                        <input
                          className="min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>

                      <label className="grid min-w-0 gap-2">
                        <span className="text-sm font-medium text-slate-700">Material</span>
                        <select
                          className="min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
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
                    </div>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-medium text-slate-700">Dimensions</span>
                      <input
                        className="min-w-0 rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                        value={measurement}
                        onChange={(e) => setMeasurement(e.target.value)}
                        placeholder="Optional"
                      />
                    </label>
                  </div>
                </details>

                {submitError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {submitError}
                  </p>
                ) : null}

                <div className="space-y-3">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-full bg-cyan-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Send photos"}
                  </button>
                  <p className="text-center text-sm text-slate-500">Thanks — we’ll take a look and get back to you.</p>
                </div>
              </div>

              {submitted ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Request received</p>
                  <p className="mt-2 text-2xl font-bold">Thanks — we’ve got your request.</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">We’ll take a quick look and come back with:</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    <li>• whether it can be recreated</li>
                    <li>• what’s needed (photos, dimensions, etc.)</li>
                    <li>• a realistic price range</li>
                  </ul>
                  <p className="mt-4 text-sm leading-6 text-slate-300">Most projects fall between £100–£400 depending on complexity.</p>
                  <p className="mt-3 text-sm text-slate-400">Reference: {quoteRef}</p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        detailsRef.current?.setAttribute("open", "");
                        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                    >
                      Add more details
                    </button>
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
