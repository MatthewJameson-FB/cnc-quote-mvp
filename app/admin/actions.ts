"use server";

import { revalidatePath } from "next/cache";
import {
  defaultQuoteStatus,
  quoteStatusOptions,
  type QuoteStatus,
} from "@/lib/quote-statuses";
import { sendIntroductionEmail } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedStatuses = new Set<QuoteStatus>(
  quoteStatusOptions.map((option) => option.value)
);

export async function updateQuoteStatus(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const status = String(formData.get("status") ?? defaultQuoteStatus).trim();

  if (!quoteId) {
    throw new Error("Missing quote id.");
  }

  if (!allowedStatuses.has(status as QuoteStatus)) {
    throw new Error("Invalid quote status.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
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

  const { error } = await supabase
    .from("quotes")
    .update({
      introduced: true,
      introduced_at: new Date().toISOString(),
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
    accept_url: `${getAppBaseUrl()}/api/lead/accept?token=${encodeURIComponent(
      partnerAcceptToken
    )}`,
  });

  revalidatePath("/admin");
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
