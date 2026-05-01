"use server";

import { revalidatePath } from "next/cache";
import { defaultQuoteStatus, quoteStatusOptions, type QuoteStatus } from "@/lib/quote-statuses";
import { sendIntroductionEmail } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedStatuses = new Set<QuoteStatus>(
  quoteStatusOptions.map((option) => option.value)
);
type CommercialQuoteStatus =
  | "submitted"
  | "awaiting_final_details"
  | "sent_to_supplier"
  | "supplier_accepted"
  | "customer_accepted"
  | "invoice_sent"
  | "paid"
  | "completed"
  | "lost";

const allowedCommercialQuoteStatuses = new Set<CommercialQuoteStatus>([
  "submitted",
  "awaiting_final_details",
  "sent_to_supplier",
  "supplier_accepted",
  "customer_accepted",
  "invoice_sent",
  "paid",
  "completed",
  "lost",
]);

type SupplierFeeStatus = "not_due" | "due" | "invoiced" | "paid" | "waived";

const allowedSupplierFeeStatuses = new Set<SupplierFeeStatus>([
  "not_due",
  "due",
  "invoiced",
  "paid",
  "waived",
]);

type InvoiceStatus = "unbilled" | "invoiced" | "paid";
const allowedInvoiceStatuses = new Set<InvoiceStatus>(["unbilled", "invoiced", "paid"]);

type WorkbenchManufacturable = "yes" | "no" | "maybe";
type WorkbenchComplexity = "low" | "medium" | "high";
type WorkbenchCadRequired = "yes" | "no";
type WorkbenchAction = "save" | "send_refined_quote" | "ask_more_details" | "reject";

const allowedWorkbenchManufacturable = new Set<WorkbenchManufacturable>(["yes", "no", "maybe"]);
const allowedWorkbenchComplexities = new Set<WorkbenchComplexity>(["low", "medium", "high"]);
const allowedWorkbenchCadRequired = new Set<WorkbenchCadRequired>(["yes", "no"]);
const allowedWorkbenchActions = new Set<WorkbenchAction>(["save", "send_refined_quote", "ask_more_details", "reject"]);

function nowIso() {
  return new Date().toISOString();
}

function isDebugEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.PRELEAD_DEBUG ?? "").trim());
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid number.");
  }

  return parsed;
}

function cleanString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function isEmpty(value: string | null | undefined) {
  return !String(value ?? "").trim();
}

function appendTrackingNote(existingNotes: string | null, title: string, entries: Array<string | null>) {
  return [existingNotes?.trim() || null, `--- ${title} ---`, ...entries]
    .filter(Boolean)
    .join("\n");
}

function isMissingColumnError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");

  return /column .* does not exist|could not find the .* column|schema cache/i.test(message);
}

async function updateQuoteWithCommercialFallback(
  quoteId: string,
  update: Record<string, unknown>,
  noteTitle: string,
  noteEntries: Array<string | null>
) {
  const supabase = createSupabaseAdminClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("notes")
    .eq("id", quoteId)
    .single();

  if (quoteError) {
    throw new Error(quoteError.message);
  }

  const notes = appendTrackingNote((quote.notes as string | null) ?? null, noteTitle, noteEntries);
  let { error } = await supabase.from("quotes").update({ ...update, notes }).eq("id", quoteId);

  if (error && isMissingColumnError(error)) {
    const fallback = await supabase.from("quotes").update({ notes }).eq("id", quoteId);
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function updateQuoteWorkbenchFields(quoteId: string, update: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("quotes").update(update).eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateQuoteStatus(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const status = String(formData.get("status") ?? defaultQuoteStatus).trim() as QuoteStatus;

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (!allowedStatuses.has(status)) {
    throw new Error("Invalid quote status.");
  }

  const update: Record<string, unknown> = { status };

  if (status === "quoted") {
    update.quoted_at = nowIso();
  }

  if (status === "won") {
    update.won_at = nowIso();
  }

  if (status === "lost") {
    update.lost_at = nowIso();
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("quotes").update(update).eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/internal-admin");
}

export async function updateQuoteJobValue(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const jobValue = parseOptionalNumber(formData.get("jobValue"));

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("quotes")
    .update({ job_value: jobValue })
    .eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/internal-admin");
}

export async function updateInvoiceStatus(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const invoiceStatus = String(formData.get("invoiceStatus") ?? "unbilled").trim();

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (!allowedInvoiceStatuses.has(invoiceStatus as InvoiceStatus)) {
    throw new Error("Invalid invoice status.");
  }

  const update: Record<string, unknown> = { invoice_status: invoiceStatus };

  if (invoiceStatus === "invoiced") {
    update.invoiced_at = nowIso();
  }

  if (invoiceStatus === "paid") {
    update.invoiced_at = nowIso();
    update.paid_at = nowIso();
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("quotes").update(update).eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/internal-admin");
}

export async function updateCommercialQuoteStatus(formData: FormData) {
  const quoteId = cleanString(formData.get("quoteId"));
  const quoteStatus = cleanString(formData.get("quoteStatus")) as CommercialQuoteStatus;
  const timestamp = nowIso();

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (!allowedCommercialQuoteStatuses.has(quoteStatus)) {
    throw new Error("Invalid commercial quote status.");
  }

  const update: Record<string, unknown> = {
    quote_status: quoteStatus,
  };

  if (quoteStatus === "invoice_sent") {
    update.invoice_status = "invoiced";
    update.invoiced_at = timestamp;
  }

  if (quoteStatus === "paid") {
    update.invoice_status = "paid";
    update.invoiced_at = timestamp;
    update.paid_at = timestamp;
  }

  if (quoteStatus === "lost") {
    update.status = "lost";
    update.lost_at = timestamp;
  }

  if (quoteStatus === "supplier_accepted") {
    update.supplier_fee_status = "due";
  }

  if (isDebugEnabled()) {
    console.log(`quote_status_change quote_id=${quoteId} quote_status=${quoteStatus}`);
  }

  await updateQuoteWithCommercialFallback(quoteId, update, "commercial status", [
    `quote_status: ${quoteStatus}`,
    quoteStatus === "sent_to_supplier" ? `supplier_brief_sent_at: ${timestamp}` : null,
    quoteStatus === "supplier_accepted" ? "supplier_fee_status: due" : null,
    quoteStatus === "invoice_sent" ? "invoice_status: invoiced" : null,
    quoteStatus === "paid" ? "invoice_status: paid" : null,
    quoteStatus === "paid" ? `paid_at: ${timestamp}` : null,
  ]);

  revalidatePath("/internal-admin");
}

export async function saveCommercialQuoteFields(formData: FormData) {
  const quoteId = cleanString(formData.get("quoteId"));
  const supplierId = cleanString(formData.get("supplierId")) || null;
  const supplierFeeStatusRaw = cleanString(formData.get("supplierFeeStatus"));
  const supplierFeeStatus = supplierFeeStatusRaw
    ? (supplierFeeStatusRaw as SupplierFeeStatus)
    : null;
  const supplierFeeAmount = parseOptionalNumber(formData.get("supplierCost") ?? formData.get("supplierFeeAmount"));
  const finalQuoteAmount = parseOptionalNumber(formData.get("finalQuoteAmount"));
  const invoiceReference = cleanString(formData.get("invoiceReference")) || null;
  const leadTime = cleanString(formData.get("leadTime")) || null;
  const supplierNotes = cleanString(formData.get("supplierNotes")) || null;

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (supplierFeeStatus && !allowedSupplierFeeStatuses.has(supplierFeeStatus)) {
    throw new Error("Invalid supplier fee status.");
  }

  const update: Record<string, unknown> = {
    supplier_id: supplierId,
    supplier_fee_amount: supplierFeeAmount,
    final_quote_amount: finalQuoteAmount,
    invoice_reference: invoiceReference,
  };

  if (supplierFeeStatus) {
    update.supplier_fee_status = supplierFeeStatus;
  }

  if (finalQuoteAmount != null) {
    update.job_value = finalQuoteAmount;
  }

  await updateQuoteWithCommercialFallback(quoteId, update, "commercial fields", [
    supplierId ? `supplier_id: ${supplierId}` : null,
    supplierFeeStatus ? `supplier_fee_status: ${supplierFeeStatus}` : null,
    supplierFeeAmount != null ? `supplier_fee_amount: ${supplierFeeAmount}` : null,
    supplierFeeAmount != null ? `supplier_cost: ${supplierFeeAmount}` : null,
    finalQuoteAmount != null ? `final_quote_amount: ${finalQuoteAmount}` : null,
    invoiceReference ? `invoice_reference: ${invoiceReference}` : null,
    leadTime ? `lead_time: ${leadTime}` : null,
    supplierNotes ? `supplier_notes: ${supplierNotes}` : null,
  ]);

  revalidatePath("/internal-admin");
}

export async function saveQuoteWorkbench(formData: FormData) {
  const quoteId = cleanString(formData.get("quoteId"));
  const action = (cleanString(formData.get("workbenchAction")) || "save") as WorkbenchAction;

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (!allowedWorkbenchActions.has(action)) {
    throw new Error("Invalid workbench action.");
  }

  const partType = cleanString(formData.get("partType")) || null;
  const manufacturable = cleanString(formData.get("manufacturable")) as WorkbenchManufacturable;
  const cadRequired = cleanString(formData.get("cadRequired")) as WorkbenchCadRequired;
  const complexity = cleanString(formData.get("complexity")) as WorkbenchComplexity;
  const internalNotes = cleanString(formData.get("internalNotes")) || null;
  const researchNotes = cleanString(formData.get("researchNotes")) || null;
  const cadCostMin = parseOptionalNumber(formData.get("cadCostMin"));
  const cadCostMax = parseOptionalNumber(formData.get("cadCostMax"));
  const manufacturingCostMin = parseOptionalNumber(formData.get("manufacturingCostMin"));
  const manufacturingCostMax = parseOptionalNumber(formData.get("manufacturingCostMax"));
  const totalEstimateMin = parseOptionalNumber(formData.get("totalEstimateMin"));
  const totalEstimateMax = parseOptionalNumber(formData.get("totalEstimateMax"));
  const estimateConfidence = cleanString(formData.get("estimateConfidence")) || null;

  if (manufacturable && !allowedWorkbenchManufacturable.has(manufacturable)) {
    throw new Error("Invalid manufacturable value.");
  }

  if (cadRequired && !allowedWorkbenchCadRequired.has(cadRequired)) {
    throw new Error("Invalid CAD requirement value.");
  }

  if (complexity && !allowedWorkbenchComplexities.has(complexity)) {
    throw new Error("Invalid complexity value.");
  }

  const update: Record<string, unknown> = {
    part_type: isEmpty(partType) ? null : partType,
    manufacturable: isEmpty(manufacturable) ? null : manufacturable,
    cad_required: isEmpty(cadRequired) ? null : cadRequired,
    complexity: isEmpty(complexity) ? null : complexity,
    internal_notes: internalNotes,
    research_notes: researchNotes,
    cad_cost_min: cadCostMin,
    cad_cost_max: cadCostMax,
    manufacturing_cost_min: manufacturingCostMin,
    manufacturing_cost_max: manufacturingCostMax,
    total_estimate_min: totalEstimateMin,
    total_estimate_max: totalEstimateMax,
    estimate_confidence: estimateConfidence,
  };

  if (action === "ask_more_details") {
    update.quote_status = "awaiting_final_details";
  }

  if (action === "reject") {
    update.status = "lost";
    update.quote_status = "lost";
  }

  if (action === "send_refined_quote") {
    update.quote_status = "quoted";
  }

  await updateQuoteWorkbenchFields(quoteId, update);

  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath("/admin/quotes");
  revalidatePath("/internal-admin");
}

export async function introduceQuoteToPartner(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const partnerName = String(formData.get("partnerName") ?? "").trim();
  const partnerEmail = String(formData.get("partnerEmail") ?? "").trim();

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (!partnerName || !partnerEmail) {
    throw new Error("Partner name and email are required.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, quote_ref, name, email, material, quantity, file_path, created_at")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    throw new Error(quoteError?.message ?? "Quote not found.");
  }

  const partnerAcceptToken = crypto.randomUUID();

  if (!partnerAcceptToken) {
    throw new Error("Missing partner accept token.");
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      introduced: true,
      introduced_at: nowIso(),
      partner_accept_token: partnerAcceptToken,
      partner_accepted: false,
      accepted_at: null,
      status: "introduced",
      partner_name: partnerName,
      partner_email: partnerEmail,
    })
    .eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  let fileUrl: string | null = null;

  if (quote.file_path) {
    const { data: fileData } = await supabase.storage
      .from("quote-files")
      .createSignedUrl(quote.file_path, 60 * 60 * 4);

    fileUrl = fileData?.signedUrl ?? null;
  }

  void sendIntroductionEmail({
    quote_ref: quote.quote_ref ?? quote.id,
    customer_name: quote.name ?? "Customer",
    email: quote.email ?? "",
    partner_email: partnerEmail,
    partner_name: partnerName,
    material: quote.material ?? "",
    quantity: quote.quantity ?? 0,
    created_at: quote.created_at,
    fileUrl,
    partner_accept_token: partnerAcceptToken,
    accept_url: `${getAppBaseUrl()}/api/lead/accept?token=${encodeURIComponent(
      partnerAcceptToken
    )}`,
  });

  revalidatePath("/internal-admin");
}

export async function deleteTestQuote(formData: FormData) {
  const quoteId = cleanString(formData.get("quoteId"));

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error: lookupError } = await supabase
    .from("quotes")
    .select("id, name, email, notes")
    .eq("id", quoteId)
    .single();

  if (lookupError || !quote) {
    throw new Error(lookupError?.message ?? "Quote not found.");
  }

  const haystack = `${quote.name ?? ""}\n${quote.email ?? ""}\n${quote.notes ?? ""}`.toLowerCase();
  const isAllowed = process.env.NODE_ENV !== "production" || haystack.includes("test");

  if (!isAllowed) {
    throw new Error("Refusing to delete non-test quote.");
  }

  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  console.log(`admin_delete_test_quote quote_id=${quoteId} email=${quote.email ? "present" : "missing"}`);
  revalidatePath("/internal-admin");
}

function getAppBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();

  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}
