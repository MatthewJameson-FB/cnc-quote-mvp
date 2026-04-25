export const quoteStatusOptions = [
  { value: "new", label: "New" },
  { value: "introduced", label: "Introduced" },
  { value: "accepted", label: "Accepted" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

export type QuoteStatus = (typeof quoteStatusOptions)[number]["value"];

export const defaultQuoteStatus: QuoteStatus = "new";

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  new: "New",
  introduced: "Introduced",
  accepted: "Accepted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};
