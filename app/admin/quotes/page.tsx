import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { normalizeQuoteVisibilityStatus, quoteVisibilityLabel, type QuoteVisibilityStatus } from '@/lib/quote-visibility'
import QuoteVisibilityActions from '@/app/internal-admin/QuoteVisibilityActions'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type QuoteRecord = {
  id: string
  quote_ref: string | null
  name: string | null
  email: string | null
  created_at: string
  notes: string | null
  status: string | null
  quote_low: number | null
  quote_high: number | null
  customer_estimate_min: number | null
  customer_estimate_max: number | null
  final_quote_amount: number | null
  job_value: number | null
  material: string | null
  complexity: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: string | null
  model_specifics: string | null
  issue_type: string | null
  size_estimate: string | null
  search_context: string | null
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

function extractNoteValue(notes: string | null | undefined, key: string) {
  if (!notes) return null
  const matches = Array.from(notes.matchAll(new RegExp(`^${key}:\\s*(.+)$`, 'gm')))
  const lastMatch = matches.at(-1)
  return lastMatch?.[1]?.trim() || null
}

function quoteDescription(quote: QuoteRecord) {
  return (
    extractNoteValue(quote.notes, 'description') ||
    [quote.material, quote.complexity].filter(Boolean).join(' • ') ||
    quote.quote_ref ||
    'Quote request'
  )
}

function quoteValue(quote: QuoteRecord) {
  if (quote.customer_estimate_min != null || quote.customer_estimate_max != null) {
    return `${formatMoney(quote.customer_estimate_min)} – ${formatMoney(quote.customer_estimate_max)}`
  }

  if (quote.final_quote_amount != null) return formatMoney(quote.final_quote_amount)
  if (quote.job_value != null) return formatMoney(quote.job_value)
  if (quote.quote_low != null || quote.quote_high != null) {
    return `${formatMoney(quote.quote_low)} – ${formatMoney(quote.quote_high)}`
  }

  return '—'
}

function QuoteCard({ quote }: { quote: QuoteRecord }) {
  const status = normalizeQuoteVisibilityStatus(quote.status)
  const contact = [quote.name, quote.email].filter(Boolean).join(' • ')

  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>{formatDate(quote.created_at)}</span>
            <span>•</span>
            <span>{quoteVisibilityLabel(status as QuoteVisibilityStatus)}</span>
          </div>
          <h2 className="min-w-0 text-xl font-bold text-slate-900">{quoteDescription(quote)}</h2>
          <p className="text-sm text-slate-600">{contact || 'No contact details'}</p>
          <p className="text-sm text-slate-600">Quote ref: {quote.quote_ref || '—'}</p>
        </div>

        <div className="space-y-2 text-right">
          <p className="text-3xl font-bold text-slate-900">{quoteValue(quote)}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">Estimated value</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current status</p>
          <p className="mt-1 text-slate-700">{quoteVisibilityLabel(status as QuoteVisibilityStatus)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created at</p>
          <p className="mt-1 text-slate-700">{formatDate(quote.created_at)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/quotes/${quote.id}`}
          className="inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700"
        >
          Open workbench
        </Link>
        <QuoteVisibilityActions quoteId={quote.id} status={status} />
      </div>
    </article>
  )
}

function FilterLink({ active, href, children }: { active: boolean; href: string; children: string }) {
  return (
    <a
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
    >
      {children}
    </a>
  )
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  await requireAdminUser()

  const params = (await searchParams) ?? {}
  const statusFilter = (params.status ?? 'active').toLowerCase()
  const supabase = createSupabaseAdminClient()

  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const allQuotes = (quotes ?? []).map((quote) => ({
    ...quote,
    visibilityStatus: normalizeQuoteVisibilityStatus(quote.status),
  }))

  const filteredQuotes = allQuotes.filter((quote) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'dismissed') return quote.visibilityStatus === 'dismissed'
    if (statusFilter === 'contacted') return quote.visibilityStatus === 'contacted'
    if (statusFilter === 'converted') return quote.visibilityStatus === 'converted'
    return quote.visibilityStatus === 'active'
  })

  const emptyMessage =
    statusFilter === 'dismissed'
      ? 'No dismissed quotes'
      : statusFilter === 'contacted'
        ? 'No contacted quotes right now'
        : statusFilter === 'converted'
          ? 'No converted quotes yet'
          : statusFilter === 'all'
            ? 'No quotes found'
            : 'No active quotes right now'

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Internal admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Quotes inbox</h1>
          <p className="mt-2 text-slate-600">Process quotes one by one. Dismissed quotes stay out of the default queue.</p>
        </header>

        <section className="flex flex-wrap gap-2">
          <FilterLink active={statusFilter === 'active'} href="/admin/quotes">Active</FilterLink>
          <FilterLink active={statusFilter === 'contacted'} href="/admin/quotes?status=contacted">Contacted</FilterLink>
          <FilterLink active={statusFilter === 'converted'} href="/admin/quotes?status=converted">Converted</FilterLink>
          <FilterLink active={statusFilter === 'dismissed'} href="/admin/quotes?status=dismissed">Dismissed</FilterLink>
          <FilterLink active={statusFilter === 'all'} href="/admin/quotes?status=all">All</FilterLink>
        </section>

        {filteredQuotes.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredQuotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
