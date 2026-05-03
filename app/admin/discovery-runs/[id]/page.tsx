import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type DiscoveryRunRow = {
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

type DiscoveryQueryStatRow = {
  id: string;
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

type PreleadRow = {
  id: string;
  created_at: string | null;
  title: string | null;
  source_url: string | null;
  source: string | null;
};

function metric(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

function summaryArray<T = string>(summary: Record<string, unknown> | null | undefined, key: string) {
  const value = summary?.[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function summaryText(summary: Record<string, unknown> | null | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === "string" ? value : null;
}

export default async function DiscoveryRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  let run: DiscoveryRunRow | null = null;
  let queryStats: DiscoveryQueryStatRow[] = [];
  let missingTable = false;

  try {
    const [{ data: runData, error: runError }, { data: statsData, error: statsError }] = await Promise.all([
      supabase
        .from("discovery_runs")
        .select("id, started_at, finished_at, trigger_type, status, searches_used, fetched, deduped, hard_rejected_before_ai, sent_to_ai, ai_accepted, ai_rejected, final_rejected_after_ai, inserted, duplicates_skipped, quota_exhausted, error_message, summary")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("discovery_query_run_stats")
        .select("id, query, group_name, fetched, sent_to_ai, accepted, inserted, duplicates, low_quality_count, reject_reasons, created_at")
        .eq("run_id", id)
        .order("fetched", { ascending: false }),
    ]);

    if (runError) throw runError;
    if (statsError) throw statsError;

    run = (runData ?? null) as DiscoveryRunRow | null;
    queryStats = (statsData ?? []) as DiscoveryQueryStatRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!/Could not find the table|schema cache/i.test(message)) {
      throw new Error(message);
    }
    missingTable = true;
  }

  if (!run) {
    if (missingTable) {
      return (
        <main className="space-y-6">
          <header className="rounded-3xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Discovery run</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">History table not ready yet</h1>
            <p className="mt-2 text-slate-600">The app code is deployed, but the discovery history tables still need to be applied in Supabase.</p>
          </header>
        </main>
      );
    }

    notFound();
  }

  const summary = (run.summary ?? {}) as Record<string, unknown>;
  const topRejectionReasons = summaryArray<{ reason: string; count: number }>(summary, "top_rejection_reasons");
  const zeroAcceptedQueries = summaryArray<{ query: string; group_name: string; fetched: number; duplicates: number }>(summary, "zero_accepted_queries");
  const duplicateHeavyQueries = summaryArray<{ query: string; group_name: string; duplicates: number; fetched: number; accepted: number }>(summary, "duplicate_heavy_queries");
  const topAcceptedTitles = summaryArray<string>(summary, "top_accepted_titles");
  const errorMessage = run.error_message || summaryText(summary, "error_message");

  const acceptedItems = await supabase
    .from("pre_leads")
    .select("id, created_at, title, source_url, source")
    .gte("created_at", run.started_at ?? new Date(0).toISOString())
    .lte("created_at", run.finished_at ?? new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  const acceptedRows = (acceptedItems.data ?? []) as PreleadRow[];

  return (
    <main className="space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Discovery run</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Run details</h1>
            <p className="mt-2 text-slate-600">Persistent summary for the prelead pipeline.</p>
          </div>
          <Link href="/admin/discovery-runs" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Back to runs</Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["Status", run.status],
          ["Trigger", run.trigger_type],
          ["Started", run.started_at ? new Date(run.started_at).toLocaleString() : "—"],
          ["Finished", run.finished_at ? new Date(run.finished_at).toLocaleString() : "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(value ?? "—")}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["Searches used", metric(run.searches_used)],
          ["Fetched", metric(run.fetched)],
          ["Sent to AI", metric(run.sent_to_ai)],
          ["Accepted", metric(run.ai_accepted)],
          ["Inserted", metric(run.inserted)],
          ["Duplicates", metric(run.duplicates_skipped)],
          ["Quota exhausted", run.quota_exhausted ? "yes" : "no"],
          ["Error", errorMessage || "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(value ?? "—")}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Run summary</h2>
        <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{JSON.stringify(summary, null, 2)}</pre>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Per-query stats</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Query</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Fetched</th>
                <th className="px-4 py-3">AI sent</th>
                <th className="px-4 py-3">Accepted</th>
                <th className="px-4 py-3">Inserted</th>
                <th className="px-4 py-3">Duplicates</th>
                <th className="px-4 py-3">Low quality</th>
                <th className="px-4 py-3">Reject reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(queryStats ?? []).map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3 text-slate-700 max-w-[24rem] break-words">{row.query || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.group_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(row.fetched)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(row.sent_to_ai)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(row.accepted)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(row.inserted)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(row.duplicates)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(row.low_quality_count)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.reject_reasons && Object.keys(row.reject_reasons).length ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(row.reject_reasons as Record<string, number>)
                          .sort((a, b) => b[1] - a[1])
                          .map(([reason, count]) => (
                            <span key={reason} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {reason}: {count}
                            </span>
                          ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!queryStats?.length ? (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={9}>No per-query stats recorded.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Top rejection reasons</h2>
          {topRejectionReasons.length ? (
            <div className="space-y-2">
              {topRejectionReasons.map((item) => (
                <div key={item.reason} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{item.reason}</span>
                  <span className="font-semibold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No rejection reasons recorded.</p>
          )}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Queries with 0 accepted</h2>
          {zeroAcceptedQueries.length ? (
            <div className="space-y-2">
              {zeroAcceptedQueries.map((item) => (
                <div key={`${item.group_name}-${item.query}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium">{item.query}</div>
                  <div className="text-xs text-slate-500">{item.group_name} · fetched {item.fetched} · duplicates {item.duplicates}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No zero-accepted queries.</p>
          )}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Duplicate-heavy queries</h2>
          {duplicateHeavyQueries.length ? (
            <div className="space-y-2">
              {duplicateHeavyQueries.map((item) => (
                <div key={`${item.group_name}-${item.query}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium">{item.query}</div>
                  <div className="text-xs text-slate-500">{item.group_name} · duplicates {item.duplicates} · accepted {item.accepted}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No duplicate-heavy queries.</p>
          )}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Accepted / inserted items</h2>
          {topAcceptedTitles.length ? (
            <div className="space-y-2">
              {topAcceptedTitles.map((title) => (
                <div key={title} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{title}</div>
              ))}
            </div>
          ) : acceptedRows.length ? (
            <div className="space-y-2">
              {acceptedRows.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium">{item.title || "Untitled"}</div>
                  <div className="text-xs text-slate-500">{item.source || "source"} · {item.source_url || "no url"}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No accepted items available yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
