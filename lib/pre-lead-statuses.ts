export const preLeadStatuses = [
  "new",
  "reviewed",
  "rejected",
  "contacted",
] as const;

export type PreLeadStatus = (typeof preLeadStatuses)[number];

export const preLeadStatusLabels: Record<PreLeadStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  rejected: "Rejected",
  contacted: "Contacted",
};
