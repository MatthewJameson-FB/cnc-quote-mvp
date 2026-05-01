export type Material =
  | "aluminium_6082"
  | "mild_steel"
  | "stainless_steel"
  | "acetal_pom"
  | "brass";

export type Complexity = "simple" | "medium" | "complex";

export const materialRates: Record<Material, number> = {
  aluminium_6082: 0.15,
  mild_steel: 0.22,
  stainless_steel: 0.35,
  acetal_pom: 0.12,
  brass: 0.4,
};

export function calculateQuote({
  material,
  quantity,
  complexity,
}: {
  material: Material;
  quantity: number;
  complexity: Complexity;
}) {
  const category =
    complexity === "simple" ? "simple_bracket_clip" : complexity === "medium" ? "medium_trim" : "complex_housing";

  const categoryPricing: Record<typeof category, { setupFee: number; labour: number; materialWeight: number; low: number; high: number }> = {
    simple_bracket_clip: { setupFee: 35, labour: 40, materialWeight: 0.8, low: 55, high: 140 },
    medium_trim: { setupFee: 55, labour: 65, materialWeight: 1, low: 120, high: 280 },
    complex_housing: { setupFee: 85, labour: 95, materialWeight: 1.2, low: 220, high: 520 },
  };

  const band = categoryPricing[category];
  const materialCost = band.materialWeight * materialRates[material] * 100;
  const base = band.setupFee + band.labour + materialCost;
  const withQuantity = base * Math.max(1, quantity);
  const low = Math.max(band.low, Math.round(withQuantity * 0.85));
  const high = Math.max(low + 20, Math.round(withQuantity * 1.2));

  return {
    low,
    high,
    subtotal: Math.round(withQuantity),
    vatAmount: Math.round(withQuantity * 0.2),
    totalIncVat: Math.round(withQuantity * 1.2),
  };
}
