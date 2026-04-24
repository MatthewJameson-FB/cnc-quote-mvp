export const quoteStatusOptions = [
  { value: "new", label: "New" },
  { value: "introduced", label: "Introduced" },
  { value: "accepted", label: "Accepted" },
  { value: "pending_review", label: "Pending review" },
  { value: "in_review", label: "In review" },
  { value: "quoted", label: "Quote sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export type QuoteStatus = (typeof quoteStatusOptions)[number]["value"];

export const defaultQuoteStatus: QuoteStatus = "new";

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  new: "New",
  introduced: "Introduced",
  accepted: "Accepted",
  pending_review: "Pending review",
  in_review: "In review",
  quoted: "Quote sent",
  won: "Won",
  lost: "Lost",
};
