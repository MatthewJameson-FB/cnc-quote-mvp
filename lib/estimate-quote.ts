import type { IntakeMaterialPreference, LeadStage, ManufacturingType } from "@/lib/intake";

export type EstimateQuoteInput = {
  manufacturing_type: ManufacturingType;
  material: IntakeMaterialPreference;
  stage: LeadStage;
  description?: string;
  measurements?: string;
  quantity?: number;
  has_file: boolean;
  has_photos: boolean;
};

export type EstimateQuoteResult = {
  min_price: number;
  max_price: number;
  currency: "GBP";
  confidence: "low" | "medium" | "high";
  breakdown: {
    cad?: [number, number];
    manufacturing?: [number, number];
  };
  disclaimer: string;
};

type Complexity = "simple" | "medium" | "complex";

const SIMPLE_HINTS = ["clip", "cap", "cover", "spacer", "small plastic part", "trim clip", "lid"];
const MEDIUM_HINTS = ["bracket", "mount", "housing", "adapter", "enclosure", "panel", "handle"];
const COMPLEX_HINTS = ["precision", "tolerance", "thread", "gear", "engine", "mating surface", "curved trim", "bearing", "machined"];

const DISCLAIMER =
  "This is a rough estimate only. Final pricing depends on material, dimensions, tolerances, quantity, and supplier review.";

function textFromInput(input: EstimateQuoteInput) {
  return `${input.description ?? ""} ${input.measurements ?? ""}`.toLowerCase();
}

function inferComplexity(input: EstimateQuoteInput): Complexity {
  const text = textFromInput(input);

  if (COMPLEX_HINTS.some((hint) => text.includes(hint))) {
    return "complex";
  }

  if (MEDIUM_HINTS.some((hint) => text.includes(hint))) {
    return "medium";
  }

  if (SIMPLE_HINTS.some((hint) => text.includes(hint))) {
    return "simple";
  }

  if (input.manufacturing_type === "cnc" && ["steel", "stainless_steel", "brass"].includes(input.material)) {
    return "medium";
  }

  if (input.stage === "needs_file" || input.stage === "needs_both") {
    return input.has_photos ? "medium" : "simple";
  }

  if (input.has_file) return "medium";
  return "simple";
}

function manufacturingRange(type: ManufacturingType, complexity: Complexity): [number, number] {
  if (type === "3d_print") {
    if (complexity === "simple") return [10, 40];
    if (complexity === "medium") return [40, 120];
    return [120, 300];
  }

  if (type === "cnc") {
    if (complexity === "simple") return [60, 200];
    if (complexity === "medium") return [200, 600];
    return [600, 2000];
  }

  if (type === "fabrication") {
    if (complexity === "simple") return [40, 140];
    if (complexity === "medium") return [140, 450];
    return [450, 1400];
  }

  if (complexity === "simple") return [30, 120];
  if (complexity === "medium") return [120, 400];
  return [400, 1200];
}

function cadRange(complexity: Complexity): [number, number] {
  if (complexity === "simple") return [20, 80];
  if (complexity === "medium") return [80, 250];
  return [250, 800];
}

function quantityAdjusted(range: [number, number], quantity: number): [number, number] {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  if (safeQuantity === 1) return range;

  const multiplier = Math.min(3, 1 + (safeQuantity - 1) * 0.25);
  return [Math.round(range[0] * multiplier), Math.round(range[1] * multiplier)];
}

function confidence(input: EstimateQuoteInput): EstimateQuoteResult["confidence"] {
  if (input.has_file) return "high";
  if (input.has_photos && input.measurements?.trim()) return "medium";
  return "low";
}

export function estimateQuote(input: EstimateQuoteInput): EstimateQuoteResult {
  const resolvedComplexity = inferComplexity(input);
  const manufacturing = quantityAdjusted(
    manufacturingRange(input.manufacturing_type, resolvedComplexity),
    input.quantity ?? 1
  );
  const needsCad = input.stage === "needs_file" || input.stage === "needs_both";
  const cad = needsCad ? cadRange(resolvedComplexity) : undefined;

  const min_price = manufacturing[0] + (cad?.[0] ?? 0);
  const max_price = manufacturing[1] + (cad?.[1] ?? 0);

  return {
    min_price,
    max_price,
    currency: "GBP",
    confidence: confidence(input),
    breakdown: {
      ...(cad ? { cad } : {}),
      manufacturing,
    },
    disclaimer: DISCLAIMER,
  };
}
