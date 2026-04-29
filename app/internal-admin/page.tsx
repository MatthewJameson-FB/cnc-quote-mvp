import { requireAdminUser } from "@/lib/admin-auth";
import { calculateRevenue } from "@/lib/revenue";
import {
  defaultQuoteStatus,
  quoteStatusLabels,
  type QuoteStatus,
} from "@/lib/quote-statuses";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import CopyFollowupQuestionsButton from "./CopyFollowupQuestionsButton";
import CopySupplierBriefButton from "./CopySupplierBriefButton";
import { generateSupplierBrief } from "@/lib/supplier-brief";
import {
  introduceQuoteToPartner,
  saveCommercialQuoteFields,
  updateCommercialQuoteStatus,
  updateQuoteJobValue,
} from "../admin/actions";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";

type QuoteRecord = {
  id: string;
  quote_ref: string | null;
  name: string | null;
  email: string | null;
  introduced: boolean | null;
  introduced_at: string | null;
  partner_email: string | null;
  partner_name: string | null;
  partner_accepted: boolean | null;
  accepted_at: string | null;
  material: string | null;
  complexity: string | null;
  volume_cm3: number | null;
  quantity: number | null;
  quote_low: number | null;
  quote_high: number | null;
  created_at: string;
  file_path: string | null;
  notes: string | null;
  status: string | null;
  quote_status?: string | null;
  supplier_id?: string | null;
  supplier_fee_status?: string | null;
  supplier_fee_amount?: number | null;
  customer_estimate_min?: number | null;
  customer_estimate_max?: number | null;
  final_quote_amount?: number | null;
  invoice_reference?: string | null;
  job_value: number | null;
  quoted_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  invoice_status: string | null;
  invoice_notes: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
};

type QuoteRecordWithFile = QuoteRecord & {
  fileUrl: string | null;
  photoUrls: string[];
};

const statusTone: Record<QuoteStatus, string> = {
  new: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  introduced: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",
  accepted: "bg-green-100 text-green-900 ring-1 ring-green-200",
  quoted: "bg-violet-100 text-violet-900 ring-1 ring-violet-200",
  won: "bg-green-100 text-green-900 ring-1 ring-green-200",
  lost: "bg-red-100 text-red-900 ring-1 ring-red-200",
};

const invoiceTone: Record<string, string> = {
  unbilled: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  invoiced: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  paid: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
};

const commercialQuoteTone: Record<string, string> = {
  submitted: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  awaiting_final_details: "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200",
  sent_to_supplier: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",
  supplier_accepted: "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200",
  customer_accepted: "bg-violet-100 text-violet-900 ring-1 ring-violet-200",
  invoice_sent: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  paid: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  completed: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  lost: "bg-red-100 text-red-900 ring-1 ring-red-200",
};

const supplierFeeTone: Record<string, string> = {
  not_due: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  due: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  invoiced: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",
  paid: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  waived: "bg-slate-200 text-slate-700 ring-1 ring-slate-300",
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function formatMoney(value: number | null | undefined) {
  return value == null ? "—" : moneyFormatter.format(value);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function displayStatus(status: string | null | undefined) {
  if (!status) {
    return defaultQuoteStatus;
  }

  return status in quoteStatusLabels ? (status as QuoteStatus) : defaultQuoteStatus;
}

function displayStatusLabel(status: string | null | undefined) {
  const resolved = displayStatus(status);
  return quoteStatusLabels[resolved] ?? status ?? defaultQuoteStatus;
}

function formatQuoteRef(quote: QuoteRecord) {
  return quote.quote_ref || `CNC-${quote.id.slice(0, 8).toUpperCase()}`;
}

function extractNoteValue(notes: string | null | undefined, key: string) {
  if (!notes) return null;

  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gm")));
  const lastMatch = matches.at(-1);
  return lastMatch?.[1]?.trim() || null;
}

function extractNoteList(notes: string | null | undefined, key: string) {
  const raw = extractNoteValue(notes, key);
  if (!raw) return [];

  return raw
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractCommaNoteList(notes: string | null | undefined, key: string) {
  const raw = extractNoteValue(notes, key);
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatEstimateRange(quote: QuoteRecord) {
  if (quote.customer_estimate_min != null || quote.customer_estimate_max != null) {
    return `${formatMoney(quote.customer_estimate_min ?? null)} – ${formatMoney(quote.customer_estimate_max ?? null)}`;
  }

  return extractNoteValue(quote.notes, "rough_estimate") || "—";
}

function commercialQuoteStatus(quote: QuoteRecord) {
  return quote.quote_status || extractNoteValue(quote.notes, "quote_status") || "submitted";
}

function stageValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "stage") || "—";
}

function routingValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "routing_decision") || "review";
}

function manufacturingTypeValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "manufacturing_type") || quote.material || "—";
}

function photoReadinessValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "photo_readiness") || "—";
}

function cadBriefValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "cad_brief") || "—";
}

function photoFollowupQuestions(quote: QuoteRecord) {
  return extractNoteList(quote.notes, "photo_followup_questions");
}

function descriptionValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "description") || "—";
}

function leadTimeValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "lead_time") || "—";
}

function supplierNotesValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "supplier_notes") || "—";
}

function supplierBriefSentAt(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "supplier_brief_sent_at") || null;
}

function labelStage(stage: string) {
  if (stage === "needs_cad" || stage === "needs_file") return "Needs CAD recreation";
  if (stage === "needs_print") return "Ready for supplier quote";
  if (stage === "needs_both") return "Needs review (file + photos)";
  return stage;
}

function labelRouting(routing: string) {
  if (routing === "cad_required") return "Needs CAD recreation";
  if (routing === "3d_print" || routing === "cnc") return "Ready for supplier quote";
  return "Review";
}

function labelManufacturingType(type: string) {
  if (type === "3d_print") return "3D print";
  if (type === "cnc") return "CNC";
  if (type === "fabrication") return "Fabrication";
  return type;
}

function labelPhotoReadiness(value: string) {
  if (value === "ready_from_photos") return "Ready from photos";
  if (value === "needs_more_angles") return "Needs more angles";
  if (value === "needs_scale_reference") return "Needs scale reference";
  if (value === "needs_physical_part") return "Needs physical part";
  return value;
}

function labelCommercialStatus(status: string) {
  if (status === "awaiting_final_details") return "Awaiting final details";
  if (status === "sent_to_supplier") return "Sent to supplier";
  if (status === "submitted") return "Submitted";
  if (status === "supplier_accepted") return "Supplier accepted";
  if (status === "customer_accepted") return "Customer accepted";
  if (status === "invoice_sent") return "Invoice sent";
  if (status === "paid") return "Paid";
  if (status === "completed") return "Completed";
  if (status === "lost") return "Lost";
  return status;
}

function supplierFeeStatus(quote: QuoteRecord) {
  return quote.supplier_fee_status || extractNoteValue(quote.notes, "supplier_fee_status") || "not_due";
}

function supplierFeeAmount(quote: QuoteRecord) {
  if (quote.supplier_fee_amount != null) {
    return quote.supplier_fee_amount;
  }

  const raw = extractNoteValue(quote.notes, "supplier_fee_amount");
  return raw ? Number(raw) || null : null;
}

function finalQuoteAmount(quote: QuoteRecord) {
  if (quote.final_quote_amount != null) {
    return quote.final_quote_amount;
  }

  const raw = extractNoteValue(quote.notes, "final_quote_amount");
  return raw ? Number(raw) || quote.job_value || null : quote.job_value || null;
}

function invoiceReference(quote: QuoteRecord) {
  return quote.invoice_reference || extractNoteValue(quote.notes, "invoice_reference") || "—";
}

function marginValue(quote: QuoteRecord) {
  const finalQuote = finalQuoteAmount(quote);
  const supplierCost = supplierFeeAmount(quote);

  if (finalQuote == null || supplierCost == null) {
    return null;
  }

  return finalQuote - supplierCost;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {children}
    </span>
  );
}

function QuoteCard({ quote }: { quote: QuoteRecordWithFile }) {
  const status = displayStatus(quote.status);
  const commercialStatus = commercialQuoteStatus(quote);
  const feeStatus = supplierFeeStatus(quote);
  const revenue = calculateRevenue({ status, job_value: quote.job_value });
  const quoteRef = formatQuoteRef(quote);
  const followupQuestions = photoFollowupQuestions(quote);
  const supplierBrief = generateSupplierBrief({
    material: quote.material || "—",
    quantity: quote.quantity,
    stage: stageValue(quote),
    manufacturingType: manufacturingTypeValue(quote),
    routing: routingValue(quote),
    estimateRange: formatEstimateRange(quote),
    description: descriptionValue(quote),
    fileUrl: quote.fileUrl,
    photoUrls: quote.photoUrls,
    photoReadiness: photoReadinessValue(quote),
    cadBrief: cadBriefValue(quote),
    followupQuestions,
  });
  const margin = marginValue(quote);

  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quote ref
            </p>
            <p className="text-lg font-bold text-slate-900">{quoteRef}</p>
          </div>

          <div>
            <p className="text-lg font-semibold text-slate-900">
              {quote.name || "No customer name"}
            </p>
            <p className="text-sm text-slate-500">{quote.email || "No customer email"}</p>
          </div>
        </div>

        <div className="text-right">
          <Badge tone={statusTone[status]}>{displayStatusLabel(status)}</Badge>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Badge tone={commercialQuoteTone[commercialStatus] ?? commercialQuoteTone.submitted}>
              {labelCommercialStatus(commercialStatus)}
            </Badge>
            <Badge tone={supplierFeeTone[feeStatus] ?? supplierFeeTone.not_due}>{feeStatus}</Badge>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatMoney(quote.quote_low)} – {formatMoney(quote.quote_high)}
          </p>
          <p className="text-sm text-slate-500">{formatDate(quote.created_at)}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-slate-500">Material</dt>
          <dd className="font-medium text-slate-900">{quote.material || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Quantity</dt>
          <dd className="font-medium text-slate-900">{quote.quantity ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Complexity</dt>
          <dd className="font-medium text-slate-900">{quote.complexity || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Volume</dt>
          <dd className="font-medium text-slate-900">
            {quote.volume_cm3 == null ? "—" : `${quote.volume_cm3} cm³`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Introduced</dt>
          <dd className="font-medium text-slate-900">
            {quote.introduced ? `Yes · ${formatDate(quote.introduced_at)}` : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Accepted</dt>
          <dd className="font-medium text-slate-900">
            {quote.partner_accepted ? `Yes · ${formatDate(quote.accepted_at)}` : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Quote value</dt>
          <dd className="font-medium text-slate-900">
            {formatMoney(quote.job_value)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Stage</dt>
          <dd className="font-medium text-slate-900">{labelStage(stageValue(quote))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Routing</dt>
          <dd className="font-medium text-slate-900">{labelRouting(routingValue(quote))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Manufacturing</dt>
          <dd className="font-medium text-slate-900">{labelManufacturingType(manufacturingTypeValue(quote))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Quote status</dt>
          <dd className="font-medium text-slate-900">{labelCommercialStatus(commercialStatus)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Photo readiness</dt>
          <dd className="font-medium text-slate-900">{labelPhotoReadiness(photoReadinessValue(quote))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Customer estimate</dt>
          <dd className="font-medium text-slate-900">{formatEstimateRange(quote)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Final quote amount</dt>
          <dd className="font-medium text-slate-900">{formatMoney(finalQuoteAmount(quote))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Supplier cost</dt>
          <dd className="font-medium text-slate-900">{formatMoney(supplierFeeAmount(quote))}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Margin</dt>
          <dd className="font-medium text-slate-900">{margin == null ? "—" : formatMoney(margin)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Invoice ref</dt>
          <dd className="font-medium text-slate-900">{invoiceReference(quote)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Invoice status</dt>
          <dd className="font-medium text-slate-900">
            <Badge tone={invoiceTone[quote.invoice_status ?? "unbilled"] ?? invoiceTone.unbilled}>
              {quote.invoice_status ?? "unbilled"}
            </Badge>
          </dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Partner
              </p>
              <p className="mt-1 font-medium text-slate-900">{quote.partner_name || "—"}</p>
              <p className="text-sm text-slate-500">{quote.partner_email || "—"}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice tracking
              </p>
              <p className="mt-1 font-medium text-slate-900">{quote.invoice_status ?? "unbilled"}</p>
              <p className="text-sm text-slate-500">Invoiced: {formatDate(quote.invoiced_at)}</p>
              <p className="text-sm text-slate-500">Paid: {formatDate(quote.paid_at)}</p>
              {quote.invoice_notes ? (
                <p className="mt-2 text-sm text-slate-600">{quote.invoice_notes}</p>
              ) : null}
            </div>
          </div>

          <form action={saveCommercialQuoteFields} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <input type="hidden" name="quoteId" value={quote.id} />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Supplier id / reference
              <input
                name="supplierId"
                defaultValue={quote.supplier_id ?? extractNoteValue(quote.notes, "supplier_id") ?? ""}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Supplier fee status
              <select
                name="supplierFeeStatus"
                defaultValue={feeStatus}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="not_due">not_due</option>
                <option value="due">due</option>
                <option value="invoiced">invoiced</option>
                <option value="paid">paid</option>
                <option value="waived">waived</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Supplier cost (£)
              <input
                name="supplierCost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={supplierFeeAmount(quote) ?? ""}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Final quote (£)
              <input
                name="finalQuoteAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={finalQuoteAmount(quote) ?? ""}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Invoice reference
              <input
                name="invoiceReference"
                defaultValue={quote.invoice_reference ?? extractNoteValue(quote.notes, "invoice_reference") ?? ""}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Lead time
              <input
                name="leadTime"
                defaultValue={leadTimeValue(quote) === "—" ? "" : leadTimeValue(quote)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="e.g. 7-10 working days"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Supplier notes
              <textarea
                name="supplierNotes"
                defaultValue={supplierNotesValue(quote) === "—" ? "" : supplierNotesValue(quote)}
                className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Manual supplier notes"
              />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                Save commercial fields
              </button>
            </div>
          </form>

          <form action={updateQuoteJobValue} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="quoteId" value={quote.id} />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Job value (£)
              <input
                name="jobValue"
                type="number"
                step="0.01"
                min="0"
                defaultValue={quote.job_value ?? ""}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </label>
            <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white">
              Save value
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            <form action={updateCommercialQuoteStatus}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="quoteStatus" value="awaiting_final_details" />
              <button className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900 hover:bg-cyan-100">
                Mark awaiting final details
              </button>
            </form>
            <form action={updateCommercialQuoteStatus}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="quoteStatus" value="sent_to_supplier" />
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Mark sent to supplier
              </button>
            </form>
            <form action={updateCommercialQuoteStatus}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="quoteStatus" value="supplier_accepted" />
              <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Mark supplier accepted
              </button>
            </form>
            <form action={updateCommercialQuoteStatus}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="quoteStatus" value="invoice_sent" />
              <button className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">
                Mark invoice sent
              </button>
            </form>
            <form action={updateCommercialQuoteStatus}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="quoteStatus" value="paid" />
              <button className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100">
                Mark paid
              </button>
            </form>
            <form action={updateCommercialQuoteStatus}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="quoteStatus" value="lost" />
              <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Mark lost
              </button>
            </form>
          </div>

          <form
            action={introduceQuoteToPartner}
            className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
          >
            <input type="hidden" name="quoteId" value={quote.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Partner name
                <input
                  name="partnerName"
                  defaultValue={quote.partner_name ?? ""}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Partner name"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Partner email
                <input
                  name="partnerEmail"
                  type="email"
                  defaultValue={quote.partner_email ?? ""}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="partner@example.com"
                />
              </label>
            </div>
            <button className="w-fit rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              {quote.partner_accepted ? "Accepted" : quote.introduced ? "Introduced" : "Introduce to partner"}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue breakdown
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Lead fee</span>
                <span className="font-medium text-slate-900">{formatMoney(revenue.lead_fee)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Success fee</span>
                <span className="font-medium text-slate-900">{formatMoney(revenue.success_fee)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Total revenue</span>
                <span className="font-semibold text-slate-900">{formatMoney(revenue.total_revenue)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Timeline
            </p>
            <div className="mt-3 space-y-2 text-slate-700">
              <p>Quoted: {formatDate(quote.quoted_at)}</p>
              <p>Won: {formatDate(quote.won_at)}</p>
              <p>Lost: {formatDate(quote.lost_at)}</p>
              <p>Invoiced: {formatDate(quote.invoiced_at)}</p>
              <p>Paid: {formatDate(quote.paid_at)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              File
            </p>
            <p className="mb-2 text-sm text-slate-500">Customer replies go to inbox (manual handling)</p>
            {quote.fileUrl ? (
              <a
                href={quote.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 underline"
              >
                Open file
              </a>
            ) : quote.file_path ? (
              <span className="text-amber-700">File link unavailable</span>
            ) : (
              <span className="text-slate-400">No file uploaded</span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Supplier brief
                </p>
                <p className="mt-1 text-sm text-slate-500">Supplier communication stays manual and customer-hidden.</p>
              </div>
              <CopySupplierBriefButton brief={supplierBrief} />
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{supplierBrief}</pre>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <form action={updateCommercialQuoteStatus}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="quoteStatus" value="sent_to_supplier" />
                <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Mark sent to supplier
                </button>
              </form>
              {supplierBriefSentAt(quote) ? (
                <span className="text-sm text-slate-500">Last marked sent: {formatDate(supplierBriefSentAt(quote))}</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              CAD brief
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{cadBriefValue(quote)}</p>

            {followupQuestions.length ? (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Follow-up questions
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {followupQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
                <CopyFollowupQuestionsButton questions={followupQuestions} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function AdminPage() {
  await requireAdminUser();

  const supabase = createSupabaseAdminClient();

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const quotesWithFileLinks = await Promise.all<QuoteRecordWithFile>(
    (quotes ?? []).map(async (quote: QuoteRecord) => {
      const photoPaths = extractCommaNoteList(quote.notes, "photo_urls");
      const photoUrls = (
        await Promise.all(
          photoPaths.map(async (photoPath) => {
            const { data } = await supabase.storage.from("quote-files").createSignedUrl(photoPath, 60 * 60 * 4);
            return data?.signedUrl ?? null;
          })
        )
      ).filter((value): value is string => Boolean(value));

      if (!quote.file_path) {
        return { ...quote, fileUrl: null, photoUrls };
      }

      const { data: signedUrlData } = await supabase.storage
        .from("quote-files")
        .createSignedUrl(quote.file_path, 60 * 60 * 4);

      return {
        ...quote,
        fileUrl: signedUrlData?.signedUrl ?? null,
        photoUrls,
      };
    })
  );

  const totalLeads = quotesWithFileLinks.length;
  const acceptedLeads = quotesWithFileLinks.filter((quote) => quote.status === "accepted").length;
  const wonJobs = quotesWithFileLinks.filter((quote) => quote.status === "won").length;
  const totalPipelineValue = quotesWithFileLinks.reduce(
    (sum, quote) => sum + (quote.job_value ?? 0),
    0
  );
  const totalRevenue = quotesWithFileLinks.reduce(
    (sum, quote) => sum + calculateRevenue({ status: quote.status, job_value: quote.job_value }).total_revenue,
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lead Pipeline</h1>
            <p className="mt-2 text-slate-600">
              Track leads, revenue, and invoicing without touching the public quote flow.
            </p>
          </div>

          <form action={signOut}>
            <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Logout
            </button>
          </form>
        </header>

        <a
          href="/internal-admin/pre-leads"
          className="inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700"
        >
          Review pre-leads
        </a>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total leads" value={String(totalLeads)} />
          <StatCard label="Accepted leads" value={String(acceptedLeads)} />
          <StatCard label="Won jobs" value={String(wonJobs)} />
          <StatCard label="Pipeline value" value={formatMoney(totalPipelineValue)} />
          <StatCard label="Total revenue" value={formatMoney(totalRevenue)} />
        </section>

        {quotesWithFileLinks.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">
              No leads yet. New quote requests will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {quotesWithFileLinks.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
