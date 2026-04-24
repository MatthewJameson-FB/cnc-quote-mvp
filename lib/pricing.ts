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

export const complexityHours: Record<Complexity, number> = {
  simple: 0.2,
  medium: 0.5,
  complex: 1.0,
};

export function calculateQuote({
  material,
  volumeCm3,
  quantity,
  complexity,
}: {
  material: Material;
  volumeCm3: number;
  quantity: number;
  complexity: Complexity;
}) {
  const setupFee = 50;
  const hourlyRate = 60;
  const margin = 0.3;
  const vat = 0.2;

  const materialCost = volumeCm3 * materialRates[material] * quantity;

  const machiningHours =
    0.5 + (volumeCm3 / 100) * 0.2 + complexityHours[complexity];

  const machiningCost = machiningHours * hourlyRate * quantity;

  const subtotal = setupFee + materialCost + machiningCost;
  const withMargin = subtotal * (1 + margin);
  const withVat = withMargin * (1 + vat);

  return {
    low: Math.round(withVat * 0.9),
    high: Math.round(withVat * 1.2),
    subtotal: Math.round(subtotal),
    vatAmount: Math.round(withMargin * vat),
    totalIncVat: Math.round(withVat),
  };
}