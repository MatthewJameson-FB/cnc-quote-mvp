import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { toDiscoverySafeError, type DiscoverySafeError } from "@/lib/discovery-runs";
import { buildRecommendedDiscoveryQueries } from "@/lib/discovery-query-templates";

export type DiscoveryRunRow = {
  id: string;
  started_at: string | null;
  finished_at: string | null;
  trigger_type: string | null;
  status: string | null;
  searches_used: number | null;
  fetched: number | null;
  deduped: number | null;
  hard_rejected_before_ai: number | null;
  sent_to_ai: number | null;
  ai_accepted: number | null;
  ai_rejected: number | null;
  final_rejected_after_ai: number | null;
  inserted: number | null;
  duplicates_skipped: number | null;
  quota_exhausted: boolean | null;
  error_message: string | null;
  summary: Record<string, unknown> | null;
};

export type DiscoveryQueryRunStatRow = {
  id: string;
  run_id: string | null;
  query: string | null;
  group_name: string | null;
  fetched: number | null;
  sent_to_ai: number | null;
  accepted: number | null;
  inserted: number | null;
  duplicates: number | null;
  low_quality_count: number | null;
  reject_reasons: Record<string, number> | null;
  created_at: string | null;
};

export type AggregatedQueryPerformance = {
  query: string;
  group_name: string;
  total_runs: number;
  total_fetched: number;
  total_sent_to_ai: number;
  total_accepted: number;
  total_inserted: number;
  total_duplicates: number;
  total_low_quality: number;
  acceptance_rate: number;
  insert_rate: number;
  duplicate_rate: number;
  low_quality_rate: number;
};

export type DiscoveryExportPayload = {
  runs: DiscoveryRunRow[];
  query_stats: DiscoveryQueryRunStatRow[];
  aggregated_query_performance: AggregatedQueryPerformance[];
};

export type DiscoveryOptimisationReport = {
  run_id: string | null;
  status: string;
  summary: string;
  winning_patterns: unknown;
  weak_queries: unknown;
  duplicate_heavy_queries: unknown;
  recommended_queries: unknown;
  recommended_disabled_queries: unknown;
  reasoning: unknown;
  applied_at: string | null;
};

export type DiscoveryOptimisationResult = {
  success: boolean;
  report_id: string | null;
  report: DiscoveryOptimisationReport | null;
  error: DiscoverySafeError | null;
};

function isMissingTableError(error: unknown) {
  const safe = toDiscoverySafeError(error);
  return /Could not find the table|schema cache|does not exist/i.test([safe.message, safe.details, safe.hint].filter(Boolean).join(" "));
}

function metric(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(3));
}

function aggregateQueryPerformance(queryStats: DiscoveryQueryRunStatRow[]) {
  const statsByQuery = new Map<string, AggregatedQueryPerformance>();
  const runIdsByKey = new Map<string, Set<string>>();

  for (const stat of queryStats) {
    const query = String(stat.query ?? "").trim();
    if (!query) continue;
    const groupName = String(stat.group_name ?? "unknown").trim() || "unknown";
    const key = `${groupName}||${query}`;
    const existing = statsByQuery.get(key) ?? {
      query,
      group_name: groupName,
      total_runs: 0,
      total_fetched: 0,
      total_sent_to_ai: 0,
      total_accepted: 0,
      total_inserted: 0,
      total_duplicates: 0,
      total_low_quality: 0,
      acceptance_rate: 0,
      insert_rate: 0,
      duplicate_rate: 0,
      low_quality_rate: 0,
    };

    existing.total_fetched += metric(stat.fetched);
    existing.total_sent_to_ai += metric(stat.sent_to_ai);
    existing.total_accepted += metric(stat.accepted);
    existing.total_inserted += metric(stat.inserted);
    existing.total_duplicates += metric(stat.duplicates);
    existing.total_low_quality += metric(stat.low_quality_count);
    statsByQuery.set(key, existing);

    if (stat.run_id) {
      const runIds = runIdsByKey.get(key) ?? new Set<string>();
      runIds.add(stat.run_id);
      runIdsByKey.set(key, runIds);
    }
  }

  for (const [key, value] of statsByQuery.entries()) {
    value.total_runs = runIdsByKey.get(key)?.size ?? 0;
    value.acceptance_rate = rate(value.total_accepted, value.total_sent_to_ai);
    value.insert_rate = rate(value.total_inserted, value.total_sent_to_ai);
    value.duplicate_rate = rate(value.total_duplicates, value.total_fetched);
    value.low_quality_rate = rate(value.total_low_quality, value.total_fetched);
  }

  return [...statsByQuery.values()].sort((a, b) => b.total_accepted - a.total_accepted || b.total_inserted - a.total_inserted || a.query.localeCompare(b.query));
}

export async function loadDiscoveryExportData(): Promise<{ data: DiscoveryExportPayload; error: DiscoverySafeError | null }> {
  const supabase = createSupabaseAdminClient();
  const runsResult = await supabase
    .from("discovery_runs")
    .select("id, started_at, finished_at, trigger_type, status, searches_used, fetched, deduped, hard_rejected_before_ai, sent_to_ai, ai_accepted, ai_rejected, final_rejected_after_ai, inserted, duplicates_skipped, quota_exhausted, error_message, summary")
    .order("started_at", { ascending: false })
    .limit(10);

  if (runsResult.error) {
    if (isMissingTableError(runsResult.error)) {
      return {
        data: { runs: [], query_stats: [], aggregated_query_performance: [] },
        error: toDiscoverySafeError(runsResult.error),
      };
    }
    throw runsResult.error;
  }

  const runs = (runsResult.data ?? []) as DiscoveryRunRow[];
  const runIds = runs.map((run) => run.id).filter(Boolean);

  if (!runIds.length) {
    return {
      data: { runs, query_stats: [], aggregated_query_performance: [] },
      error: null,
    };
  }

  const statsResult = await supabase
    .from("discovery_query_run_stats")
    .select("id, run_id, query, group_name, fetched, sent_to_ai, accepted, inserted, duplicates, low_quality_count, reject_reasons, created_at")
    .in("run_id", runIds)
    .order("created_at", { ascending: false });

  if (statsResult.error) {
    if (isMissingTableError(statsResult.error)) {
      return {
        data: { runs, query_stats: [], aggregated_query_performance: [] },
        error: toDiscoverySafeError(statsResult.error),
      };
    }
    throw statsResult.error;
  }

  const queryStats = (statsResult.data ?? []) as DiscoveryQueryRunStatRow[];

  return {
    data: {
      runs,
      query_stats: queryStats,
      aggregated_query_performance: aggregateQueryPerformance(queryStats),
    },
    error: null,
  };
}

function buildRecommendedQueries(winningPatterns: AggregatedQueryPerformance[]) {
  return buildRecommendedDiscoveryQueries(
    winningPatterns.map((item) => ({ query: item.query, group_name: item.group_name }))
  );
}

function buildWinningPatterns(aggregated: AggregatedQueryPerformance[]) {
  return aggregated
    .filter((item) => item.total_accepted > 0 || item.total_inserted > 0)
    .slice(0, 10)
    .map((item) => ({
      query: item.query,
      group_name: item.group_name,
      total_runs: item.total_runs,
      total_accepted: item.total_accepted,
      total_inserted: item.total_inserted,
      acceptance_rate: item.acceptance_rate,
      insert_rate: item.insert_rate,
      note: item.total_inserted > 0 ? "inserted" : "accepted",
    }));
}

function buildWeakQueries(aggregated: AggregatedQueryPerformance[]) {
  return aggregated
    .filter((item) => (item.total_runs >= 3 && item.total_accepted === 0) || item.low_quality_rate >= 0.6)
    .slice(0, 10)
    .map((item) => ({
      query: item.query,
      group_name: item.group_name,
      total_runs: item.total_runs,
      total_accepted: item.total_accepted,
      total_inserted: item.total_inserted,
      total_low_quality: item.total_low_quality,
      low_quality_rate: item.low_quality_rate,
      reason: item.total_runs >= 3 && item.total_accepted === 0 ? "0 accepted after 3+ runs" : "high low-quality rate",
    }));
}

function buildDuplicateHeavyQueries(aggregated: AggregatedQueryPerformance[]) {
  return aggregated
    .filter((item) => item.duplicate_rate >= 0.5 || (item.total_duplicates >= 3 && item.total_inserted === 0))
    .slice(0, 10)
    .map((item) => ({
      query: item.query,
      group_name: item.group_name,
      total_duplicates: item.total_duplicates,
      duplicate_rate: item.duplicate_rate,
      total_inserted: item.total_inserted,
      total_fetched: item.total_fetched,
      reason: item.total_inserted === 0 ? "duplicate-heavy and no inserts" : "high duplicate rate",
    }));
}

function buildSummaryText(aggregated: AggregatedQueryPerformance[], result: DiscoveryExportPayload) {
  const top = aggregated[0];
  if (!top) {
    return "No discovery data available yet.";
  }

  return [
    `Reviewed ${result.runs.length} runs and ${result.query_stats.length} query stat rows.`,
    `Top query: ${top.query} (${top.total_accepted} accepted, ${top.total_inserted} inserted).`,
    `Recommended queries are recommendation-only and will not change live search logic automatically.`,
  ].join(" ");
}

function buildReasoning(result: DiscoveryExportPayload, aggregated: AggregatedQueryPerformance[]) {
  return {
    source_runs: result.runs.map((run) => ({
      id: run.id,
      status: run.status,
      trigger_type: run.trigger_type,
      started_at: run.started_at,
      fetched: run.fetched,
      sent_to_ai: run.sent_to_ai,
      ai_accepted: run.ai_accepted,
      inserted: run.inserted,
      duplicates_skipped: run.duplicates_skipped,
    })),
    thresholds: {
      weak_query_min_runs: 3,
      weak_query_low_quality_rate: 0.6,
      duplicate_heavy_min_rate: 0.5,
    },
    top_queries: aggregated.slice(0, 10).map((item) => ({
      query: item.query,
      group_name: item.group_name,
      total_accepted: item.total_accepted,
      total_inserted: item.total_inserted,
      acceptance_rate: item.acceptance_rate,
      insert_rate: item.insert_rate,
      duplicate_rate: item.duplicate_rate,
      low_quality_rate: item.low_quality_rate,
    })),
  };
}

export async function generateDiscoveryOptimisationReport(runId?: string): Promise<DiscoveryOptimisationResult> {
  try {
    const { data, error } = await loadDiscoveryExportData();
    if (error && !data.runs.length && !data.query_stats.length) {
      return {
        success: false,
        report_id: null,
        report: null,
        error,
      };
    }

    const winning_patterns = buildWinningPatterns(data.aggregated_query_performance);
    const weak_queries = buildWeakQueries(data.aggregated_query_performance);
    const duplicate_heavy_queries = buildDuplicateHeavyQueries(data.aggregated_query_performance);
    const recommended_queries = buildRecommendedQueries(winning_patterns.length ? data.aggregated_query_performance.filter((item) => item.total_accepted > 0 || item.total_inserted > 0) : data.aggregated_query_performance);
    const recommended_disabled_queries = [
      ...weak_queries.map((item) => ({
        query: item.query,
        group_name: item.group_name,
        reason: item.reason,
      })),
      ...duplicate_heavy_queries.map((item) => ({
        query: item.query,
        group_name: item.group_name,
        reason: item.reason,
      })),
    ];

    const report: DiscoveryOptimisationReport = {
      run_id: runId ?? null,
      status: "draft",
      summary: buildSummaryText(data.aggregated_query_performance, data),
      winning_patterns,
      weak_queries,
      duplicate_heavy_queries,
      recommended_queries,
      recommended_disabled_queries,
      reasoning: buildReasoning(data, data.aggregated_query_performance),
      applied_at: null,
    };

    const supabase = createSupabaseAdminClient();
    const { data: inserted, error: insertError } = await supabase
      .from("discovery_optimisation_reports")
      .insert({
        run_id: runId ?? null,
        status: "draft",
        summary: report.summary,
        winning_patterns: report.winning_patterns,
        weak_queries: report.weak_queries,
        duplicate_heavy_queries: report.duplicate_heavy_queries,
        recommended_queries: report.recommended_queries,
        recommended_disabled_queries: report.recommended_disabled_queries,
        reasoning: report.reasoning,
        applied_at: null,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (isMissingTableError(insertError)) {
        return { success: false, report_id: null, report, error: toDiscoverySafeError(insertError) };
      }
      throw insertError;
    }

    return {
      success: true,
      report_id: typeof inserted?.id === "string" ? inserted.id : null,
      report,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      report_id: null,
      report: null,
      error: toDiscoverySafeError(error),
    };
  }
}
