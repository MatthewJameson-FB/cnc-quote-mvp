import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { scoreLeadValue } from '@/lib/lead-value'
import { normalizeQuoteVisibilityStatus } from '@/lib/quote-visibility'
import DismissLeadButton from '@/app/internal-admin/pre-leads/DismissLeadButton'
import { setPreLeadContacted } from '@/app/internal-admin/pre-leads/actions'

export const dynamic = 'force-dynamic'

type DashboardLead = {
  id: string
  created_at: string
  source: string
  source_url: string | null
  title: string
  snippet: string
  value_tier: 'low' | 'medium' | 'high' | null
}

type DashboardQuote = {
  id: string
  created_at: string
  quote_ref: string | null
  notes: string | null
  material: string | null
  complexity: string | null
  job_value: number | null
  status: string | null
}

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function truncate(value: string, limit = 92) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
}

function formatLeadText(lead: DashboardLead) {
  return truncate(lead.title || lead.snippet || 'No description', 88)
}

function deriveQuoteTier(quote: DashboardQuote) {
  const text = [quote.quote_ref, quote.notes, quote.material, quote.complexity, String(quote.job_value ?? '')]
    .filter(Boolean)
    .join(' ')

  return scoreLeadValue(text).value_tier
}

function LeadItem({ lead }: { lead: DashboardLead }) {
  const valueTier = lead.value_tier ?? 'low'
  const viewHref = lead.source_url ?? '/admin/preleads'

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{lead.source}</span>
          <span>•</span>
          <span>{valueTier}</span>
          <span>•</span>
          <span>{formatTime(lead.created_at)}</span>
        </div>
        <p className="min-w-0 text-sm font-medium text-slate-900">{formatLeadText(lead)}</p>
        <p className="break-all text-xs text-slate-500">{lead.source_url ?? 'No source URL'}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={viewHref}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          View
        </a>
        <form action={setPreLeadContacted}>
          <input type="hidden" name="preLeadId" value={lead.id} />
          <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Reply
          </button>
        </form>
        <DismissLeadButton leadId={lead.id} dismissed={false} />
      </div>
    </article>
  )
}

function QuoteItem({ quote }: { quote: DashboardQuote }) {
  const valueTier = deriveQuoteTier(quote)
  const quoteRef = quote.quote_ref || `CNC-${quote.id.slice(0, 8).toUpperCase()}`
  const description = truncate(
    [quote.material, quote.complexity, quote.notes].filter(Boolean).join(' • ') || quoteRef,
    96
  )

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{quoteRef}</span>
          <span>•</span>
          <span>{valueTier}</span>
          <span>•</span>
          <span>{formatTime(quote.created_at)}</span>
        </div>
        <p className="min-w-0 text-sm font-medium text-slate-900">{description}</p>
        <p className="text-xs text-slate-500">{normalizeQuoteVisibilityStatus(quote.status) === 'active' ? 'Active quote' : 'Quote in progress'}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/quotes"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          View
        </Link>
      </div>
    </article>
  )
}

export default async function AdminPage() {
  await requireAdminUser()

  const supabase = createSupabaseAdminClient()

  const [{ data: topLeads, error: topLeadsError }, { data: inboundLeads, error: inboundError }, { data: quotes, error: quotesError }] = await Promise.all([
    supabase
      .from('pre_leads')
      .select('id, created_at, source, source_url, title, snippet, value_tier, status, contacted_at')
      .eq('value_tier', 'high')
      .eq('status', 'active')
      .is('contacted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('pre_leads')
      .select('id, created_at, source, source_url, title, snippet, value_tier, status')
      .eq('source', 'inbound')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('quotes')
      .select('id, created_at, quote_ref, notes, material, complexity, job_value, status')
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  if (topLeadsError) throw new Error(topLeadsError.message)
  if (inboundError) throw new Error(inboundError.message)
  if (quotesError) throw new Error(quotesError.message)

  const activeQuotes = (quotes ?? [])
    .filter((quote) => normalizeQuoteVisibilityStatus(quote.status) === 'active')
    .slice(0, 5)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Admin dashboard</h1>
          <p className="mt-2 text-slate-600">Open this page and work the queue.</p>
        </header>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Top Leads</h2>
              <p className="mt-1 text-sm text-slate-600">High-value, active, not contacted yet.</p>
            </div>
            <Link href="/admin/preleads?status=active&value=high" className="text-sm font-medium text-cyan-700 hover:underline">Open all</Link>
          </div>

          <div className="grid gap-4">
            {topLeads?.length ? topLeads.map((lead) => <LeadItem key={lead.id} lead={lead as DashboardLead} />) : <p className="text-sm text-slate-500">No top leads right now.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Inbound Leads</h2>
              <p className="mt-1 text-sm text-slate-600">Recent inbound submissions.</p>
            </div>
            <Link href="/admin/preleads?source=inbound" className="text-sm font-medium text-cyan-700 hover:underline">Open all</Link>
          </div>

          <div className="grid gap-4">
            {inboundLeads?.length ? inboundLeads.map((lead) => <LeadItem key={lead.id} lead={lead as DashboardLead} />) : <p className="text-sm text-slate-500">No inbound leads yet.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Active Quotes</h2>
              <p className="mt-1 text-sm text-slate-600">Quotes that still need attention.</p>
            </div>
            <Link href="/admin/quotes" className="text-sm font-medium text-cyan-700 hover:underline">Open all</Link>
          </div>

          <div className="grid gap-4">
            {activeQuotes.length ? activeQuotes.map((quote) => <QuoteItem key={quote.id} quote={quote as DashboardQuote} />) : <p className="text-sm text-slate-500">No active quotes right now.</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
