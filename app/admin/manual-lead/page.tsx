import { redirect } from 'next/navigation'

function buildTargetUrl(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
      continue
    }

    if (value != null) {
      params.set(key, value)
    }
  }

  const query = params.toString()
  return query ? `/internal-admin/pre-leads?${query}` : '/internal-admin/pre-leads'
}

export default async function AdminManualLeadPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  redirect(buildTargetUrl((await searchParams) ?? {}))
}
