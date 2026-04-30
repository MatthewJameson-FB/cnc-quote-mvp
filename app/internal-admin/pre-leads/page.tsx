import { requireAdminUser } from '@/lib/admin-auth'
import { type ThreadContextSummary } from '@/lib/prelead-thread-context'
import { normalizePreLeadStatus, preLeadStatusLabels, type PreLeadStatus } from '@/lib/pre-lead-statuses'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import ConfirmActionButton from '../ConfirmActionButton'
import CopyReplyButton from '../CopyReplyButton'
import DismissLeadButton from './DismissLeadButton'
import { deleteTestPreLead, setPreLeadActive, setPreLeadContacted } from './actions'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const statusTone: Record<PreLeadStatus, string> = {
  active: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200',
  contacted: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200',
  converted: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200',
  dismissed: 'bg-red-100 text-red-900 ring-1 ring-red-200',
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function Badge({ status }: { status: PreLeadStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone[status]}`}>{preLeadStatusLabels[status]}</span>
}

function FilterLink({ active, href, children }: { active: boolean; href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
    >
      {children}
    </a>
  )
}

type PreLeadRecord = {
  id: string
  created_at: string
  source: string
  source_url: string
  source_author: string | null
  title: string
  snippet: string
  matched_keywords: string[] | null
  detected_materials: string[] | null
  location_signal: string | null
  lead_score: number
  value_tier: 'low' | 'medium' | 'high' | null
  value_score: number | null
  value_reason: string | null
  should_reply: boolean | null
  thread_context_summary: ThreadContextSummary | null
  suggested_reply: string
  manual_notes: string | null
  post_text: string | null
  image_url: string | null
  contact_email: string | null
  status: string | null
  reviewed_at: string | null
  contacted_at: string | null
  dismissed_reason: string | null
  dismissed_at: string | null
}

function comparePreLeads(a: PreLeadRecord, b: PreLeadRecord) {
  const valueDifference = (b.value_score ?? 0) - (a.value_score ?? 0)
  if (valueDifference !== 0) return valueDifference
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

function resolvedStatus(status: string | null | undefined): PreLeadStatus {
  return normalizePreLeadStatus(status)
}

function extractNoteValue(notes: string | null, key: string) {
  if (!notes) return null

  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, 'gm')))
  const lastMatch = matches.at(-1)
  return lastMatch?.[1]?.trim() || null
}

function isTestLikePreLead(lead: PreLeadRecord) {
  if (process.env.NODE_ENV !== 'production') return true
  const haystack = `${lead.title}\n${lead.snippet}\n${lead.source_url}\n${lead.source_author ?? ''}`.toLowerCase()
  return haystack.includes('test')
}

function LeadCard({
  lead,
  converted,
  estimateAccepted,
  dismissed,
}: {
  lead: PreLeadRecord
  converted: boolean
  estimateAccepted: boolean
  dismissed: boolean
}) {
  const status = resolvedStatus(lead.status)
  const canDelete = isTestLikePreLead(lead)
  const isActive = status === 'active'
  const isDismissed = status === 'dismissed'
  const preview = lead.post_text || lead.snippet || lead.title

  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Badge status={status} />
            {converted ? <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 ring-1 ring-violet-200">Converted</span> : null}
            {estimateAccepted ? <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">Estimate accepted</span> : null}
            <span className="text-sm text-slate-500">{formatDate(lead.created_at)}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{lead.title}</h2>
          <p className="text-sm text-slate-600">Source: {lead.source}</p>
          <a href={lead.source_url} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-blue-600 underline">
            {lead.source_url}
          </a>
        </div>

        <div className="space-y-2 text-right">
          <p className="text-3xl font-bold text-slate-900">{lead.value_score ?? 0}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">Value score</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</p>
          <p className="mt-1 text-slate-700">{lead.source}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current status</p>
          <p className="mt-1 text-slate-700">{preLeadStatusLabels[status]}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Value tier</p>
          <p className="mt-1 text-slate-700">{lead.value_tier || 'low'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created at</p>
          <p className="mt-1 text-slate-700">{formatDate(lead.created_at)}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Post preview</p>
          <p className="mt-1 text-slate-700">{preview}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location signal</p>
          <p className="mt-1 text-slate-700">{lead.location_signal || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Value reason</p>
          <p className="mt-1 text-slate-700">{lead.value_reason || '—'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested reply</p>
          {lead.should_reply && lead.suggested_reply ? <CopyReplyButton reply={lead.suggested_reply} /> : null}
        </div>
        <p className="mt-2 text-sm text-slate-700">{lead.should_reply ? lead.suggested_reply : 'No reply suggested'}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={lead.source_url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          View
        </a>

        {isDismissed ? (
          <form action={setPreLeadActive}>
            <input type="hidden" name="preLeadId" value={lead.id} />
            <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Restore
            </button>
          </form>
        ) : (
          <>
            {isActive ? (
              <form action={setPreLeadContacted}>
                <input type="hidden" name="preLeadId" value={lead.id} />
                <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  Reply / Mark contacted
                </button>
              </form>
            ) : null}
            <DismissLeadButton leadId={lead.id} dismissed={dismissed} />
          </>
        )}

        {canDelete ? (
          <ConfirmActionButton
            action={deleteTestPreLead}
            fields={[{ name: 'preLeadId', value: lead.id }]}
            label="Delete test prelead"
            confirmMessage="Delete this test prelead? This cannot be undone."
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          />
        ) : null}
      </div>
    </article>
  )
}

export default async function PreLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; value?: string; source?: string; discovery_group_id?: string }>
}) {
  await requireAdminUser()

  const params = (await searchParams) ?? {}
  const statusFilter = (params.status ?? '').toLowerCase()
  const valueFilter = (params.value ?? 'all').toLowerCase()
  const sourceFilter = (params.source ?? '').toLowerCase()
  const discoveryGroupId = String(params.discovery_group_id ?? '').trim()

  const supabase = createSupabaseAdminClient()
  const { data: allLeads, error } = await supabase.from('pre_leads').select('*')

  if (error) {
    throw new Error(error.message)
  }

  const normalizedLeads = (allLeads as PreLeadRecord[] | null ?? []).map((lead) => ({
    ...lead,
    status: resolvedStatus(lead.status),
  }))

  const visibleLeads = normalizedLeads.filter((lead) => {
    const status = resolvedStatus(lead.status)
    const sourceMatches = !sourceFilter || (sourceFilter === 'inbound' ? lead.source === 'inbound' : lead.source === sourceFilter)
    const valueMatches = valueFilter === 'all' ? true : (lead.value_tier ?? 'low') === valueFilter

    if (statusFilter === 'dismissed') return status === 'dismissed' && sourceMatches && valueMatches
    if (statusFilter === 'all') return sourceMatches && valueMatches
    return status === 'active' && sourceMatches && valueMatches
  })

  const leads = visibleLeads.sort(comparePreLeads)

  const { data: quotes } = await supabase.from('quotes').select('notes')
  const convertedPreleadIds = new Set<string>()
  const acceptedPreleadIds = new Set<string>()

  for (const quote of quotes ?? []) {
    const notes = (quote.notes as string | null) ?? null
    const preleadId = extractNoteValue(notes, 'prelead_id')

    if (!preleadId) {
      continue
    }

    convertedPreleadIds.add(preleadId)

    if (extractNoteValue(notes, 'estimate_accepted') === 'true') {
      acceptedPreleadIds.add(preleadId)
    }
  }

  const emptyMessage =
    statusFilter === 'dismissed'
      ? 'No dismissed leads'
      : sourceFilter === 'inbound'
        ? 'No inbound leads right now'
        : valueFilter === 'high'
          ? 'No high-value leads right now'
          : statusFilter === 'all'
            ? 'No leads found'
            : 'No active leads right now'

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Internal admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Lead inbox</h1>
          <p className="mt-2 text-slate-600">Process leads one by one. Dismissed leads stay out of the default queue.</p>
          {discoveryGroupId ? <p className="mt-2 text-sm text-cyan-700">Discovery group linked: <span className="font-mono">{discoveryGroupId}</span></p> : null}
        </header>

        <section className="flex flex-wrap gap-2">
          <FilterLink active={valueFilter === 'high'} href="/admin/preleads?value=high">
            High Value
          </FilterLink>
          <FilterLink active={sourceFilter === 'inbound'} href="/admin/preleads?source=inbound">
            Inbound
          </FilterLink>
          <FilterLink active={!statusFilter || statusFilter === 'active'} href="/admin/preleads">
            Active
          </FilterLink>
          <FilterLink active={statusFilter === 'dismissed'} href="/admin/preleads?status=dismissed">
            Dismissed
          </FilterLink>
          <FilterLink active={statusFilter === 'all'} href="/admin/preleads?status=all">
            All
          </FilterLink>
        </section>

        {leads.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                converted={convertedPreleadIds.has(lead.id)}
                estimateAccepted={acceptedPreleadIds.has(lead.id)}
                dismissed={resolvedStatus(lead.status) === 'dismissed'}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
