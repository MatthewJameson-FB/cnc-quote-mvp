import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DiscoveryTriggerType = "cron" | "manual" | "local";
export type DiscoveryRunStatus = "running" | "success" | "error";

export type DiscoveryQueryRunStat = {
  query: string;
  group_name: string;
  fetched: number;
  sent_to_ai: number;
  accepted: number;
  inserted: number;
  duplicates: number;
  low_quality_count: number;
  reject_reasons: Record<string, number>;
};

export type DiscoveryRunSnapshot = {
  searches_used: number;
  fetched: number;
  sent_to_ai: number;
  accepted: number;
  inserted: number;
  duplicates: number;
  skipped_budget: number;
  quota_exhausted: boolean;
  timestamp: string;
  top_accepted_titles: string[];
  query_stats: DiscoveryQueryRunStat[];
};

function isMissingColumnError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /column .* does not exist|could not find the .* column|schema cache/i.test(message);
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return message.replace(/[\r\n]+/g, " ").slice(0, 240) || "Unknown error";
}

function aggregateRejectReasons(queryStats: DiscoveryQueryRunStat[]) {
  const counts = new Map<string, number>();

  for (const stat of queryStats) {
    for (const [reason, count] of Object.entries(stat.reject_reasons || {})) {
      counts.set(reason, (counts.get(reason) ?? 0) + Number(count || 0));
    }
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function buildSummary(triggerType: DiscoveryTriggerType, status: DiscoveryRunStatus, result: DiscoveryRunSnapshot, errorMessage: string | null) {
  const zeroAcceptedQueries = result.query_stats
    .filter((stat) => stat.accepted === 0 && stat.fetched > 0)
    .map((stat) => ({ query: stat.query, group_name: stat.group_name, fetched: stat.fetched, duplicates: stat.duplicates }))
    .sort((a, b) => b.fetched - a.fetched || b.duplicates - a.duplicates);

  const duplicateHeavyQueries = result.query_stats
    .filter((stat) => stat.duplicates > 0)
    .map((stat) => ({ query: stat.query, group_name: stat.group_name, duplicates: stat.duplicates, fetched: stat.fetched, accepted: stat.accepted }))
    .sort((a, b) => b.duplicates - a.duplicates || b.fetched - a.fetched);

  return {
    trigger_type: triggerType,
    status,
    searches_used: result.searches_used,
    fetched: result.fetched,
    sent_to_ai: result.sent_to_ai,
    accepted: result.accepted,
    inserted: result.inserted,
    duplicates_skipped: result.duplicates,
    skipped_budget: result.skipped_budget,
    quota_exhausted: result.quota_exhausted,
    top_accepted_titles: result.top_accepted_titles,
    top_rejection_reasons: aggregateRejectReasons(result.query_stats).slice(0, 10),
    zero_accepted_queries: zeroAcceptedQueries.slice(0, 25),
    duplicate_heavy_queries: duplicateHeavyQueries.slice(0, 25),
    query_count: result.query_stats.length,
    timestamp: result.timestamp,
    error_message: errorMessage,
  };
}

export async function startDiscoveryRun(triggerType: DiscoveryTriggerType) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("discovery_runs")
      .insert({ trigger_type: triggerType, status: "running" })
      .select("id")
      .single();

    if (error) {
      if (isMissingColumnError(error)) return null;
      throw error;
    }

    return typeof data?.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

async function insertDiscoveryQueryStats(runId: string, queryStats: DiscoveryQueryRunStat[]) {
  if (!queryStats.length) return;

  const supabase = createSupabaseAdminClient();
  const rows = queryStats.map((stat) => ({
    run_id: runId,
    query: stat.query,
    group_name: stat.group_name,
    fetched: stat.fetched,
    sent_to_ai: stat.sent_to_ai,
    accepted: stat.accepted,
    inserted: stat.inserted,
    duplicates: stat.duplicates,
    low_quality_count: stat.low_quality_count,
    reject_reasons: stat.reject_reasons,
  }));

  const { error } = await supabase.from("discovery_query_run_stats").insert(rows);
  if (error && !isMissingColumnError(error)) {
    throw error;
  }
}

export async function finalizeDiscoveryRun(params: {
  runId: string | null;
  triggerType: DiscoveryTriggerType;
  status: DiscoveryRunStatus;
  result: DiscoveryRunSnapshot;
  errorMessage?: string | null;
}) {
  const { runId, triggerType, status, result, errorMessage = null } = params;
  if (!runId) return;

  const supabase = createSupabaseAdminClient();
  const summary = buildSummary(triggerType, status, result, errorMessage);

  try {
    await insertDiscoveryQueryStats(runId, result.query_stats);
  } catch {
    // best effort
  }

  const updatePayload: Record<string, unknown> = {
    finished_at: new Date().toISOString(),
    status,
    searches_used: result.searches_used,
    fetched: result.fetched,
    deduped: result.fetched - result.duplicates,
    hard_rejected_before_ai: result.fetched - result.sent_to_ai,
    sent_to_ai: result.sent_to_ai,
    ai_accepted: result.accepted,
    ai_rejected: Math.max(0, result.sent_to_ai - result.accepted),
    final_rejected_after_ai: Math.max(0, result.accepted - result.inserted),
    inserted: result.inserted,
    duplicates_skipped: result.duplicates,
    quota_exhausted: result.quota_exhausted,
    error_message: errorMessage,
    summary,
  };

  const { error } = await supabase.from("discovery_runs").update(updatePayload).eq("id", runId);
  if (error && !isMissingColumnError(error)) {
    throw error;
  }
}

export function safeDiscoveryErrorMessage(error: unknown) {
  return safeErrorMessage(error);
}

export function buildDiscoverySummarySnapshot(result: DiscoveryRunSnapshot) {
  return buildSummary("cron", "success", result, null);
}
