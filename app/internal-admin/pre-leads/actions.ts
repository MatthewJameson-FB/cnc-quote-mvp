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
