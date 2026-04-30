import DiscoveryGroupsPageView from '@/app/internal-admin/discovery-groups/DiscoveryGroupsPageView'

export const dynamic = 'force-dynamic'

export default async function AdminDiscoveryGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string; location?: string; category?: string; active_only?: string }>
}) {
  return (
    <DiscoveryGroupsPageView
      searchParams={searchParams}
      discoveryBasePath="/admin/discovery-groups"
      pasteLeadPath="/admin/manual-lead"
    />
  )
}
