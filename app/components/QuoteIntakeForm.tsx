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

function BlueprintMotif() {
  return (
    <svg viewBox="0 0 900 520" className="h-full w-full" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2">
        <path d="M70 90h240M140 130h190M64 170h150M120 210h230M70 250h170M610 100h160M660 150h140M620 210h180M590 280h210" />
        <path d="M120 360c60-65 175-110 300-110 90 0 165 18 242 56" />
        <path d="M140 380c48-36 108-62 186-78" />
        <path d="M580 320c24-20 52-35 87-45" />
        <circle cx="200" cy="120" r="14" />
        <circle cx="710" cy="120" r="14" />
        <circle cx="540" cy="290" r="20" />
      </g>
      <g fill="rgba(255,255,255,0.05)">
        <rect x="115" y="302" width="120" height="16" rx="8" />
        <rect x="270" y="250" width="170" height="16" rx="8" />
        <rect x="510" y="190" width="160" height="16" rx="8" />
      </g>
    </svg>
  );
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

function FlangieMascot() {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="flangeFace" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#efe6d4" />
          <stop offset="100%" stopColor="#c8c0ae" />
        </linearGradient>
      </defs>
      <g transform="translate(16 16)">
        <circle cx="94" cy="94" r="70" fill="#22354f" stroke="#5f748f" strokeWidth="5" />
        <circle cx="94" cy="94" r="48" fill="url(#flangeFace)" stroke="#6a6359" strokeWidth="4" />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 6;
          const x = 94 + Math.cos(angle) * 61;
          const y = 94 + Math.sin(angle) * 61;
          return <circle key={i} cx={x} cy={y} r="6.5" fill="#121926" stroke="#7e8ca2" strokeWidth="2" />;
        })}
        <circle cx="78" cy="86" r="4.5" fill="#101826" />
        <circle cx="110" cy="86" r="4.5" fill="#101826" />
        <path d="M76 106c8 8 34 8 42 0" stroke="#101826" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M18 128c12 0 28 9 36 22" stroke="#6f879f" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M170 128c-12 0-28 9-36 22" stroke="#6f879f" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M36 148l-15 22" stroke="#6f879f" strokeWidth="6" strokeLinecap="round" />
        <path d="M152 148l15 22" stroke="#6f879f" strokeWidth="6" strokeLinecap="round" />
        <path d="M28 174c15 8 30 10 46 10" stroke="#f05a3a" strokeWidth="4" strokeLinecap="round" />
        <path d="M146 174c15 8 30 10 46 10" stroke="#355894" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function TrimClipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h7c3 0 7 2 7 5s-4 5-7 5H5z" />
      <path d="M7 7v10" />
      <path d="M9 10h3" />
    </svg>
  );
}

function BracketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5h8v4H10v6h4v4H6z" />
      <path d="M16 7h2" />
      <path d="M16 17h2" />
    </svg>
  );
}

function ObsoletePartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16v10H4z" />
      <path d="M8 10h8" />
      <path d="M9 14h6" />
      <path d="M5 5l14 14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V5" />
      <path d="M8 9l4-4 4 4" />
      <path d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" />
      <path d="M7 15h10" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h4l2-2h4l2 2h4v10H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function MascotBubble() {
  return (
    <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <div className="relative h-24 w-24 shrink-0">
        <FlangieMascot />
      </div>
      <p className="max-w-[16rem] text-sm leading-6 text-slate-100 sm:text-[0.95rem]">
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
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [modelSpecifics, setModelSpecifics] = useState("");
  const [issueType, setIssueType] = useState("");
  const [sizeEstimate, setSizeEstimate] = useState("");
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
      formData.append("vehicle_make", vehicleMake);
      formData.append("vehicle_model", vehicleModel);
      formData.append("vehicle_year", vehicleYear);
      formData.append("model_specifics", modelSpecifics);
      formData.append("issue_type", issueType);
      formData.append("size_estimate", sizeEstimate);
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
      setVehicleMake("");
      setVehicleModel("");
      setVehicleYear("");
      setModelSpecifics("");
      setIssueType("");
      setSizeEstimate("");
      setMaterial("not_sure");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicSiteShell>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-14 lg:pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,620px)] lg:items-start">
          <section className="relative min-w-0 overflow-hidden rounded-[32px] border border-white/10 bg-[#07111d]/85 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-9 lg:p-10 lg:pt-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(58,107,185,0.16),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_38%)]" />
            <div className="absolute inset-0 opacity-35">
              <BlueprintMotif />
            </div>
            <div className="relative z-10 flex h-full flex-col">
              <div className="space-y-7 lg:max-w-[90%]">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                  Built to fit
                  <span className="h-px w-16 bg-gradient-to-r from-[#3b6ec2] via-[#3b6ec2] to-[#f05a3a]" />
                  Recreated to match
                </div>

                <div className="max-w-2xl space-y-4">
                  <h1 className="max-w-[12ch] text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-7xl">
                    Can’t find a replacement car part?
                  </h1>
                  <p className="max-w-xl text-lg leading-8 text-slate-300 sm:text-xl lg:mt-1">
                    Upload a few photos and tell us what broke. We’ll see if it can be recreated.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:gap-4">
                  {[
                    { title: "Trim & clips", body: "Interior and exterior", Icon: TrimClipIcon },
                    { title: "Brackets", body: "Mounts and fittings", Icon: BracketIcon },
                    { title: "Discontinued parts", body: "No longer available", Icon: ObsoletePartIcon },
                  ].map(({ title, body, Icon }) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-white/8 p-3.5 backdrop-blur-sm shadow-sm">
                      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#0d1724] text-slate-100 shadow-sm">
                        <Icon />
                      </div>
                      <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-white">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="max-w-md pt-1 sm:pt-2">
                  <MascotBubble />
                </div>
              </div>

              <div className="relative mt-8 pt-2 sm:mt-10">
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#050b14] to-transparent" />
                <div className="relative mx-auto max-w-[780px] opacity-95 sm:translate-y-2 lg:translate-y-3">
                  <ClassicCarSilhouette />
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <form onSubmit={handleSubmit} className="w-full rounded-[32px] border border-slate-200 bg-[#f8f4ee] p-5 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7 lg:p-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#355894]">Start here</p>
                  <div className="h-px w-20 bg-gradient-to-r from-[#355894] via-[#355894] to-[#f05a3a]" />
                  <h2 className="pt-2 text-3xl font-black tracking-tight text-slate-950">Upload photos or a file</h2>
                  <p className="text-base leading-7 text-slate-600">Photos are enough to start.</p>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-800">Upload photos or file</span>
                  <div className="rounded-[28px] border-2 border-dashed border-slate-300 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#355894]/10 text-[#355894]">
                        <UploadIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">Choose photos or file</p>
                        <p className="text-sm leading-6 text-slate-500">Photos are enough to start.</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.webp,.gif,.step,.stp,.dxf,.dwg,.pdf,.stl,.obj,.3mf"
                      onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                      className="mt-4 block w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#355894] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#2d4b7f]"
                    />
                  </div>
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <CameraIcon />
                    {uploadSummary}
                  </p>
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
                        <span className="text-sm font-medium text-slate-700">Vehicle make</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={vehicleMake}
                          onChange={(e) => setVehicleMake(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Vehicle model</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Vehicle year</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={vehicleYear}
                          onChange={(e) => setVehicleYear(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Model specifics</span>
                        <input
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={modelSpecifics}
                          onChange={(e) => setModelSpecifics(e.target.value)}
                          placeholder="Optional"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Issue type</span>
                        <select
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={issueType}
                          onChange={(e) => setIssueType(e.target.value)}
                        >
                          <option value="">Optional</option>
                          <option value="broken">Broken</option>
                          <option value="missing">Missing</option>
                          <option value="worn">Worn</option>
                          <option value="can't find replacement">Can’t find replacement</option>
                        </select>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700">Size estimate</span>
                        <select
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[#355894] focus:ring-4 focus:ring-[#355894]/10"
                          value={sizeEstimate}
                          onChange={(e) => setSizeEstimate(e.target.value)}
                        >
                          <option value="">Optional</option>
                          <option value="<5cm">&lt;5cm</option>
                          <option value="5–15cm">5–15cm</option>
                          <option value="15–30cm">15–30cm</option>
                          <option value="30cm+">30cm+</option>
                        </select>
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
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#355894] px-6 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(53,88,148,0.28)] transition hover:bg-[#2d4b7f] disabled:cursor-not-allowed disabled:opacity-60"
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
