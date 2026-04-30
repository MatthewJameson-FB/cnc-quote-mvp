import PreLeadsPage from '@/app/internal-admin/pre-leads/page'

export default async function AdminManualLeadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  return <PreLeadsPage searchParams={searchParams as Promise<{ status?: string; value?: string; source?: string; discovery_group_id?: string }> | undefined} />
}
