export type LeadStage = "needs_file" | "needs_print" | "needs_both" | "unknown";

export type ManufacturingType = "3d_print" | "cnc" | "fabrication" | "unknown";

export type RoutingDecision = "cad_required" | "3d_print" | "cnc" | "review";

export type IntakeMaterialPreference =
  | "not_sure"
  | "pla_standard_plastic"
  | "resin"
  | "abs_asa"
  | "nylon"
  | "petg"
  | "aluminium"
  | "steel"
  | "stainless_steel"
  | "brass"
  | "other";

export type LeadIntake = {
  has_file?: boolean;
  has_photos?: boolean;
  stage?: LeadStage;
  manufacturing_type?: ManufacturingType;
  file_url?: string;
  photo_urls?: string[];
  measurements?: string;
  description?: string;
  routing_decision?: RoutingDecision;
  part_candidate?: boolean;
  intake_validation_reason?: string;
};

export function determineStage(hasFile: boolean, hasPhotos: boolean): LeadStage {
  if (hasFile && hasPhotos) return "needs_both";
  if (hasFile && !hasPhotos) return "needs_print";
  if (!hasFile && hasPhotos) return "needs_file";
  return "unknown";
}

export function routeLead(lead: Pick<LeadIntake, "stage" | "manufacturing_type">): RoutingDecision {
  if (lead.stage === "needs_file") {
    return "cad_required";
  }

  if (lead.stage === "needs_print") {
    if (lead.manufacturing_type === "3d_print") return "3d_print";
    if (lead.manufacturing_type === "cnc") return "cnc";
    return "review";
  }

  if (lead.stage === "needs_both") {
    return "cad_required";
  }

  return "review";
}

export function validateLeadIntake(lead: Pick<LeadIntake, "has_file" | "has_photos" | "measurements" | "description">) {
  if (!lead.has_file && !lead.has_photos) {
    return {
      isValid: false,
      reason: "missing_file_or_photo",
    };
  }

  if (lead.has_photos && !lead.measurements?.trim()) {
    return {
      isValid: false,
      reason: "photos_missing_measurements",
    };
  }

  if (lead.has_photos && !lead.description?.trim()) {
    return {
      isValid: false,
      reason: "photos_missing_description",
    };
  }

  return {
    isValid: true,
    reason: null,
  };
}

export function inferManufacturingType(material: IntakeMaterialPreference, hasFile: boolean): ManufacturingType {
  if (["pla_standard_plastic", "resin", "abs_asa", "nylon", "petg"].includes(material)) return "3d_print";
  if (["aluminium", "steel", "stainless_steel", "brass"].includes(material)) return "cnc";
  if (hasFile) return "fabrication";
  return "unknown";
}

export function measurementsPresent(measurements?: string | null) {
  return Boolean(measurements?.trim());
}
