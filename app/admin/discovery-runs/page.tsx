import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { toDiscoverySafeError, type DiscoverySafeError } from "@/lib/discovery-runs";

export const dynamic = "force-dynamic";

type DiscoveryRunRow = {
  id: string;
  started_at: string | null;
  finished_at: string | null;
  trigger_type: string | null;
  status: string | null;
  searches_used: number | null;
  fetched: number | null;
  sent_to_ai: number | null;
  accepted: number | null;
  inserted: number | null;
  duplicates_skipped: number | null;
  quota_exhausted: boolean | null;
  error_message: string | null;
};

function metric(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

function DiscoveryRunErrorPanel({ error }: { error: DiscoverySafeError }) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Discovery run history is not available yet.</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">
        <p><span className="font-semibold">Message:</span> {error.message}</p>
        <p><span className="font-semibold">Code:</span> {error.code || "—"}</p>
        <p><span className="font-semibold">Hint:</span> {error.hint || "—"}</p>
        <p><span className="font-semibold">Details:</span> {error.details || "—"}</p>
      </div>
    </section>
  );
}

export default async function DiscoveryRunsPage() {
  await requireAdminUser();
  const supabase = createSupabaseAdminClient();
  let runs: DiscoveryRunRow[] = [];

  let errorState: DiscoverySafeError | null = null;

  try {
    const { data, error } = await supabase
      .from("discovery_runs")
      .select("id, started_at, finished_at, trigger_type, status, searches_used, fetched, sent_to_ai, accepted, inserted, duplicates_skipped, quota_exhausted, error_message")
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    runs = (data ?? []) as DiscoveryRunRow[];
  } catch (error) {
    const safeError = toDiscoverySafeError(error);
    console.error("[discovery-runs] Supabase error", safeError);
    errorState = safeError;
  }

  return (
    <main className="space-y-6">
      {errorState ? <DiscoveryRunErrorPanel error={errorState} /> : null}
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Discovery</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Discovery runs</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Persistent cron history for prelead discovery, query quality, and rejection reasons.</p>
      </header>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Searches</th>
                <th className="px-4 py-3">Fetched</th>
                <th className="px-4 py-3">AI sent</th>
                <th className="px-4 py-3">Accepted</th>
                <th className="px-4 py-3">Inserted</th>
                <th className="px-4 py-3">Dupes</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => (
                <tr key={run.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{run.started_at ? new Date(run.started_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{run.status || "—"}</span></td>
                  <td className="px-4 py-3 text-slate-700">{run.trigger_type || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(run.searches_used)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(run.fetched)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(run.sent_to_ai)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(run.accepted)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(run.inserted)}</td>
                  <td className="px-4 py-3 text-slate-700">{metric(run.duplicates_skipped)}</td>
                  <td className="px-4 py-3 text-slate-700">{run.quota_exhausted ? "yes" : "no"}</td>
                  <td className="px-4 py-3 text-slate-600">{run.error_message || "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/discovery-runs/${run.id}`} className="text-cyan-700 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
              {!runs.length ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={12}>No discovery runs recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
