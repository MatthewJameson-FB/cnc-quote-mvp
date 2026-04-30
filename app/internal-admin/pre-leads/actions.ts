"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin-auth";
import { buildManualPrelead } from "@/lib/preleads";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PreLeadStatus } from "@/lib/pre-lead-statuses";

function nowIso() {
  return new Date().toISOString();
}

async function updatePreLeadStatus(preLeadId: string, status: PreLeadStatus) {
  await requireAdminUser();
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
  await requireAdminUser();
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

export async function createManualPrelead(formData: FormData) {
  await requireAdminUser();
  const source = String(formData.get("source") ?? "").trim().toLowerCase();
  const postUrl = String(formData.get("post_url") ?? "").trim();
  const postText = String(formData.get("post_text") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const discoveryGroupId = String(formData.get("discovery_group_id") ?? "").trim();

  if (!["facebook", "instagram", "other"].includes(source)) {
    throw new Error("Invalid source.");
  }

  if (!postUrl) {
    throw new Error("Missing post URL.");
  }

  try {
    const parsedUrl = new URL(postUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol.");
    }
  } catch {
    throw new Error("Post URL must be a valid http(s) URL.");
  }

  if (!postText) {
    throw new Error("Missing post text.");
  }

  const lead = buildManualPrelead({
    source: source as "facebook" | "instagram" | "other",
    post_url: postUrl,
    post_text: postText,
    notes:
      [notes, discoveryGroupId ? `discovery_group_id: ${discoveryGroupId}` : ""]
        .filter(Boolean)
        .join("\n") || undefined,
  });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("pre_leads").upsert(
    {
      created_at: lead.created_at,
      source: lead.source,
      source_url: lead.source_url,
      source_author: lead.source_author,
      title: lead.title,
      snippet: lead.snippet,
      matched_keywords: lead.detected_keywords,
      detected_materials: lead.detected_materials,
      location_signal: lead.location_signal,
      lead_score: lead.lead_score,
      value_tier: lead.value_tier,
      value_score: lead.value_score,
      value_reason: lead.value_reason,
      suggested_reply: lead.suggested_reply,
      should_reply: lead.should_reply,
      thread_context_summary: lead.thread_context_summary ?? null,
      manual_notes: lead.manual_notes ?? null,
      status: "new",
      reviewed_at: null,
      contacted_at: null,
    },
    { onConflict: "source_url" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/internal-admin/pre-leads");
}
