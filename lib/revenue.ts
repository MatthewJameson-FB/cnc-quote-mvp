import type { QuoteStatus } from "@/lib/quote-statuses";

export type RevenueQuote = {
  status: QuoteStatus | string | null;
  job_value: number | string | null;
};

export type RevenueBreakdown = {
  lead_fee: number;
  success_fee: number;
  total_revenue: number;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateRevenue(quote: RevenueQuote): RevenueBreakdown {
  const jobValue = toNumber(quote.job_value) ?? 0;
  const status = quote.status;

  const leadFee = status === "accepted" || status === "won" ? 30 : 0;
  const successFee = status === "won" && jobValue > 500 ? jobValue * 0.05 : 0;

  return {
    lead_fee: leadFee,
    success_fee: successFee,
    total_revenue: leadFee + successFee,
  };
}
