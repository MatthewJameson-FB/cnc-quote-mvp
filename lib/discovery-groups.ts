export type DiscoverySource = 'facebook' | 'instagram'

export const highValueSearchChips = [
  "can't find this part anywhere",
  "manufacturer doesn't sell this part",
  'discontinued part',
  'obsolete part',
  'replacement part unavailable',
  'no spare parts available',
  'need this part to use it',
  "can't use it without this",
  "won't close",
  "won't latch",
] as const

export const objectSpecificSearchChips = [
  'caravan part broken',
  'motorhome part missing',
  'campervan trim broken',
  'car interior clip broken',
  'car trim broke',
  'plastic trim clip',
  'replacement latch',
  'broken bracket',
  'replacement hinge',
  'broken handle',
] as const

export const genericFallbackSearchChips = [
  'broken plastic part',
  "can't find replacement",
  'replacement knob',
  'missing cover',
  'snapped clip',
  'lost part',
  'replacement bracket',
] as const

export function buildFacebookGroupSearchUrl(groupUrl: string, query: string) {
  const cleanUrl = groupUrl.replace(/\/$/, '')
  return `${cleanUrl}/search/?q=${encodeURIComponent(query)}`
}

export function buildDiscoverySearchUrl(source: DiscoverySource, groupUrl: string, query: string) {
  if (source === 'facebook') {
    return buildFacebookGroupSearchUrl(groupUrl, query)
  }

  return groupUrl.replace(/\/$/, '')
}
