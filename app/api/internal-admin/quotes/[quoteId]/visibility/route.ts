import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type QuoteVisibilityAction = 'dismiss' | 'undo' | 'contacted' | 'converted'

function nowIso() {
  return new Date().toISOString()
}

function getAction(body: unknown): QuoteVisibilityAction | null {
  if (!body || typeof body !== 'object') return null
  const action = 'action' in body ? String((body as { action?: unknown }).action ?? '').trim().toLowerCase() : ''
  if (action === 'dismiss' || action === 'undo' || action === 'contacted' || action === 'converted') return action
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  await requireAdminUser()

  const { quoteId } = await params
  const action = getAction(await request.json().catch(() => null))

  if (!quoteId) {
    return NextResponse.json({ error: 'Missing quote id.' }, { status: 400 })
  }

  if (!action) {
    return NextResponse.json({ error: 'Missing or invalid action.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const update: Record<string, unknown> = {}

  if (action === 'dismiss') {
    update.status = 'dismissed'
    update.dismissed_reason = 'manual'
    update.dismissed_at = nowIso()
  }

  if (action === 'undo') {
    update.status = 'active'
    update.dismissed_reason = null
    update.dismissed_at = null
  }

  if (action === 'contacted') {
    update.status = 'contacted'
    update.contacted_at = nowIso()
    update.dismissed_reason = null
    update.dismissed_at = null
  }

  if (action === 'converted') {
    update.status = 'converted'
    update.converted_at = nowIso()
    update.dismissed_reason = null
    update.dismissed_at = null
  }

  if (action === 'contacted' && !update.contacted_at) {
    update.contacted_at = nowIso()
  }

  const { error } = await supabase.from('quotes').update(update).eq('id', quoteId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
