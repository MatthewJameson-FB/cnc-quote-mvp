import { NextResponse } from "next/server";
import { getAuthenticatedAdminUser, isAllowedAdminEmail } from "@/lib/admin-auth";
import { buildSearchContext } from "@/lib/research-context";
import { runQuoteResearchAssistant } from "@/lib/quote-research-assistant";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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

function isMissingColumnError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /column .* does not exist|could not find the .* column|schema cache/i.test(message);
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedAdminUser();

  if (!user || !isAllowedAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const quoteId = String(id ?? "").trim();

  if (!quoteId) {
    return NextResponse.json({ error: "Missing quote id." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quote, error } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const photoUrls = extractCommaNoteList(quote.notes, "photo_urls");
  const normalizedQuote = {
    ...quote,
    description: quote.description || extractNoteValue(quote.notes, "description"),
    vehicle_make: quote.vehicle_make || extractNoteValue(quote.notes, "vehicle_make"),
    vehicle_model: quote.vehicle_model || extractNoteValue(quote.notes, "vehicle_model"),
    vehicle_year: quote.vehicle_year || extractNoteValue(quote.notes, "vehicle_year"),
    model_specifics: quote.model_specifics || extractNoteValue(quote.notes, "model_specifics"),
    issue_type: quote.issue_type || extractNoteValue(quote.notes, "issue_type"),
    size_estimate: quote.size_estimate || extractNoteValue(quote.notes, "size_estimate"),
  };

  const searchContext =
    normalizedQuote.search_context ||
    buildSearchContext({
      vehicle_make: normalizedQuote.vehicle_make,
      vehicle_model: normalizedQuote.vehicle_model,
      vehicle_year: normalizedQuote.vehicle_year,
      model_specifics: normalizedQuote.model_specifics,
      description: normalizedQuote.description,
      issue_type: normalizedQuote.issue_type,
      size_estimate: normalizedQuote.size_estimate,
    });

  const research = runQuoteResearchAssistant({
    name: normalizedQuote.name,
    description: normalizedQuote.description,
    vehicle_make: normalizedQuote.vehicle_make,
    vehicle_model: normalizedQuote.vehicle_model,
    vehicle_year: normalizedQuote.vehicle_year,
    model_specifics: normalizedQuote.model_specifics,
    issue_type: normalizedQuote.issue_type,
    size_estimate: normalizedQuote.size_estimate,
    search_context: searchContext,
    file_path: normalizedQuote.file_path,
    photoUrls,
    notes: normalizedQuote.notes,
    internal_notes: normalizedQuote.internal_notes,
    overall_width: normalizedQuote.overall_width,
    overall_height: normalizedQuote.overall_height,
    depth_thickness: normalizedQuote.depth_thickness,
    hole_spacing: normalizedQuote.hole_spacing,
    clip_spacing: normalizedQuote.clip_spacing,
    scale_reference_photo: normalizedQuote.scale_reference_photo,
    fitment_notes: normalizedQuote.fitment_notes,
  });

  const update = {
    search_context: searchContext,
    research_summary: research.research_summary,
    possible_part_numbers: research.possible_part_numbers,
    useful_links: research.useful_links,
    missing_requirements: research.missing_requirements,
    suggested_next_action: research.suggested_next_action,
    research_status: research.research_status,
    researched_at: new Date().toISOString(),
  };

  let { error: updateError } = await supabase.from("quotes").update(update).eq("id", quoteId);

  if (updateError && isMissingColumnError(updateError)) {
    const fallbackNotes = [
      normalizedQuote.notes?.trim() || null,
      "--- research assistant ---",
      `research_summary: ${research.research_summary}`,
      `possible_part_numbers: ${research.possible_part_numbers}`,
      `useful_links: ${JSON.stringify(research.useful_links)}`,
      `missing_requirements: ${research.missing_requirements}`,
      `suggested_next_action: ${research.suggested_next_action}`,
      `research_status: ${research.research_status}`,
      `researched_at: ${update.researched_at}`,
    ].filter(Boolean).join("\n");

    const fallbackWithSearchContext = await supabase
      .from("quotes")
      .update({ search_context: searchContext, notes: fallbackNotes })
      .eq("id", quoteId);

    if (fallbackWithSearchContext.error && isMissingColumnError(fallbackWithSearchContext.error)) {
      const fallbackNotesOnly = await supabase
        .from("quotes")
        .update({ notes: fallbackNotes })
        .eq("id", quoteId);
      updateError = fallbackNotesOnly.error;
    } else {
      updateError = fallbackWithSearchContext.error;
    }
  }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ...research,
    search_context: searchContext,
    researched_at: update.researched_at,
  });
}
