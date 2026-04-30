export const quoteVisibilityStatuses = [
  'active',
  'contacted',
  'converted',
  'dismissed',
] as const

export type QuoteVisibilityStatus = (typeof quoteVisibilityStatuses)[number]

export function normalizeQuoteVisibilityStatus(status: string | null | undefined): QuoteVisibilityStatus {
  const value = (status ?? '').trim().toLowerCase()

  if (value === 'dismissed') return 'dismissed'
  if (value === 'contacted') return 'contacted'
  if (value === 'converted') return 'converted'
  return 'active'
}

export function isDismissedQuoteStatus(status: string | null | undefined) {
  return normalizeQuoteVisibilityStatus(status) === 'dismissed'
}

export function quoteVisibilityLabel(status: QuoteVisibilityStatus) {
  if (status === 'active') return 'Active'
  if (status === 'contacted') return 'Contacted'
  if (status === 'converted') return 'Converted'
  return 'Dismissed'
}
