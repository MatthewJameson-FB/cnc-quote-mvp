"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import ResearchTools from "@/app/components/ResearchTools";
import { saveQuoteWorkbench, type QuoteWorkbenchActionState } from "../../actions";
import { buildSearchContext } from "@/lib/research-context";

type QuoteRecord = {
  id: string;
  quote_ref: string | null;
  name: string | null;
  email: string | null;
  created_at: string;
  notes: string | null;
  status: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  model_specifics: string | null;
  issue_type: string | null;
  size_estimate: string | null;
  description: string | null;
  search_context: string | null;
  fileUrl: string | null;
  photoUrls: string[];
  part_type: string | null;
  manufacturable: string | null;
  cad_required: string | null;
  complexity: string | null;
  internal_notes: string | null;
  research_notes: string | null;
  cad_cost_min: number | null;
  cad_cost_max: number | null;
  manufacturing_cost_min: number | null;
  manufacturing_cost_max: number | null;
  total_estimate_min: number | null;
  total_estimate_max: number | null;
  estimate_confidence: string | null;
  quote_message: string | null;
};

function formatMoney(value: number | null | undefined) {
  if (value == null) return "";
  return String(value);
}

function inputClass() {
  return "mt-1 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";
}

function labelClass() {
  return "text-sm font-semibold text-slate-700";
}

function sectionCard() {
  return "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
}

function buildRefinedMessage(name: string, min: string, max: string, cadMin?: string, cadMax?: string, manufMin?: string, manufMax?: string, confidence?: string) {
  const totalRange = min && max ? `£${min}–£${max}` : min || max ? `£${min || max}` : "£—";
  const breakdownParts = [
    cadMin || cadMax ? `CAD £${cadMin || "—"}–£${cadMax || "—"}` : null,
    manufMin || manufMax ? `manufacturing £${manufMin || "—"}–£${manufMax || "—"}` : null,
  ].filter(Boolean);

  return [
    `Hi ${name || "there"},`,
    "",
    "Thanks for sending the details over.",
    "",
    "I’ve reviewed the part and it looks like this may be possible to recreate.",
    "",
    `Based on the information so far, a realistic estimate is around ${totalRange}. This includes the CAD/recreation work and manufacturing, but final pricing may change slightly once dimensions and fitment are confirmed.`,
    breakdownParts.length ? `Pricing breakdown: ${breakdownParts.join(" · ")}.` : null,
    confidence ? `Estimate confidence: ${confidence}.` : null,
    "",
    "If you’re happy with that range, I can move this forward and confirm the next step.",
    "",
    "Thanks,",
    "Flangie",
  ].filter(Boolean).join("\n");
}

function buildAskMoreInfoMessage(name: string) {
  return [
    `Hi ${name || "there"},`,
    "",
    "Thanks for sending this over.",
    "",
    "This looks like something we may be able to help with, but I need a little more detail before giving a proper price.",
    "",
    "Could you send:",
    "- one clear photo of the full part",
    "- one close-up of the broken/missing area",
    "- a rough measurement",
    "- the car make/model/year if you know it",
    "",
    "Once I have that, I’ll take a proper look.",
    "",
    "Thanks,",
    "Flangie",
  ].join("\n");
}

function PhotoGallery({ fileUrl, photoUrls }: { fileUrl: string | null; photoUrls: string[] }) {
  const items = [
    ...(fileUrl ? [{ href: fileUrl, label: "Primary file" }] : []),
    ...photoUrls.map((href, index) => ({ href, label: `Photo ${index + 1}` })),
  ];

  if (!items.length) return <p className="text-sm text-slate-500">No photos or file preview available.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
      {items.map((item) => (
        <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="aspect-[4/3] bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(59,130,246,0.75))] p-4 text-white">
            <div className="flex h-full items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{item.label}</p>
                <p className="mt-2 text-sm text-white/90">Open in new tab</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">View</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function QuoteWorkbenchEditor({ quote }: { quote: QuoteRecord }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [message, setMessage] = useState(quote.quote_message || "");
  const [copyState, setCopyState] = useState<string | null>(null);
  const [generatedState, setGeneratedState] = useState<string | null>(null);
  const [actionState, formAction, pending] = useActionState<QuoteWorkbenchActionState, FormData>(saveQuoteWorkbench, {
    status: "idle",
    message: null,
    error: null,
  });

  const searchContext = useMemo(
    () =>
      quote.search_context ||
      buildSearchContext({
        vehicle_make: quote.vehicle_make,
        vehicle_model: quote.vehicle_model,
        vehicle_year: quote.vehicle_year,
        model_specifics: quote.model_specifics,
        description: quote.description,
        issue_type: quote.issue_type,
      }),
    [quote]
  );

  const markMessage = (text: string) => {
    setMessage(text);
    setGeneratedState("Message generated.");
  };

  const readFormValue = (name: string) => {
    const form = formRef.current;
    if (!form) return "";
    const value = new FormData(form).get(name);
    return typeof value === "string" ? value.trim() : "";
  };

  const generateRefined = () => {
    const customerName = readFormValue("customer_name") || quote.name || "there";
    markMessage(
      buildRefinedMessage(
        customerName,
        readFormValue("total_estimate_min"),
        readFormValue("total_estimate_max"),
        readFormValue("cad_cost_min"),
        readFormValue("cad_cost_max"),
        readFormValue("manufacturing_cost_min"),
        readFormValue("manufacturing_cost_max"),
        readFormValue("estimate_confidence")
      )
    );
  };

  const generateMoreInfo = () => {
    const customerName = readFormValue("customer_name") || quote.name || "there";
    markMessage(buildAskMoreInfoMessage(customerName));
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    setCopyState("Copied message.");
    window.setTimeout(() => setCopyState(null), 1600);
  };

  return (
    <form ref={formRef} action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(340px,0.95fr)]">
      <input type="hidden" name="quoteId" value={quote.id} />

      <section className={sectionCard()}>
        <h2 className="text-lg font-bold text-slate-900">Customer & part</h2>
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className={labelClass()}>Customer name</p>
              <input name="customer_name" defaultValue={quote.name || ""} className={inputClass()} />
            </div>
            <div>
              <p className={labelClass()}>Customer email</p>
              <p className="mt-1 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{quote.email || "—"}</p>
            </div>
          </div>

          <div>
            <p className={labelClass()}>Description / title</p>
            <input name="description" defaultValue={quote.description || ""} className={inputClass()} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className={labelClass()}>Vehicle make</p><input name="vehicle_make" defaultValue={quote.vehicle_make || ""} className={inputClass()} /></div>
            <div><p className={labelClass()}>Vehicle model</p><input name="vehicle_model" defaultValue={quote.vehicle_model || ""} className={inputClass()} /></div>
            <div><p className={labelClass()}>Vehicle year</p><input name="vehicle_year" defaultValue={quote.vehicle_year || ""} className={inputClass()} /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className={labelClass()}>Model specifics</p><input name="model_specifics" defaultValue={quote.model_specifics || ""} className={inputClass()} /></div>
            <div><p className={labelClass()}>Issue type</p><input name="issue_type" defaultValue={quote.issue_type || ""} className={inputClass()} /></div>
          </div>

          <div>
            <p className={labelClass()}>Size estimate</p>
            <input name="size_estimate" defaultValue={quote.size_estimate || ""} className={inputClass()} />
          </div>

          <div>
            <p className={labelClass()}>Photo gallery</p>
            <div className="mt-3"><PhotoGallery fileUrl={quote.fileUrl} photoUrls={quote.photoUrls} /></div>
          </div>
        </div>
      </section>

      <section className={sectionCard()}>
        <h2 className="text-lg font-bold text-slate-900">Quote shape</h2>
        <div className="mt-5 space-y-4">
          <label className="block"><span className={labelClass()}>Part type</span><input name="part_type" defaultValue={quote.part_type || ""} className={inputClass()} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={labelClass()}>Manufacturable</span><select name="manufacturable" defaultValue={quote.manufacturable || ""} className={inputClass()}><option value="">Not set</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></label>
            <label className="block"><span className={labelClass()}>CAD required</span><select name="cad_required" defaultValue={quote.cad_required || ""} className={inputClass()}><option value="">Not set</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          </div>
          <label className="block"><span className={labelClass()}>Complexity</span><select name="complexity" defaultValue={quote.complexity || ""} className={inputClass()}><option value="">Not set</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label className="block"><span className={labelClass()}>Internal notes</span><textarea name="internal_notes" defaultValue={quote.internal_notes || ""} rows={6} className={`${inputClass()} min-h-[160px]`} /></label>
        </div>
      </section>

      <section className={sectionCard()}>
        <h2 className="text-lg font-bold text-slate-900">Research & pricing</h2>
        <div className="mt-5 space-y-4">
          <div><p className={labelClass()}>Search context</p><p className="mt-1 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-slate-700">{searchContext || "—"}</p></div>
          <ResearchTools searchContext={searchContext} />
          <label className="block"><span className={labelClass()}>Research notes</span><textarea name="research_notes" defaultValue={quote.research_notes || ""} rows={6} className={`${inputClass()} min-h-[160px]`} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={labelClass()}>CAD cost min</span><input name="cad_cost_min" type="number" step="0.01" defaultValue={formatMoney(quote.cad_cost_min)} className={inputClass()} /></label>
            <label className="block"><span className={labelClass()}>CAD cost max</span><input name="cad_cost_max" type="number" step="0.01" defaultValue={formatMoney(quote.cad_cost_max)} className={inputClass()} /></label>
            <label className="block"><span className={labelClass()}>Manufacturing cost min</span><input name="manufacturing_cost_min" type="number" step="0.01" defaultValue={formatMoney(quote.manufacturing_cost_min)} className={inputClass()} /></label>
            <label className="block"><span className={labelClass()}>Manufacturing cost max</span><input name="manufacturing_cost_max" type="number" step="0.01" defaultValue={formatMoney(quote.manufacturing_cost_max)} className={inputClass()} /></label>
            <label className="block"><span className={labelClass()}>Total estimate min</span><input name="total_estimate_min" type="number" step="0.01" defaultValue={formatMoney(quote.total_estimate_min)} className={inputClass()} /></label>
            <label className="block"><span className={labelClass()}>Total estimate max</span><input name="total_estimate_max" type="number" step="0.01" defaultValue={formatMoney(quote.total_estimate_max)} className={inputClass()} /></label>
          </div>
          <label className="block"><span className={labelClass()}>Estimate confidence</span><select name="estimate_confidence" defaultValue={quote.estimate_confidence || ""} className={inputClass()}><option value="">Not set</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
      </section>

      <section className="xl:col-span-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Customer message</h2>
            <p className="text-sm text-slate-600">Generate, edit, copy, and send when ready.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generateRefined} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Generate refined quote message</button>
            <button type="button" onClick={generateMoreInfo} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Generate ask-for-more-info message</button>
            <button type="button" onClick={copyMessage} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Copy message</button>
          </div>
        </div>

        <textarea value={message} onChange={(e) => setMessage(e.target.value)} name="quote_message" rows={10} className={`${inputClass()} mt-4 min-h-[260px]`} />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" name="workbenchAction" value="save" disabled={pending} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Save changes</button>
          <button type="submit" name="workbenchAction" value="mark_sent" disabled={pending} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">Mark sent</button>
          {actionState.message ? <span className="text-sm font-medium text-emerald-700">{actionState.message}</span> : null}
          {copyState ? <span className="text-sm font-medium text-emerald-700">{copyState}</span> : null}
          {generatedState ? <span className="text-sm font-medium text-slate-600">{generatedState}</span> : null}
          {actionState.error ? <span className="text-sm font-medium text-red-700">{actionState.error}</span> : null}
        </div>
      </section>
    </form>
  );
}
