import Link from "next/link";
import { notFound } from "next/navigation";
import ResearchTools from "@/app/components/ResearchTools";
import { requireAdminUser } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeQuoteVisibilityStatus, quoteVisibilityLabel } from "@/lib/quote-visibility";
import { saveQuoteWorkbench } from "../../actions";

export const dynamic = "force-dynamic";

type QuoteRecord = {
  id: string;
  quote_ref: string | null;
  name: string | null;
  email: string | null;
  created_at: string;
  notes: string | null;
  status: string | null;
  quote_low: number | null;
  quote_high: number | null;
  customer_estimate_min: number | null;
  customer_estimate_max: number | null;
  final_quote_amount: number | null;
  job_value: number | null;
  material: string | null;
  complexity: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  model_specifics: string | null;
  issue_type: string | null;
  size_estimate: string | null;
  search_context: string | null;
  file_path: string | null;
  part_type: string | null;
  manufacturable: string | null;
  cad_required: string | null;
  internal_notes: string | null;
  research_notes: string | null;
  cad_cost_min: number | null;
  cad_cost_max: number | null;
  manufacturing_cost_min: number | null;
  manufacturing_cost_max: number | null;
  total_estimate_min: number | null;
  total_estimate_max: number | null;
  estimate_confidence: string | null;
};

type QuoteRecordWithAssets = QuoteRecord & {
  fileUrl: string | null;
  photoUrls: string[];
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function extractNoteValue(notes: string | null | undefined, key: string) {
  if (!notes) return null;
  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gm")));
  const lastMatch = matches.at(-1);
  return lastMatch?.[1]?.trim() || null;
}

function extractCommaNoteList(notes: string | null | undefined, key: string) {
  const raw = extractNoteValue(notes, key);
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function quoteDescription(quote: QuoteRecord) {
  return (
    extractNoteValue(quote.notes, "description") ||
    [quote.material, quote.complexity].filter(Boolean).join(" • ") ||
    quote.quote_ref ||
    "Quote request"
  );
}

function searchContextFallback(quote: QuoteRecord) {
  return [
    quote.search_context,
    quote.vehicle_make,
    quote.vehicle_model,
    quote.vehicle_year,
    quote.model_specifics,
    quoteDescription(quote),
    quote.issue_type,
    quote.size_estimate,
  ]
    .filter(Boolean)
    .join(" ");
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

async function loadQuote(id: string): Promise<QuoteRecordWithAssets | null> {
  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!quote) return null;

  const photoPaths = extractCommaNoteList(quote.notes, "photo_urls");
  const storage = supabase.storage.from("quote-files");

  const photoUrls = (
    await Promise.all(
      photoPaths.map(async (photoPath) => {
        const { data } = await storage.createSignedUrl(photoPath, 60 * 60 * 4);
        return data?.signedUrl ?? null;
      })
    )
  ).filter((value): value is string => Boolean(value));

  let fileUrl: string | null = null;

  if (quote.file_path) {
    const { data } = await storage.createSignedUrl(quote.file_path, 60 * 60 * 4);
    fileUrl = data?.signedUrl ?? null;
  }

  return {
    ...quote,
    fileUrl,
    photoUrls,
  };
}

function PhotoGallery({ fileUrl, photoUrls }: { fileUrl: string | null; photoUrls: string[] }) {
  const items = [
    ...(fileUrl ? [{ href: fileUrl, label: "Primary file" }] : []),
    ...photoUrls.map((href, index) => ({ href, label: `Photo ${index + 1}` })),
  ];

  if (!items.length) {
    return <p className="text-sm text-slate-500">No photos or file preview available.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="aspect-[4/3] bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(59,130,246,0.75))] p-4 text-white">
            <div className="flex h-full items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{item.label}</p>
                <p className="mt-2 text-sm text-white/90">Open in new tab</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                View
              </span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

export default async function QuoteWorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id } = await params;
  const quote = await loadQuote(id);

  if (!quote) {
    notFound();
  }

  const status = normalizeQuoteVisibilityStatus(quote.status);
  const searchContext = quote.search_context || searchContextFallback(quote);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Quote workbench</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Refine lead before sending</h1>
              <p className="mt-2 max-w-3xl text-slate-600">Adjust the part, pricing, and research context here. Nothing is sent to the customer until you choose an action.</p>
            </div>
            <Link href="/admin/quotes" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Back to quotes
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">{quote.quote_ref || quote.id.slice(0, 8).toUpperCase()}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{quoteVisibilityLabel(status)}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Created {formatDate(quote.created_at)}</span>
          </div>
        </header>

        <form action={saveQuoteWorkbench} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(340px,0.95fr)]">
          <input type="hidden" name="quoteId" value={quote.id} />

          <section className={sectionCard()}>
            <h2 className="text-lg font-bold text-slate-900">Customer & part</h2>
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={labelClass()}>Customer name</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.name || "—"}</p>
                </div>
                <div>
                  <p className={labelClass()}>Customer email</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.email || "—"}</p>
                </div>
              </div>

              <div>
                <p className={labelClass()}>Description</p>
                <p className="mt-1 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{quoteDescription(quote)}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className={labelClass()}>Vehicle make</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.vehicle_make || "—"}</p>
                </div>
                <div>
                  <p className={labelClass()}>Vehicle model</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.vehicle_model || "—"}</p>
                </div>
                <div>
                  <p className={labelClass()}>Vehicle year</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.vehicle_year || "—"}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={labelClass()}>Issue type</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.issue_type || "—"}</p>
                </div>
                <div>
                  <p className={labelClass()}>Size estimate</p>
                  <p className="mt-1 text-sm text-slate-900">{quote.size_estimate || "—"}</p>
                </div>
              </div>

              <div>
                <p className={labelClass()}>Photo gallery</p>
                <div className="mt-3">
                  <PhotoGallery fileUrl={quote.fileUrl} photoUrls={quote.photoUrls} />
                </div>
              </div>
            </div>
          </section>

          <section className={sectionCard()}>
            <h2 className="text-lg font-bold text-slate-900">Quote shape</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className={labelClass()}>Part type</span>
                <input name="partType" defaultValue={quote.part_type || ""} className={inputClass()} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass()}>Manufacturable</span>
                  <select name="manufacturable" defaultValue={quote.manufacturable || ""} className={inputClass()}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </select>
                </label>

                <label className="block">
                  <span className={labelClass()}>CAD required</span>
                  <select name="cadRequired" defaultValue={quote.cad_required || ""} className={inputClass()}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className={labelClass()}>Complexity</span>
                <select name="complexity" defaultValue={quote.complexity || ""} className={inputClass()}>
                  <option value="">Not set</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="block">
                <span className={labelClass()}>Internal notes</span>
                <textarea name="internalNotes" defaultValue={quote.internal_notes || ""} rows={7} className={`${inputClass()} min-h-[180px]`} />
              </label>
            </div>
          </section>

          <section className={sectionCard()}>
            <h2 className="text-lg font-bold text-slate-900">Research & pricing</h2>
            <div className="mt-5 space-y-4">
              <div>
                <p className={labelClass()}>Search context</p>
                <p className="mt-1 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-slate-700">{searchContext || "—"}</p>
              </div>

              <ResearchTools searchContext={searchContext} />

              <label className="block">
                <span className={labelClass()}>Research notes</span>
                <textarea name="researchNotes" defaultValue={quote.research_notes || ""} rows={6} className={`${inputClass()} min-h-[160px]`} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass()}>CAD cost min</span>
                  <input name="cadCostMin" type="number" step="0.01" defaultValue={quote.cad_cost_min ?? ""} className={inputClass()} />
                </label>
                <label className="block">
                  <span className={labelClass()}>CAD cost max</span>
                  <input name="cadCostMax" type="number" step="0.01" defaultValue={quote.cad_cost_max ?? ""} className={inputClass()} />
                </label>
                <label className="block">
                  <span className={labelClass()}>Manufacturing cost min</span>
                  <input name="manufacturingCostMin" type="number" step="0.01" defaultValue={quote.manufacturing_cost_min ?? ""} className={inputClass()} />
                </label>
                <label className="block">
                  <span className={labelClass()}>Manufacturing cost max</span>
                  <input name="manufacturingCostMax" type="number" step="0.01" defaultValue={quote.manufacturing_cost_max ?? ""} className={inputClass()} />
                </label>
                <label className="block">
                  <span className={labelClass()}>Total estimate min</span>
                  <input name="totalEstimateMin" type="number" step="0.01" defaultValue={quote.total_estimate_min ?? ""} className={inputClass()} />
                </label>
                <label className="block">
                  <span className={labelClass()}>Total estimate max</span>
                  <input name="totalEstimateMax" type="number" step="0.01" defaultValue={quote.total_estimate_max ?? ""} className={inputClass()} />
                </label>
              </div>

              <label className="block">
                <span className={labelClass()}>Estimate confidence</span>
                <select name="estimateConfidence" defaultValue={quote.estimate_confidence || ""} className={inputClass()}>
                  <option value="">Not set</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </section>

          <section className="xl:col-span-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Pricing snapshot</h2>
                <p className="text-sm text-slate-600">These are internal working values only.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CAD</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatMoney(quote.cad_cost_min)} – {formatMoney(quote.cad_cost_max)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manufacturing</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatMoney(quote.manufacturing_cost_min)} – {formatMoney(quote.manufacturing_cost_max)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                  <p className="mt-1 font-semibold text-slate-900">{formatMoney(quote.total_estimate_min)} – {formatMoney(quote.total_estimate_max)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence</p>
                  <p className="mt-1 font-semibold text-slate-900">{quote.estimate_confidence || "—"}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                name="workbenchAction"
                value="send_refined_quote"
                className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
              >
                Send refined quote
              </button>
              <button
                type="submit"
                name="workbenchAction"
                value="ask_more_details"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ask for more details
              </button>
              <button
                type="submit"
                name="workbenchAction"
                value="reject"
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Reject
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}
