import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeQuoteVisibilityStatus, quoteVisibilityLabel } from "@/lib/quote-visibility";
import QuoteWorkbenchEditor from "./QuoteWorkbenchEditor";

export const dynamic = "force-dynamic";

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
  file_path: string | null;
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

type QuoteRecordWithAssets = QuoteRecord & {
  fileUrl: string | null;
  photoUrls: string[];
};

function extractNoteValue(notes: string | null | undefined, key: string) {
  if (!notes) return null;
  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gm")));
  const lastMatch = matches.at(-1);
  return lastMatch?.[1]?.trim() || null;
}

function extractCommaNoteList(notes: string | null | undefined, key: string) {
  const raw = extractNoteValue(notes, key);
  if (!raw) return [];
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

async function loadQuote(id: string): Promise<QuoteRecordWithAssets | null> {
  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(error.message);
  if (!quote) return null;

  const photoPaths = extractCommaNoteList(quote.notes, "photo_urls");
  const storage = supabase.storage.from("quote-files");
  const photoUrls = (
    await Promise.all(photoPaths.map(async (photoPath) => (await storage.createSignedUrl(photoPath, 60 * 60 * 4)).data?.signedUrl ?? null))
  ).filter((value): value is string => Boolean(value));

  let fileUrl: string | null = null;
  if (quote.file_path) {
    const { data } = await storage.createSignedUrl(quote.file_path, 60 * 60 * 4);
    fileUrl = data?.signedUrl ?? null;
  }

  return { ...quote, fileUrl, photoUrls };
}

export default async function QuoteWorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const quote = await loadQuote(id);
  if (!quote) notFound();

  const status = normalizeQuoteVisibilityStatus(quote.status);

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
            <span className="rounded-full bg-slate-100 px-3 py-1">Created {new Date(quote.created_at).toLocaleString()}</span>
          </div>
        </header>

        <QuoteWorkbenchEditor quote={quote} />
      </div>
    </main>
  );
}
