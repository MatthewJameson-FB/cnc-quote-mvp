import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ preLeadId: string }> }
) {
  await requireAdminUser()

  const { preLeadId } = await params
  const supabase = createSupabaseAdminClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('pre_leads')
    .update({ status: 'dismissed', dismissed_reason: 'manual', dismissed_at: now })
    .eq('id', preLeadId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
