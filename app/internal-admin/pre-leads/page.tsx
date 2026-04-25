import { requireAdminUser } from "@/lib/admin-auth";
import { preLeadStatusLabels, type PreLeadStatus } from "@/lib/pre-lead-statuses";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { setPreLeadContacted, setPreLeadRejected, setPreLeadReviewed } from "./actions";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const statusTone: Record<PreLeadStatus, string> = {
  new: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
  reviewed: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",
  rejected: "bg-red-100 text-red-900 ring-1 ring-red-200",
  contacted: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function Badge({ status }: { status: PreLeadStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone[status]}`}>
      {preLeadStatusLabels[status]}
    </span>
  );
}

function FilterLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </a>
  );
}

type PreLeadRecord = {
  id: string;
  created_at: string;
  source: string;
  source_url: string;
  source_author: string | null;
  title: string;
  snippet: string;
  matched_keywords: string[] | null;
  detected_materials: string[] | null;
  lead_score: number;
  suggested_reply: string;
  status: string | null;
  reviewed_at: string | null;
  contacted_at: string | null;
};

function LeadCard({ lead }: { lead: PreLeadRecord }) {
  const status = (lead.status ?? "new") as PreLeadStatus;

  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge status={status} />
            <span className="text-sm text-slate-500">{formatDate(lead.created_at)}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{lead.title}</h2>
          <p className="text-sm text-slate-600">Source: {lead.source}</p>
          <a
            href={lead.source_url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm font-medium text-blue-600 underline"
          >
            {lead.source_url}
          </a>
        </div>

        <div className="space-y-2 text-right">
          <p className="text-3xl font-bold text-slate-900">{lead.lead_score}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">Lead score</p>
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{lead.snippet}</p>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matched keywords</p>
          <p className="mt-1 text-slate-700">{lead.matched_keywords?.join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected materials</p>
          <p className="mt-1 text-slate-700">{lead.detected_materials?.join(", ") || "—"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested reply</p>
        <p className="mt-2 text-sm text-slate-700">{lead.suggested_reply}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={setPreLeadReviewed}>
          <input type="hidden" name="preLeadId" value={lead.id} />
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Mark reviewed
          </button>
        </form>
        <form action={setPreLeadRejected}>
          <input type="hidden" name="preLeadId" value={lead.id} />
          <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Mark rejected
          </button>
        </form>
        <form action={setPreLeadContacted}>
          <input type="hidden" name="preLeadId" value={lead.id} />
          <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Mark contacted
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function PreLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAdminUser();

  const params = (await searchParams) ?? {};
  const filter = (params.status ?? "all").toLowerCase();

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("pre_leads").select("*").order("created_at", { ascending: false });

  if (filter !== "all") {
    if (["new", "reviewed", "rejected", "contacted"].includes(filter)) {
      query = query.eq("status", filter);
    }
  }

  const { data: leads, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const counts = {
    all: leads?.length ?? 0,
    new: (leads ?? []).filter((lead) => lead.status === "new").length,
    reviewed: (leads ?? []).filter((lead) => lead.status === "reviewed").length,
    rejected: (leads ?? []).filter((lead) => lead.status === "rejected").length,
    contacted: (leads ?? []).filter((lead) => lead.status === "contacted").length,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Internal admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Pre-leads review</h1>
          <p className="mt-2 text-slate-600">Manual review only. No outreach is sent from this page.</p>
        </header>

        <section className="flex flex-wrap gap-2">
          <FilterLink active={filter === "all"} href="/internal-admin/pre-leads?status=all">
            All ({counts.all})
          </FilterLink>
          <FilterLink active={filter === "new"} href="/internal-admin/pre-leads?status=new">
            New ({counts.new})
          </FilterLink>
          <FilterLink active={filter === "reviewed"} href="/internal-admin/pre-leads?status=reviewed">
            Reviewed ({counts.reviewed})
          </FilterLink>
          <FilterLink active={filter === "rejected"} href="/internal-admin/pre-leads?status=rejected">
            Rejected ({counts.rejected})
          </FilterLink>
          <FilterLink active={filter === "contacted"} href="/internal-admin/pre-leads?status=contacted">
            Contacted ({counts.contacted})
          </FilterLink>
        </section>

        {(leads ?? []).length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">No pre-leads in this view.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {(leads as PreLeadRecord[] | null ?? []).map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
