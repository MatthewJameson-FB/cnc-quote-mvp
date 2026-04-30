import { requireAdminUser } from '@/lib/admin-auth'
import {
  genericFallbackSearchChips,
  highValueSearchChips,
  objectSpecificSearchChips,
} from '@/lib/discovery-groups'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createDiscoveryGroup, markDiscoveryGroupChecked, updateDiscoveryGroup } from './actions'

export const dynamic = 'force-dynamic'

type DiscoveryGroup = {
  id: string
  source: 'facebook' | 'instagram'
  name: string
  url: string
  location: string | null
  category: string | null
  priority: number | null
  notes: string | null
  active: boolean | null
  last_checked_at: string | null
  created_at: string | null
}

type SearchParams = {
  source?: string
  location?: string
  category?: string
  active_only?: string
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function buildTrackedDiscoveryUrl(basePath: string, groupId: string, query?: string) {
  const params = new URLSearchParams({ groupId })
  if (query) {
    params.set('query', query)
  }
  return `${basePath}/open?${params.toString()}`
}

function buildPasteLeadUrl(basePath: string, group: DiscoveryGroup) {
  const params = new URLSearchParams({
    source: group.source,
    discovery_group_id: group.id,
  })
  return `${basePath}?${params.toString()}`
}

function ChipRow({
  title,
  chips,
  group,
  discoveryBasePath,
}: {
  title: string
  chips: readonly string[]
  group: DiscoveryGroup
  discoveryBasePath: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <a
            key={`${group.id}-${title}-${chip}`}
            href={buildTrackedDiscoveryUrl(discoveryBasePath, group.id, chip)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            {chip}
          </a>
        ))}
      </div>
    </div>
  )
}

function EditGroupForm({ group }: { group: DiscoveryGroup }) {
  return (
    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">Edit</summary>
      <form action={updateDiscoveryGroup} className="mt-4 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="groupId" value={group.id} />
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Name
          <input name="name" defaultValue={group.name} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          URL
          <input name="url" type="url" defaultValue={group.url} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Location
          <input name="location" defaultValue={group.location ?? 'UK'} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Category
          <input name="category" defaultValue={group.category ?? ''} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Priority
          <input name="priority" type="number" min={1} max={5} defaultValue={group.priority ?? 3} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Notes
          <textarea name="notes" rows={3} defaultValue={group.notes ?? ''} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700 md:col-span-2">
          <input name="active" type="checkbox" defaultChecked={Boolean(group.active)} className="h-4 w-4 rounded border-slate-300" />
          Active
        </label>
        <div className="md:col-span-2">
          <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Save changes
          </button>
        </div>
      </form>
    </details>
  )
}

export default async function DiscoveryGroupsPageView({
  searchParams,
  discoveryBasePath,
  pasteLeadPath,
}: {
  searchParams?: Promise<SearchParams>
  discoveryBasePath: string
  pasteLeadPath: string
}) {
  await requireAdminUser()

  const params = (await searchParams) ?? {}
  const sourceFilter = (params.source ?? 'all').toLowerCase()
  const locationFilter = (params.location ?? 'all').trim()
  const categoryFilter = (params.category ?? 'all').trim()
  const activeOnly = params.active_only ? params.active_only === 'true' : true

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('discovery_groups')
    .select('*')
    .order('active', { ascending: false })
    .order('priority', { ascending: false })
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const allGroups = (data as DiscoveryGroup[] | null) ?? []
  const categories = [...new Set(allGroups.map((group) => group.category).filter(Boolean))] as string[]
  const locations = [...new Set(allGroups.map((group) => group.location).filter(Boolean))] as string[]

  const groups = allGroups.filter((group) => {
    if (sourceFilter !== 'all' && group.source !== sourceFilter) return false
    if (locationFilter !== 'all' && (group.location ?? '') !== locationFilter) return false
    if (categoryFilter !== 'all' && (group.category ?? '') !== categoryFilter) return false
    if (activeOnly && !group.active) return false
    return true
  })

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Internal admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Discovery Groups</h1>
          <p className="mt-2 text-slate-600">Saved places to manually check for repair/replacement-part leads. No scraping. No auto-posting.</p>
        </header>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Add group</p>
          <form action={createDiscoveryGroup} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Source
              <select name="source" defaultValue="facebook" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900">
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Priority
              <input name="priority" type="number" min={1} max={5} defaultValue={3} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Name
              <input name="name" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              URL
              <input name="url" type="url" placeholder="https://..." className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Location
              <input name="location" defaultValue="UK" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Category
              <input name="category" placeholder="DIY / spares / repairs" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Notes
              <textarea name="notes" rows={3} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900" />
            </label>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 md:col-span-2">
              <input name="active" type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
              Active
            </label>
            <div className="md:col-span-2">
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                Save group
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <form className="grid gap-4 md:grid-cols-4" method="get">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Source
              <select name="source" defaultValue={sourceFilter} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900">
                <option value="all">All</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Location
              <select name="location" defaultValue={locationFilter} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900">
                <option value="all">All</option>
                {locations.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Category
              <select name="category" defaultValue={categoryFilter} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900">
                <option value="all">All</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 md:self-end">
              <input name="active_only" type="checkbox" value="true" defaultChecked={activeOnly} className="h-4 w-4 rounded border-slate-300" />
              Active only
            </label>
            <div className="md:col-span-4">
              <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Apply filters
              </button>
            </div>
          </form>
        </section>

        {groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">No discovery groups match this view.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {groups.map((group) => (
              <article key={group.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${group.active ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'}`}>
                        {group.active ? 'Active' : 'Paused'}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {group.source}
                      </span>
                      <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 ring-1 ring-violet-200">
                        Priority {group.priority ?? 3}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-slate-900">{group.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{group.location || 'UK'} · {group.category || 'uncategorised'}</p>
                    <a href={buildTrackedDiscoveryUrl(discoveryBasePath, group.id)} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-medium text-blue-600 underline">
                      {group.url}
                    </a>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>Last checked: {formatDate(group.last_checked_at)}</p>
                    <p className="mt-1">Added: {formatDate(group.created_at)}</p>
                  </div>
                </div>

                {group.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{group.notes}</p> : null}

                <div className="mt-4 space-y-4">
                  <ChipRow title="High value" chips={highValueSearchChips} group={group} discoveryBasePath={discoveryBasePath} />
                  <ChipRow title="Object-specific" chips={objectSpecificSearchChips} group={group} discoveryBasePath={discoveryBasePath} />
                  <ChipRow title="Generic" chips={genericFallbackSearchChips} group={group} discoveryBasePath={discoveryBasePath} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={buildTrackedDiscoveryUrl(discoveryBasePath, group.id)} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                    Open group
                  </a>
                  <form action={markDiscoveryGroupChecked}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Mark checked
                    </button>
                  </form>
                  <a href={buildPasteLeadUrl(pasteLeadPath, group)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Paste lead
                  </a>
                </div>

                <EditGroupForm group={group} />
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
