"use server"

import { revalidatePath } from 'next/cache'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

function nowIso() {
  return new Date().toISOString()
}

function revalidateDiscoveryGroupViews() {
  revalidatePath('/internal-admin/discovery-groups')
  revalidatePath('/admin/discovery-groups')
}

function parsePriority(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 3)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : 3
}

function parseOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text || null
}

function parseRequiredUrl(value: FormDataEntryValue | null, fieldName: string) {
  const url = String(value ?? '').trim()

  try {
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    throw new Error(`${fieldName} must be a valid http(s) URL.`)
  }

  return url
}

export async function createDiscoveryGroup(formData: FormData) {
  await requireAdminUser()

  const source = String(formData.get('source') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const url = parseRequiredUrl(formData.get('url'), 'Group URL')
  const location = String(formData.get('location') ?? 'UK').trim() || 'UK'
  const category = String(formData.get('category') ?? '').trim()
  const priority = parsePriority(formData.get('priority'))
  const notes = String(formData.get('notes') ?? '').trim()
  const active = formData.get('active') === 'on'

  if (!['facebook', 'instagram'].includes(source)) {
    throw new Error('Invalid source.')
  }

  if (!name) {
    throw new Error('Group name is required.')
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('discovery_groups').insert({
    source,
    name,
    url,
    location,
    category: category || null,
    priority,
    notes: notes || null,
    active,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidateDiscoveryGroupViews()
}

export async function updateDiscoveryGroup(formData: FormData) {
  await requireAdminUser()

  const groupId = String(formData.get('groupId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const url = parseRequiredUrl(formData.get('url'), 'Group URL')
  const location = String(formData.get('location') ?? 'UK').trim() || 'UK'
  const category = parseOptionalText(formData.get('category'))
  const priority = parsePriority(formData.get('priority'))
  const notes = parseOptionalText(formData.get('notes'))
  const active = formData.get('active') === 'on'

  if (!groupId) {
    throw new Error('Missing discovery group id.')
  }

  if (!name) {
    throw new Error('Group name is required.')
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('discovery_groups')
    .update({
      name,
      url,
      location,
      category,
      priority,
      notes,
      active,
    })
    .eq('id', groupId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateDiscoveryGroupViews()
}

export async function markDiscoveryGroupChecked(formData: FormData) {
  await requireAdminUser()

  const groupId = String(formData.get('groupId') ?? '').trim()

  if (!groupId) {
    throw new Error('Missing discovery group id.')
  }

  const supabase = createSupabaseAdminClient()
  const checkedAt = nowIso()
  const { error } = await supabase
    .from('discovery_groups')
    .update({ last_checked_at: checkedAt })
    .eq('id', groupId)

  if (error) {
    throw new Error(error.message)
  }

  const { error: eventError } = await supabase.from('discovery_group_events').insert({
    group_id: groupId,
    notes: 'marked_checked',
    opened_at: checkedAt,
  })

  if (eventError) {
    console.warn(`discovery_group_events insert skipped: ${eventError.message}`)
  }

  revalidateDiscoveryGroupViews()
}
