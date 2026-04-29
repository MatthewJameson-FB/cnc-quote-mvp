"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PreLeadStatus } from "@/lib/pre-lead-statuses";

function nowIso() {
  return new Date().toISOString();
}

async function updatePreLeadStatus(preLeadId: string, status: PreLeadStatus) {
  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = { status };

  if (status === "reviewed") {
    update.reviewed_at = nowIso();
  }

  if (status === "contacted") {
    update.reviewed_at = nowIso();
    update.contacted_at = nowIso();
  }

  const { error } = await supabase.from("pre_leads").update(update).eq("id", preLeadId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/internal-admin/pre-leads");
}

export async function setPreLeadReviewed(formData: FormData) {
  const preLeadId = String(formData.get("preLeadId") ?? "").trim();

  if (!preLeadId) {
    throw new Error("Missing pre-lead id.");
  }

  await updatePreLeadStatus(preLeadId, "reviewed");
}

export async function setPreLeadRejected(formData: FormData) {
  const preLeadId = String(formData.get("preLeadId") ?? "").trim();

  if (!preLeadId) {
    throw new Error("Missing pre-lead id.");
  }

  await updatePreLeadStatus(preLeadId, "rejected");
}

export async function setPreLeadContacted(formData: FormData) {
  const preLeadId = String(formData.get("preLeadId") ?? "").trim();

  if (!preLeadId) {
    throw new Error("Missing pre-lead id.");
  }

  await updatePreLeadStatus(preLeadId, "contacted");
}

export async function deleteTestPreLead(formData: FormData) {
  const preLeadId = String(formData.get("preLeadId") ?? "").trim();

  if (!preLeadId) {
    throw new Error("Missing pre-lead id.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: lead, error: lookupError } = await supabase
    .from("pre_leads")
    .select("id, title, snippet, source_url, source_author")
    .eq("id", preLeadId)
    .single();

  if (lookupError || !lead) {
    throw new Error(lookupError?.message ?? "Pre-lead not found.");
  }

  const haystack = `${lead.title ?? ""}\n${lead.snippet ?? ""}\n${lead.source_url ?? ""}\n${lead.source_author ?? ""}`.toLowerCase();
  const isAllowed = process.env.NODE_ENV !== "production" || haystack.includes("test");

  if (!isAllowed) {
    throw new Error("Refusing to delete non-test pre-lead.");
  }

  const { error } = await supabase.from("pre_leads").delete().eq("id", preLeadId);

  if (error) {
    throw new Error(error.message);
  }

  console.log(`admin_delete_test_prelead prelead_id=${preLeadId}`);
  revalidatePath("/internal-admin/pre-leads");
}
