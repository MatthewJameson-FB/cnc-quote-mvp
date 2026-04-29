import type { IntakeMaterialPreference, ManufacturingType } from "@/lib/intake";

export type PhotoReadiness =
  | "ready_from_photos"
  | "needs_more_angles"
  | "needs_scale_reference"
  | "needs_physical_part";

export type PhotoAssessmentConfidence = "low" | "medium" | "high";

export type PhotoAssessmentResult = {
  photo_readiness: PhotoReadiness;
  confidence: PhotoAssessmentConfidence;
  missing_items: string[];
  cad_brief: string;
  customer_followup_questions: string[];
};

export type AssessPhotoRequestInput = {
  photo_urls: string[];
  measurements: string;
  description: string;
  material: IntakeMaterialPreference;
  manufacturing_type: ManufacturingType;
};

const COMPLEX_FIT_PATTERN = /\b(clip|thread(?:ed)?|tight fit|gear|curved trim|mating surface|snap fit|interference fit|seal|hinge|bayonet|tooth profile)\b/i;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function materialLabel(material: IntakeMaterialPreference) {
  if (material === "pla_standard_plastic") return "PLA / standard plastic";
  if (material === "abs_asa") return "ABS / ASA";
  if (material === "stainless_steel") return "stainless steel";
  return material.replace(/_/g, " ");
}

function manufacturingLabel(manufacturingType: ManufacturingType) {
  if (manufacturingType === "3d_print") return "3D print";
  if (manufacturingType === "cnc") return "CNC";
  if (manufacturingType === "fabrication") return "fabrication";
  return "manufacture";
}

export function assessPhotoRequest(input: AssessPhotoRequestInput): PhotoAssessmentResult {
  const photoCount = input.photo_urls.length;
  const measurements = normalizeText(input.measurements);
  const description = normalizeText(input.description);
  const combinedText = `${measurements} ${description}`.trim();
  const hasMeasurements = Boolean(measurements);
  const hasDescription = Boolean(description);
  const scaleIsUnclear = !hasMeasurements;
  const hasComplexFitSignals = COMPLEX_FIT_PATTERN.test(combinedText);

  const missingItems: string[] = [];
  const followupQuestions: string[] = [];
  let photoReadiness: PhotoReadiness = "ready_from_photos";
  let confidence: PhotoAssessmentConfidence = hasMeasurements && hasDescription && photoCount >= 2 ? "medium" : "low";

  if (!hasMeasurements) {
    photoReadiness = "needs_scale_reference";
    missingItems.push("At least one real-world measurement in mm");
    followupQuestions.push("Can you share at least one key measurement in mm, like width, height, or hole spacing?");
    confidence = "low";
  } else if (photoCount <= 1) {
    photoReadiness = "needs_more_angles";
    missingItems.push("Front, side, and top photos of the part");
    followupQuestions.push("Can you send front, side, and top photos so we can understand the full shape?");
    confidence = "low";
  } else if (hasComplexFitSignals) {
    photoReadiness = "needs_physical_part";
    missingItems.push("Physical part review or extra fit-detail photos before CAD recreation");
    followupQuestions.push("Does this part have clips, threads, gear teeth, curved trim, or a tight mating surface we should match?");
    followupQuestions.push("If possible, can you send the physical part or additional close-up photos of the fit-critical areas?");
    confidence = "low";
  }

  if (scaleIsUnclear) {
    missingItems.push("A ruler, coin, or other reference object visible in at least one photo");
    followupQuestions.push("Please add a photo with a ruler, coin, or similar reference object for scale.");
  }

  if (photoReadiness === "ready_from_photos" && hasMeasurements && hasDescription && photoCount >= 2) {
    confidence = photoCount >= 3 ? "high" : "medium";
  }

  if (photoReadiness === "ready_from_photos" && hasComplexFitSignals) {
    confidence = "low";
    missingItems.push("Close-up fit-detail photos of the clips, threads, gear teeth, or mating surfaces");
    followupQuestions.push("Can you send close-up photos of the fit-critical details so we can review them manually?");
  }

  const dedupedMissingItems = Array.from(new Set(missingItems));
  const dedupedQuestions = Array.from(new Set(followupQuestions));

  const cadBrief = [
    `Manufacturing route: ${manufacturingLabel(input.manufacturing_type)}.`,
    `Material preference: ${materialLabel(input.material)}.`,
    `Photo set: ${photoCount} photo${photoCount === 1 ? "" : "s"}.`,
    hasMeasurements ? `Provided measurements: ${measurements}.` : "Measurements not yet provided.",
    hasDescription ? `Customer description: ${description}.` : "Customer description is limited.",
    `Assessment: ${photoReadiness} (${confidence} confidence).`,
    dedupedMissingItems.length
      ? `Still needed before remote CAD recreation: ${dedupedMissingItems.join("; ")}.`
      : "Remote CAD recreation looks feasible from the current photos, but final fit-critical dimensions still need manual confirmation.",
  ].join(" ");

  return {
    photo_readiness: photoReadiness,
    confidence,
    missing_items: dedupedMissingItems,
    cad_brief: cadBrief,
    customer_followup_questions: dedupedQuestions,
  };
}
