import Link from "next/link";
import { requireAdminUser } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { toDiscoverySafeError, type DiscoverySafeError } from "@/lib/discovery-runs";
import CopyTextButton from "../CopyTextButton";

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

function previewValue(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "—";
  }
}

function toLines(value: unknown, pick?: (item: unknown) => string) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (pick ? pick(item) : typeof item === "string" ? item : JSON.stringify(item)))
    .filter(Boolean)
    .join("\n");
}

function buildFullReportText(report: OptimisationReportRow) {
  return [
    `Discovery optimisation report ${report.id}`,
    `Created: ${report.created_at || "—"}`,
    `Status: ${report.status || "—"}`,
    `Applied: ${report.applied_at || "—"}`,
    "",
    "Summary:",
    report.summary || "—",
    "",
    "Winning patterns:",
    previewValue(report.winning_patterns),
    "",
    "Weak queries:",
    previewValue(report.weak_queries),
    "",
    "Duplicate-heavy queries:",
    previewValue(report.duplicate_heavy_queries),
    "",
    "Recommended queries:",
    previewValue(report.recommended_queries),
    "",
    "Recommended disabled queries:",
    previewValue(report.recommended_disabled_queries),
    "",
    "Reasoning:",
    previewValue(report.reasoning),
  ].join("\n");
}

export default async function DiscoveryOptimisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  let report: OptimisationReportRow | null = null;
  let errorState: DiscoverySafeError | null = null;

  try {
    const { data, error } = await supabase
      .from("discovery_optimisation_reports")
      .select("id, created_at, run_id, status, summary, winning_patterns, weak_queries, duplicate_heavy_queries, recommended_queries, recommended_disabled_queries, reasoning, applied_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    report = (data ?? null) as OptimisationReportRow | null;
  } catch (error) {
    const safeError = toDiscoverySafeError(error);
    console.error("[discovery-optimisation] Supabase error", safeError);
    errorState = safeError;
  }

  if (!report) {
    return (
      <main className="space-y-6">
        <DiscoveryOptimisationErrorPanel error={errorState ?? { message: "No optimisation report found.", code: null, details: null, hint: null }} />
      </main>
    );
  }

  const recommendedQueriesText = toLines(report.recommended_queries, (item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "query" in item) return String((item as { query?: unknown }).query ?? "");
    return "";
  });
  const weakQueriesText = toLines(report.weak_queries, (item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "query" in item) return String((item as { query?: unknown }).query ?? "");
    return "";
  });
  const fullReportText = buildFullReportText(report);

  return (
    <main className="space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Discovery optimisation</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Report details</h1>
            <p className="mt-2 text-slate-600">Recommendation-only review for query improvement.</p>
          </div>
          <Link href="/admin/discovery-optimisation" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Back to reports</Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["Created", report.created_at ? new Date(report.created_at).toLocaleString() : "—"],
          ["Status", report.status],
          ["Run ID", report.run_id || "—"],
          ["Applied", report.applied_at ? new Date(report.applied_at).toLocaleString() : "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(value ?? "—")}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <CopyTextButton label="Copy recommended queries" text={recommendedQueriesText} />
            <CopyTextButton label="Copy weak queries to disable" text={weakQueriesText} />
            <CopyTextButton label="Copy full report for AI review" text={fullReportText} />
          </div>
        </div>
        <p className="text-sm text-slate-600">Nothing here applies automatically. Use these recommendations as a review aid only.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Summary</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.summary || "—"}</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Winning patterns</h2>
          <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{previewValue(report.winning_patterns)}</pre>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Weak queries</h2>
          <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{previewValue(report.weak_queries)}</pre>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Duplicate-heavy queries</h2>
          <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{previewValue(report.duplicate_heavy_queries)}</pre>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Recommended new queries</h2>
          <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{previewValue(report.recommended_queries)}</pre>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Recommended disabled queries</h2>
          <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{previewValue(report.recommended_disabled_queries)}</pre>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-3 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Reasoning</h2>
          <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{previewValue(report.reasoning)}</pre>
        </div>
      </section>
    </main>
  );
}
