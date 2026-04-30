export const preLeadStatuses = [
  "active",
  "contacted",
  "converted",
  "dismissed",
] as const;

export type PreLeadStatus = (typeof preLeadStatuses)[number];

export const preLeadStatusLabels: Record<PreLeadStatus, string> = {
  active: "Active",
  contacted: "Contacted",
  converted: "Converted",
  dismissed: "Dismissed",
};

export function normalizePreLeadStatus(status: string | null | undefined): PreLeadStatus {
  const value = (status ?? "").trim().toLowerCase();

  if (value === "dismissed") return "dismissed";
  if (value === "contacted") return "contacted";
  if (value === "converted") return "converted";
  return "active";
}

export function isDismissedPreLeadStatus(status: string | null | undefined) {
  return normalizePreLeadStatus(status) === "dismissed";
}
