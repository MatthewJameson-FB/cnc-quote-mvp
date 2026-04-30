import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { scoreLeadValue } from '@/lib/lead-value'
import { sendInboundPartSubmissionEmail } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function isMissingColumnError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error ?? '')
  return /column .* does not exist|could not find the .* column|schema cache/i.test(message)
}

async function readInput(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null)
    return {
      description: cleanString(body?.description),
      email: cleanString(body?.email),
      image_url: cleanString(body?.image_url),
      image: null as File | null,
    }
  }

  const formData = await request.formData()
  const image = formData.get('image')
  return {
    description: cleanString(formData.get('description')),
    email: cleanString(formData.get('email')),
    image_url: cleanString(formData.get('image_url')),
    image: image instanceof File && image.size > 0 ? image : null,
  }
}

export async function POST(request: NextRequest) {
  const submissionId = crypto.randomUUID()
  const { description, email, image_url, image } = await readInput(request)

  if (!description) {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  if (!image && !image_url) {
    return NextResponse.json({ error: 'Upload a photo or paste an image URL.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  let storedImageUrl = image_url || null

  if (image) {
    const fileName = safeFileName(image.name || 'part-image.jpg')
    const filePath = `inbound-parts/${submissionId}-${fileName}`
    const { error: uploadError } = await supabase.storage.from('quote-files').upload(filePath, image, {
      contentType: image.type || 'application/octet-stream',
      upsert: false,
    })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    storedImageUrl = filePath
  }

  const value = scoreLeadValue(description)
  const sourceUrl = `${request.nextUrl.origin}/submit-part?submission=${submissionId}`

  const { error } = await supabase.from('pre_leads').insert({
    source: 'inbound',
    source_url: sourceUrl,
    source_author: email,
    title: 'Website inbound part request',
    snippet: description,
    post_text: description,
    image_url: storedImageUrl,
    contact_email: email,
    matched_keywords: [],
    detected_materials: [],
    lead_score: Math.max(0, value.value_score),
    value_tier: value.value_tier,
    value_score: value.value_score,
    value_reason: value.value_reason,
    suggested_reply: '',
    status: 'active',
    reviewed_at: null,
    contacted_at: null,
    dismissed_reason: null,
    dismissed_at: null,
  })

  if (error && isMissingColumnError(error)) {
    const fallbackNotes = [
      description ? `description: ${description}` : null,
      email ? `contact_email: ${email}` : null,
      storedImageUrl ? `image_url: ${storedImageUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const fallback = await supabase.from('pre_leads').insert({
      source: 'inbound',
      source_url: sourceUrl,
      source_author: email,
      title: 'Website inbound part request',
      snippet: description,
      manual_notes: fallbackNotes || null,
      matched_keywords: [],
      detected_materials: [],
      lead_score: Math.max(0, value.value_score),
      value_tier: value.value_tier,
      value_score: value.value_score,
      value_reason: value.value_reason,
      suggested_reply: '',
      status: 'active',
      reviewed_at: null,
      contacted_at: null,
    })

    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    }

    void sendInboundPartSubmissionEmail({
      contactEmail: email,
      description,
      imageUrl: image ? storedImageUrl : image_url || null,
      valueScore: value.value_score,
      valueTier: value.value_tier,
      adminLink: `${request.nextUrl.origin}/internal-admin/pre-leads?status=active&value=high_medium`,
    }).catch((mailError) => {
      console.error('INBOUND PART ALERT EMAIL ERROR:', mailError)
    })

    return NextResponse.json({ ok: true, submission_id: submissionId, value_score: value.value_score, value_tier: value.value_tier })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void sendInboundPartSubmissionEmail({
    contactEmail: email,
    description,
    imageUrl: image ? storedImageUrl : image_url || null,
    valueScore: value.value_score,
    valueTier: value.value_tier,
    adminLink: `${request.nextUrl.origin}/internal-admin/pre-leads?status=active&value=high_medium`,
  }).catch((mailError) => {
    console.error('INBOUND PART ALERT EMAIL ERROR:', mailError)
  })

  return NextResponse.json({ ok: true, submission_id: submissionId, value_score: value.value_score, value_tier: value.value_tier })
}
