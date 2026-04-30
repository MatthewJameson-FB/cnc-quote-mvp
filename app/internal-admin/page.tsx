import { requireAdminUser } from "@/lib/admin-auth";
import { calculateRevenue } from "@/lib/revenue";
import {
  defaultQuoteStatus,
  quoteStatusLabels,
  type QuoteStatus,
} from "@/lib/quote-statuses";
import { normalizeQuoteVisibilityStatus, quoteVisibilityLabel, type QuoteVisibilityStatus } from "@/lib/quote-visibility";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import ConfirmActionButton from "./ConfirmActionButton";
import CopyFollowupQuestionsButton from "./CopyFollowupQuestionsButton";
import CopySupplierBriefButton from "./CopySupplierBriefButton";
import QuoteVisibilityActions from "./QuoteVisibilityActions";
import { generateSupplierBrief } from "@/lib/supplier-brief";
import {
  deleteTestQuote,
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
  contacted_at?: string | null;
  converted_at?: string | null;
  dismissed_reason?: string | null;
  dismissed_at?: string | null;
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

const visibilityTone: Record<QuoteVisibilityStatus, string> = {
  active: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  contacted: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  converted: "bg-violet-100 text-violet-900 ring-1 ring-violet-200",
  dismissed: "bg-red-100 text-red-900 ring-1 ring-red-200",
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

function displayQuoteStatusLabel(status: string | null | undefined) {
  const visibilityStatus = normalizeQuoteVisibilityStatus(status);

  if (visibilityStatus !== "active") {
    return quoteVisibilityLabel(visibilityStatus);
  }

  if (!status || status === "active") {
    return "Active";
  }

  return status in quoteStatusLabels ? (status as QuoteStatus) : defaultQuoteStatus;
}

function quoteStatusTone(status: string | null | undefined) {
  const visibilityStatus = normalizeQuoteVisibilityStatus(status);

  if (visibilityStatus !== "active") {
    return visibilityTone[visibilityStatus];
  }

  if (status && status in statusTone) {
    return statusTone[status as QuoteStatus];
  }

  return visibilityTone.active;
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

function photoAssessmentConfidenceValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "photo_assessment_confidence") || "";
}

function photoMissingItemsValue(quote: QuoteRecord) {
  return extractNoteList(quote.notes, "photo_missing_items");
}

function photoFollowupQuestions(quote: QuoteRecord) {
  return extractNoteList(quote.notes, "photo_followup_questions");
}

function descriptionValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "description") || "—";
}

function measurementsValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "measurements") || "";
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

function labelManufacturingType(type: string) {
  if (type === "3d_print") return "3D print";
  if (type === "cnc") return "CNC";
  if (type === "fabrication") return "Fabrication";
  return type;
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

function marginValue(quote: QuoteRecord) {
  const finalQuote = finalQuoteAmount(quote);
  const supplierCost = supplierFeeAmount(quote);

  if (finalQuote == null || supplierCost == null) {
    return null;
  }

  return finalQuote - supplierCost;
}

function estimateConfidenceValue(quote: QuoteRecord) {
  return extractNoteValue(quote.notes, "estimate_confidence") || "—";
}

function needsCadRecreation(quote: QuoteRecord) {
  const stage = stageValue(quote);
  const routing = routingValue(quote);
  return routing === "cad_required" || stage === "needs_cad" || stage === "needs_both";
}

function nextActionText(quote: QuoteRecord) {
  const commercialStatus = commercialQuoteStatus(quote);
  const routing = routingValue(quote);
  const estimateAccepted = extractNoteValue(quote.notes, "estimate_accepted") === "true";

  if (commercialStatus === "awaiting_final_details") return "Send follow-up to customer";
  if (commercialStatus === "sent_to_supplier") return "Waiting for supplier quote";
  if (estimateAccepted) return "Prepare supplier brief";
  if (routing === "3d_print" || routing === "cnc") return "Send to supplier";
  return "Review request";
}

function buildAlerts(quote: QuoteRecordWithFile) {
  const alerts: string[] = [];
  if (quote.photoUrls.length && !measurementsValue(quote)) alerts.push("Missing measurements");
  if (photoReadinessValue(quote) === "needs_more_angles" || photoReadinessValue(quote) === "needs_scale_reference") {
    alerts.push("Needs more photos");
  }
  if (photoAssessmentConfidenceValue(quote) === "low" || estimateConfidenceValue(quote) === "low") {
    alerts.push("Low confidence");
  }
  if (needsCadRecreation(quote)) alerts.push("Needs CAD recreation");
  return alerts;
}

function isTestLikeQuote(quote: QuoteRecord) {
  if (process.env.NODE_ENV !== "production") return true;
  const haystack = `${quote.name ?? ""}\n${quote.email ?? ""}\n${quote.notes ?? ""}`.toLowerCase();
  return haystack.includes("test");
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
  const visibilityStatus = normalizeQuoteVisibilityStatus(quote.status);
  const commercialStatus = commercialQuoteStatus(quote);
  const feeStatus = supplierFeeStatus(quote);
  const quoteRef = formatQuoteRef(quote);
  const followupQuestions = photoFollowupQuestions(quote);
  const alerts = buildAlerts(quote);
  const estimateConfidence = estimateConfidenceValue(quote);
  const canDelete = isTestLikeQuote(quote);
  const supplierBrief = generateSupplierBrief({
    quoteId: quote.id,
    material: quote.material || "—",
    quantity: quote.quantity,
    stage: stageValue(quote),
    manufacturingType: manufacturingTypeValue(quote),
    routing: routingValue(quote),
    estimateRange: formatEstimateRange(quote),
    description: descriptionValue(quote),
    measurements: measurementsValue(quote),
    fitFunction: descriptionValue(quote),
    fileUrl: quote.fileUrl,
    photoUrls: quote.photoUrls,
    photoReadiness: photoReadinessValue(quote),
    photoAssessmentConfidence: photoAssessmentConfidenceValue(quote),
    photoMissingItems: photoMissingItemsValue(quote),
    cadBrief: cadBriefValue(quote),
    followupQuestions,
  });
  const margin = marginValue(quote);
  const description = descriptionValue(quote);
  const nextAction = nextActionText(quote);
  const isDismissed = visibilityStatus === "dismissed";

  return (
    <article className={`rounded-3xl border bg-white p-5 shadow-sm ${isDismissed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={quoteStatusTone(quote.status)}>{displayQuoteStatusLabel(quote.status)}</Badge>
            <Badge tone={commercialQuoteTone[commercialStatus] ?? commercialQuoteTone.submitted}>
              {labelCommercialStatus(commercialStatus)}
            </Badge>
            <Badge tone={supplierFeeTone[feeStatus] ?? supplierFeeTone.not_due}>{feeStatus}</Badge>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</p>
            <p className="text-lg font-semibold text-slate-900">{nextAction}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote ref</p>
            <p className="text-base font-bold text-slate-900">{quoteRef}</p>
            <p className="text-sm text-slate-500">{quote.name || "No customer name"} · {quote.email || "No customer email"}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{formatEstimateRange(quote)}</p>
          <p className="text-sm text-slate-500">Created {formatDate(quote.created_at)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
          <p className="mt-1 font-medium text-slate-900">{description}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manufacturing</p>
          <p className="mt-1 font-medium text-slate-900">{labelManufacturingType(manufacturingTypeValue(quote))}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Material</p>
          <p className="mt-1 font-medium text-slate-900">{quote.material || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence</p>
          <p className="mt-1 font-medium text-slate-900">{estimateConfidence}</p>
        </div>
      </div>

      {alerts.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Alerts</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {followupQuestions.length ? <CopyFollowupQuestionsButton questions={followupQuestions} /> : null}
              <CopySupplierBriefButton brief={supplierBrief} />
              <QuoteVisibilityActions quoteId={quote.id} status={visibilityStatus} />
              <form action={updateCommercialQuoteStatus}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="quoteStatus" value="awaiting_final_details" />
                <button className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900 hover:bg-cyan-100">
                  Mark awaiting details
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
              {canDelete ? (
                <ConfirmActionButton
                  action={deleteTestQuote}
                  fields={[{ name: "quoteId", value: quote.id }]}
                  label="Delete test quote"
                  confirmMessage="Delete this test quote? This cannot be undone."
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                />
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

          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">View full details</summary>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Measurements</p>
                <p className="mt-1">{measurementsValue(quote) || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files / photos</p>
                <div className="mt-1 space-y-1">
                  <p>File: {quote.fileUrl ? <a href={quote.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open file</a> : quote.file_path ? <span className="text-amber-700">File link unavailable</span> : "None"}</p>
                  <p>Photos:</p>
                  <ul className="list-disc pl-5">
                    {quote.photoUrls.length ? quote.photoUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{url}</a></li>) : <li>None</li>}
                  </ul>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CAD notes</p>
                <p className="mt-1 whitespace-pre-wrap">{cadBriefValue(quote)}</p>
                {followupQuestions.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {followupQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full notes</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{quote.notes || "—"}</pre>
              </div>
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Partner</p>
                  <p className="mt-1 font-medium text-slate-900">{quote.partner_name || "—"}</p>
                  <p className="text-slate-500">{quote.partner_email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
                  <p>Contacted: {formatDate(quote.contacted_at ?? null)}</p>
                  <p>Converted: {formatDate(quote.converted_at ?? null)}</p>
                  <p>Dismissed: {formatDate(quote.dismissed_at ?? null)}</p>
                  <p>Quoted: {formatDate(quote.quoted_at)}</p>
                  <p>Won: {formatDate(quote.won_at)}</p>
                  <p>Lost: {formatDate(quote.lost_at)}</p>
                  <p>Invoiced: {formatDate(quote.invoiced_at)}</p>
                  <p>Paid: {formatDate(quote.paid_at)}</p>
                </div>
              </div>
            </div>
          </details>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commercial info</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3"><span>Supplier cost</span><span className="font-medium text-slate-900">{formatMoney(supplierFeeAmount(quote))}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Final quote</span><span className="font-medium text-slate-900">{formatMoney(finalQuoteAmount(quote))}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Margin</span><span className="font-medium text-slate-900">{margin == null ? "—" : formatMoney(margin)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Quote status</span><span className="font-medium text-slate-900">{labelCommercialStatus(commercialStatus)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAdminUser();

  const params = (await searchParams) ?? {};
  const filter = (params.status ?? "active").toLowerCase();

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

  const allQuotes = quotesWithFileLinks.map((quote) => ({
    ...quote,
    visibilityStatus: normalizeQuoteVisibilityStatus(quote.status),
  }));

  const visibleQuotes = allQuotes.filter((quote) => quote.visibilityStatus !== "dismissed");
  const dismissedQuotes = allQuotes.filter((quote) => quote.visibilityStatus === "dismissed");

  const counts = {
    active: visibleQuotes.filter((quote) => quote.visibilityStatus === "active").length,
    contacted: visibleQuotes.filter((quote) => quote.visibilityStatus === "contacted").length,
    converted: visibleQuotes.filter((quote) => quote.visibilityStatus === "converted").length,
    all: allQuotes.length,
    dismissed: dismissedQuotes.length,
  };

  const filteredQuotes = allQuotes.filter((quote) => {
    if (filter === "all") return true;
    if (filter === "dismissed") return quote.visibilityStatus === "dismissed";
    if (filter === "in_progress") return quote.visibilityStatus === "contacted";
    if (filter === "converted") return quote.visibilityStatus === "converted";
    return quote.visibilityStatus === "active";
  });

  const totalPipelineValue = visibleQuotes.reduce(
    (sum, quote) => sum + (quote.job_value ?? 0),
    0
  );
  const totalRevenue = visibleQuotes.reduce(
    (sum, quote) => sum + calculateRevenue({ status: quote.status, job_value: quote.job_value }).total_revenue,
    0
  );
  const conversionRate = counts.contacted ? counts.converted / counts.contacted : 0;

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

        <div className="flex flex-wrap gap-3">
          <a
            href="/internal-admin/pre-leads"
            className="inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700"
          >
            Review pre-leads
          </a>
          <a
            href="/admin/discovery-groups"
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Discovery Groups
          </a>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Active quotes" value={String(counts.active)} />
          <StatCard label="Contacted" value={String(counts.contacted)} />
          <StatCard label="Converted" value={String(counts.converted)} />
          <StatCard label="Conversion rate" value={`${Math.round(conversionRate * 100)}%`} />
          <StatCard label="Pipeline value" value={formatMoney(totalPipelineValue)} />
          <StatCard label="Total revenue" value={formatMoney(totalRevenue)} />
        </section>

        <section className="flex flex-wrap gap-2">
          <a href="/internal-admin?status=active" className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === "active" ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            Active ({counts.active})
          </a>
          <a href="/internal-admin?status=in_progress" className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === "in_progress" ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            In progress ({counts.contacted})
          </a>
          <a href="/internal-admin?status=converted" className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === "converted" ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            Converted ({counts.converted})
          </a>
          <a href="/internal-admin?status=all" className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === "all" ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            All ({counts.all})
          </a>
          <a href="/internal-admin?status=dismissed" className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === "dismissed" ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            Dismissed ({counts.dismissed})
          </a>
        </section>

        {filteredQuotes.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">
              No leads yet. New quote requests will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredQuotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
