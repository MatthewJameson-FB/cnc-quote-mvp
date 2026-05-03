import { buildResearchLinks, buildSearchContext } from "@/lib/research-context";

export type ResearchAction =
  | "ready_to_quote"
  | "needs_measurements"
  | "needs_better_photos"
  | "needs_vehicle_details"
  | "likely_not_suitable";

export type QuoteResearchInput = {
  name?: string | null;
  description?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;
  model_specifics?: string | null;
  issue_type?: string | null;
  size_estimate?: string | null;
  search_context?: string | null;
  file_path?: string | null;
  photoUrls?: string[];
  notes?: string | null;
  internal_notes?: string | null;
  overall_width?: string | null;
  overall_height?: string | null;
  depth_thickness?: string | null;
  hole_spacing?: string | null;
  clip_spacing?: string | null;
  scale_reference_photo?: string | null;
  fitment_notes?: string | null;
};

export type QuoteResearchOutput = {
  research_summary: string;
  possible_part_numbers: string;
  useful_links: Array<{ label: string; href: string }>;
  missing_requirements: string;
  suggested_next_action: ResearchAction;
  draft_message: string;
  research_status: string;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function has(value: string | null | undefined) {
  return Boolean(clean(value));
}

function joinSentence(parts: Array<string | null | undefined>) {
  return parts.map(clean).filter(Boolean).join(" ");
}

function buildMissingRequirements(quote: QuoteResearchInput) {
  const missing: string[] = [];

  if (!has(quote.vehicle_make) || !has(quote.vehicle_model) || !has(quote.vehicle_year)) {
    missing.push("vehicle make, model, and year");
  }

  const missingMeasurements = [
    !has(quote.overall_width) ? "overall width" : null,
    !has(quote.overall_height) ? "overall height" : null,
    !has(quote.depth_thickness) ? "thickness/depth" : null,
    !has(quote.hole_spacing) && !has(quote.clip_spacing) ? "hole or clip spacing" : null,
    !has(quote.scale_reference_photo) ? "scale photo with ruler or coin" : null,
  ].filter(Boolean) as string[];

  if (missingMeasurements.length) {
    missing.push(missingMeasurements.join(", "));
  }

  const hasPhotos = Boolean(quote.file_path || quote.photoUrls?.length);
  if (!hasPhotos) {
    missing.push("photos: full part, broken area, and fitment location");
  }

  return missing;
}

function looksUnsuitable(quote: QuoteResearchInput) {
  const haystack = joinSentence([
    quote.description,
    quote.issue_type,
    quote.internal_notes,
    quote.notes,
  ]).toLowerCase();

  return /\b(engine|gearbox|transmission|ecu|sensor|wiring|electrical|paint|dent|bodywork|respray|accident repair|windscreen|tyre|tire|battery)\b/.test(haystack);
}

function pickAction(quote: QuoteResearchInput, missing: string[]): ResearchAction {
  if (looksUnsuitable(quote)) return "likely_not_suitable";
  if (missing.some((item) => item.includes("vehicle"))) return "needs_vehicle_details";
  if (missing.some((item) => item.includes("photos"))) return "needs_better_photos";
  if (missing.length) return "needs_measurements";
  return "ready_to_quote";
}

function buildDraftMessage(quote: QuoteResearchInput, action: ResearchAction) {
  const name = clean(quote.name) || "there";

  if (action === "likely_not_suitable") {
    return [
      `Hi ${name},`,
      "",
      "Thanks for sending this over.",
      "",
      "I’m not sure this is a good fit for Flangie yet, as we mainly help with small hard-to-source trim, clip, bracket, cover, and housing parts.",
      "",
      "If you can send a clear photo of the specific removable part and where it fits, I can take one more look.",
      "",
      "Thanks,",
      "Flangie",
    ].join("\n");
  }

  if (action === "needs_vehicle_details") {
    return [
      `Hi ${name},`,
      "",
      "Thanks for sending this over.",
      "",
      "Could you send the vehicle make, model, and year? If there’s a trim level or model variant, that would help too.",
      "",
      "Once I have that, I can check the part more accurately.",
      "",
      "Thanks,",
      "Flangie",
    ].join("\n");
  }

  if (action === "needs_better_photos") {
    return [
      `Hi ${name},`,
      "",
      "Thanks for sending this over.",
      "",
      "Could you send a few clear photos before I quote it? Ideally:",
      "",
      "- the full part",
      "- the broken or missing area",
      "- where it fits on the vehicle",
      "- one photo with a ruler or coin for scale",
      "",
      "Then I can take a proper look.",
      "",
      "Thanks,",
      "Flangie",
    ].join("\n");
  }

  if (action === "needs_measurements") {
    return [
      `Hi ${name},`,
      "",
      "Thanks for sending this over.",
      "",
      "This looks like it may be possible, but for a good fit I’d need a few measurements:",
      "",
      "- overall width",
      "- overall height",
      "- thickness/depth",
      "- spacing between any holes or clips",
      "- one photo with a ruler or coin next to the part",
      "",
      "Once I have those, I can take a proper look and confirm the next step.",
      "",
      "Thanks,",
      "Flangie",
    ].join("\n");
  }

  return [
    `Hi ${name},`,
    "",
    "Thanks for the details — this looks like enough to review properly.",
    "",
    "I’m going to check the part references and manufacturing route, then come back with the next step before anything is confirmed.",
    "",
    "Thanks,",
    "Flangie",
  ].join("\n");
}

function buildPartNumberNotes(searchContext: string, quote: QuoteResearchInput) {
  const vehicle = joinSentence([quote.vehicle_year, quote.vehicle_make, quote.vehicle_model, quote.model_specifics]);
  const part = clean(quote.description) || clean(quote.issue_type) || "part";

  return [
    "No confirmed part number yet — verify manually before quoting.",
    vehicle ? `Start with: ${vehicle} ${part} part number.` : `Start with: ${part} part number plus vehicle make/model/year.`,
    `Useful manual queries: \"${searchContext} part number\", \"${searchContext} OEM\", \"${searchContext} diagram\".`,
  ].join("\n");
}

export function runQuoteResearchAssistant(quote: QuoteResearchInput): QuoteResearchOutput {
  const searchContext =
    clean(quote.search_context) ||
    buildSearchContext({
      vehicle_make: quote.vehicle_make,
      vehicle_model: quote.vehicle_model,
      vehicle_year: quote.vehicle_year,
      model_specifics: quote.model_specifics,
      description: quote.description,
      issue_type: quote.issue_type,
      size_estimate: quote.size_estimate,
    });

  const missing = buildMissingRequirements(quote);
  const suggestedAction = pickAction(quote, missing);
  const vehicle = joinSentence([quote.vehicle_year, quote.vehicle_make, quote.vehicle_model, quote.model_specifics]) || "vehicle not fully specified";
  const part = clean(quote.description) || clean(quote.issue_type) || "part not clearly described";
  const photoCount = (quote.photoUrls?.length ?? 0) + (quote.file_path ? 1 : 0);

  return {
    research_summary: [
      `Workbench research prepared for ${vehicle}.`,
      `Part/request: ${part}.`,
      `Search context: ${searchContext || "not available"}.`,
      `${photoCount} photo/file reference${photoCount === 1 ? "" : "s"} available.`,
      "Use the links to manually verify part numbers, references, forum examples, and STL/CAD feasibility before quoting.",
    ].join("\n"),
    possible_part_numbers: buildPartNumberNotes(searchContext || part, quote),
    useful_links: buildResearchLinks(searchContext || part),
    missing_requirements: missing.length ? missing.map((item) => `- ${item}`).join("\n") : "No obvious missing requirements. Verify fitment and dimensions before sending a quote.",
    suggested_next_action: suggestedAction,
    draft_message: buildDraftMessage(quote, suggestedAction),
    research_status: "completed",
  };
}
