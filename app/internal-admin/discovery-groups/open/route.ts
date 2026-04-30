import { requireAdminUser } from '@/lib/admin-auth'
import { buildDiscoverySearchUrl } from '@/lib/discovery-groups'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type DiscoveryGroupRow = {
  id: string
  source: 'facebook' | 'instagram'
  url: string
}

export async function GET(request: NextRequest) {
  await requireAdminUser()

  const groupId = request.nextUrl.searchParams.get('groupId')?.trim()
  const query = request.nextUrl.searchParams.get('query')?.trim() ?? ''

  if (!groupId) {
    return NextResponse.json({ error: 'Missing discovery group id.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: group, error } = await supabase
    .from('discovery_groups')
    .select('id, source, url')
    .eq('id', groupId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!group) {
    return NextResponse.json({ error: 'Discovery group not found.' }, { status: 404 })
  }

  const typedGroup = group as DiscoveryGroupRow
  const destination = query
    ? buildDiscoverySearchUrl(typedGroup.source, typedGroup.url, query)
    : typedGroup.url

  const { error: eventError } = await supabase.from('discovery_group_events').insert({
    group_id: typedGroup.id,
    search_query: query || null,
    notes: query ? 'manual_search_open' : 'group_open',
  })

  if (eventError) {
    console.warn(`discovery_group_events insert skipped: ${eventError.message}`)
  }

  return NextResponse.redirect(new URL(destination))
}
