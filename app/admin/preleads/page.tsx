import PreLeadsPage from '@/app/internal-admin/pre-leads/page'

export default async function AdminPreleadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; value?: string; source?: string; discovery_group_id?: string }>
}) {
  return <PreLeadsPage searchParams={searchParams} />
}
