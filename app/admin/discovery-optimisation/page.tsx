import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { toDiscoverySafeError, type DiscoverySafeError } from "@/lib/discovery-runs";

export const dynamic = "force-dynamic";

type OptimisationReportRow = {
  id: string;
  created_at: string | null;
  run_id: string | null;
  status: string | null;
  summary: string | null;
  winning_patterns: unknown;
  weak_queries: unknown;
  duplicate_heavy_queries: unknown;
  recommended_queries: unknown;
  recommended_disabled_queries: unknown;
  reasoning: unknown;
  applied_at: string | null;
};

function DiscoveryOptimisationErrorPanel({ error }: { error: DiscoverySafeError }) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Discovery optimisation is not available yet.</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <p><span className="font-semibold">Message:</span> {error.message}</p>
        <p><span className="font-semibold">Code:</span> {error.code || "—"}</p>
        <p><span className="font-semibold">Hint:</span> {error.hint || "—"}</p>
        <p><span className="font-semibold">Details:</span> {error.details || "—"}</p>
      </div>
    </section>
  );
}

function countItems(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export default async function DiscoveryOptimisationPage() {
  await requireAdminUser();
  const supabase = createSupabaseAdminClient();
  let reports: OptimisationReportRow[] = [];
  let errorState: DiscoverySafeError | null = null;

  try {
    const { data, error } = await supabase
      .from("discovery_optimisation_reports")
      .select("id, created_at, run_id, status, summary, winning_patterns, weak_queries, duplicate_heavy_queries, recommended_queries, recommended_disabled_queries, reasoning, applied_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;
    reports = (data ?? []) as OptimisationReportRow[];
  } catch (error) {
    const safeError = toDiscoverySafeError(error);
    console.error("[discovery-optimisation] Supabase error", safeError);
    errorState = safeError;
  }

  return (
    <main className="space-y-6">
      {errorState ? <DiscoveryOptimisationErrorPanel error={errorState} /> : null}
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Discovery</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Discovery optimisation</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Recommendation-only feedback loop for improving discovery queries over time.</p>
      </header>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Winning</th>
                <th className="px-4 py-3">Weak</th>
                <th className="px-4 py-3">Duplicate-heavy</th>
                <th className="px-4 py-3">Recommended</th>
                <th className="px-4 py-3">Disabled</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{report.created_at ? new Date(report.created_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{report.status || "—"}</span></td>
                  <td className="px-4 py-3 text-slate-700 max-w-[28rem] whitespace-pre-wrap">{report.summary || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{countItems(report.winning_patterns)}</td>
                  <td className="px-4 py-3 text-slate-700">{countItems(report.weak_queries)}</td>
                  <td className="px-4 py-3 text-slate-700">{countItems(report.duplicate_heavy_queries)}</td>
                  <td className="px-4 py-3 text-slate-700">{countItems(report.recommended_queries)}</td>
                  <td className="px-4 py-3 text-slate-700">{countItems(report.recommended_disabled_queries)}</td>
                  <td className="px-4 py-3 text-slate-700">{report.applied_at ? new Date(report.applied_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/discovery-optimisation/${report.id}`} className="text-cyan-700 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
              {!reports.length ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={10}>No optimisation reports recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
