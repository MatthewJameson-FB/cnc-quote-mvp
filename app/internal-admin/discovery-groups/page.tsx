import DiscoveryGroupsPageView from './DiscoveryGroupsPageView'

export const dynamic = 'force-dynamic'

export default async function DiscoveryGroupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string; location?: string; category?: string; active_only?: string }>
}) {
  return (
    <DiscoveryGroupsPageView
      searchParams={searchParams}
      discoveryBasePath="/internal-admin/discovery-groups"
      pasteLeadPath="/internal-admin/pre-leads"
    />
  )
}
