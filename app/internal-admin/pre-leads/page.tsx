import { requireAdminUser } from "@/lib/admin-auth";
import { formatThreadContextSummary, type ThreadContextSummary } from "@/lib/prelead-thread-context";
import { preLeadStatusLabels, type PreLeadStatus } from "@/lib/pre-lead-statuses";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import ConfirmActionButton from "../ConfirmActionButton";
import CopyReplyButton from "../CopyReplyButton";
import { createManualPrelead, deleteTestPreLead, setPreLeadContacted, setPreLeadRejected, setPreLeadReviewed } from "./actions";
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
  location_signal: string | null;
  lead_score: number;
  value_tier: "low" | "medium" | "high" | null;
  value_score: number | null;
  value_reason: string | null;
  should_reply: boolean | null;
  thread_context_summary: ThreadContextSummary | null;
  suggested_reply: string;
  manual_notes: string | null;
  status: string | null;
  reviewed_at: string | null;
  contacted_at: string | null;
};

function valueTierRank(tier: PreLeadRecord["value_tier"]) {
  if (tier === "high") return 2;
  if (tier === "medium") return 1;
  return 0;
}

function comparePreLeads(a: PreLeadRecord, b: PreLeadRecord) {
  const valueDifference = valueTierRank(b.value_tier) - valueTierRank(a.value_tier);
  if (valueDifference !== 0) return valueDifference;
  const replyDifference = Number(Boolean(b.should_reply)) - Number(Boolean(a.should_reply));
  if (replyDifference !== 0) return replyDifference;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function extractNoteValue(notes: string | null, key: string) {
  if (!notes) return null;

  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, "gm")));
  const lastMatch = matches.at(-1);
  return lastMatch?.[1]?.trim() || null;
}

function isTestLikePreLead(lead: PreLeadRecord) {
  if (process.env.NODE_ENV !== "production") return true;
  const haystack = `${lead.title}\n${lead.snippet}\n${lead.source_url}\n${lead.source_author ?? ""}`.toLowerCase();
  return haystack.includes("test");
}

function LeadCard({
  lead,
  converted,
  estimateAccepted,
}: {
  lead: PreLeadRecord;
  converted: boolean;
  estimateAccepted: boolean;
}) {
  const status = (lead.status ?? "new") as PreLeadStatus;
  const canDelete = isTestLikePreLead(lead);

  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge status={status} />
            {converted ? (
              <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 ring-1 ring-violet-200">
                Converted
              </span>
            ) : null}
            {estimateAccepted ? (
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                Estimate accepted
              </span>
            ) : null}
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location signal</p>
          <p className="mt-1 text-slate-700">{lead.location_signal || "unknown"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Value tier</p>
          <p className="mt-1 text-slate-700">{lead.value_tier || "low"} ({lead.value_score ?? 0})</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Value reason</p>
          <p className="mt-1 text-slate-700">{lead.value_reason || "—"}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thread context summary</p>
          <p className="mt-1 text-slate-700">{formatThreadContextSummary(lead.thread_context_summary)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Should reply</p>
          <p className="mt-1 text-slate-700">{lead.should_reply ? "yes" : "no"}</p>
        </div>
        {lead.manual_notes ? (
          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual notes</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{lead.manual_notes}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested reply</p>
          {lead.should_reply && lead.suggested_reply ? <CopyReplyButton reply={lead.suggested_reply} /> : null}
        </div>
        <p className="mt-2 text-sm text-slate-700">{lead.should_reply ? lead.suggested_reply : "No reply suggested"}</p>
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
        {canDelete ? (
          <ConfirmActionButton
            action={deleteTestPreLead}
            fields={[{ name: "preLeadId", value: lead.id }]}
            label="Delete test prelead"
            confirmMessage="Delete this test prelead? This cannot be undone."
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          />
        ) : null}
      </div>
    </article>
  );
}

export default async function PreLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; source?: string; discovery_group_id?: string }>;
}) {
  await requireAdminUser();

  const params = (await searchParams) ?? {};
  const filter = (params.status ?? "all").toLowerCase();
  const defaultSource = ["facebook", "instagram", "other"].includes((params.source ?? "").toLowerCase())
    ? (params.source ?? "facebook").toLowerCase()
    : "facebook";
  const discoveryGroupId = String(params.discovery_group_id ?? "").trim();

  const supabase = createSupabaseAdminClient();
  const { data: allLeads, error } = await supabase.from("pre_leads").select("*");

  if (error) {
    throw new Error(error.message);
  }

  const counts = {
    all: allLeads?.length ?? 0,
    new: (allLeads ?? []).filter((lead) => lead.status === "new").length,
    reviewed: (allLeads ?? []).filter((lead) => lead.status === "reviewed").length,
    rejected: (allLeads ?? []).filter((lead) => lead.status === "rejected").length,
    contacted: (allLeads ?? []).filter((lead) => lead.status === "contacted").length,
  };
  const leads = (allLeads as PreLeadRecord[] | null ?? [])
    .filter((lead) => filter === "all" || lead.status === filter)
    .sort(comparePreLeads);

  const { data: quotes } = await supabase.from("quotes").select("notes");
  const convertedPreleadIds = new Set<string>();
  const acceptedPreleadIds = new Set<string>();

  for (const quote of quotes ?? []) {
    const notes = (quote.notes as string | null) ?? null;
    const preleadId = extractNoteValue(notes, "prelead_id");

    if (!preleadId) {
      continue;
    }

    convertedPreleadIds.add(preleadId);

    if (extractNoteValue(notes, "estimate_accepted") === "true") {
      acceptedPreleadIds.add(preleadId);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Internal admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Pre-leads review</h1>
          <p className="mt-2 text-slate-600">Manual review only. No outreach is sent from this page.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/admin/discovery-groups" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Open Discovery Groups
            </a>
          </div>
        </header>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Add manual lead</p>
              <p className="mt-2 text-slate-600">Paste a Facebook, Instagram, or other post you found manually. No scraping, no auto-posting.</p>
            </div>
          </div>

          <form action={createManualPrelead} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Source
              <select name="source" defaultValue={defaultSource} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900">
                <option value="facebook">facebook/manual</option>
                <option value="instagram">instagram/manual</option>
                <option value="other">other/manual</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Post URL
              <input name="post_url" type="url" placeholder="https://..." className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Post text
              <textarea name="post_text" rows={5} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" placeholder="Paste the post text here" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Notes
              <textarea name="notes" rows={3} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" placeholder="Optional context for you or the team" />
            </label>
            {discoveryGroupId ? (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 md:col-span-2">
                Discovery group linked: <span className="font-mono">{discoveryGroupId}</span>
              </div>
            ) : null}
            <input type="hidden" name="discovery_group_id" value={discoveryGroupId} />
            <div className="md:col-span-2">
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                Analyze lead
              </button>
            </div>
          </form>
        </section>

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

        {leads.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">No pre-leads in this view.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                converted={convertedPreleadIds.has(lead.id)}
                estimateAccepted={acceptedPreleadIds.has(lead.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
