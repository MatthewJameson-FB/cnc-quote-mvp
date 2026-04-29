type SupplierBriefInput = {
  material: string;
  quantity: number | null | undefined;
  stage: string;
  manufacturingType: string;
  routing: string;
  estimateRange: string;
  description: string;
  measurements?: string;
  fitFunction?: string;
  fileUrl?: string | null;
  photoUrls?: string[];
  photoReadiness?: string;
  photoAssessmentConfidence?: string;
  photoMissingItems?: string[];
  cadBrief?: string;
  followupQuestions?: string[];
}

function clean(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function shortDescription(value: string) {
  const cleaned = clean(value)
  if (!cleaned) return 'Not specified'
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned
}

function label(value: string | null | undefined) {
  const cleaned = clean(value)
  if (!cleaned) return 'Not specified'

  const valueToLabel = cleaned

  if (valueToLabel === 'needs_cad' || valueToLabel === 'needs_file') return 'Needs CAD recreation'
  if (valueToLabel === 'needs_print') return 'Ready for supplier quote'
  if (valueToLabel === 'needs_both') return 'Needs review (file + photos)'
  if (valueToLabel === '3d_print') return '3D print'
  if (valueToLabel === 'cnc') return 'CNC'
  if (valueToLabel === 'fabrication') return 'Fabrication'
  if (valueToLabel === 'cad_required') return 'Needs CAD recreation'
  if (valueToLabel === 'ready_from_photos') return 'Ready from photos'
  if (valueToLabel === 'needs_more_angles') return 'Needs more angles'
  if (valueToLabel === 'needs_scale_reference') return 'Needs scale reference'
  if (valueToLabel === 'needs_physical_part') return 'Needs physical part'
  return valueToLabel
}

function lineValue(value: string | null | undefined, fallback = 'Not specified') {
  const cleaned = clean(value)
  return cleaned || fallback
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const url of urls) {
    const cleaned = clean(url)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    deduped.push(cleaned)
  }

  return deduped
}

function formatLabeledUrls(prefix: 'File' | 'Photo', urls: string[]) {
  return urls.map((url, index) => `- ${prefix} ${index + 1}: ${url}`)
}

function isLikelyImageUrl(url: string) {
  const path = url.split('?')[0]?.toLowerCase() ?? ''
  return /\.(jpg|jpeg|png|gif|webp|heic|heif|avif)$/i.test(path)
}

function normalizeMissingItems(items: string[] | undefined) {
  const actionable = new Set<string>()

  for (const item of items ?? []) {
    const cleaned = clean(item).toLowerCase()
    if (!cleaned) continue

    if (cleaned.includes('front') || cleaned.includes('side') || cleaned.includes('top')) {
      actionable.add('Clear front, side, and top photos')
      continue
    }

    if (cleaned.includes('ruler') || cleaned.includes('coin') || cleaned.includes('reference object') || cleaned.includes('scale')) {
      actionable.add('Ideally with a ruler or scale reference')
      continue
    }

    if (cleaned.includes('physical part')) {
      actionable.add('If possible, send the physical part or close-up fit-detail photos')
      continue
    }

    if (cleaned.includes('measurement')) {
      actionable.add('At least one key measurement in mm')
      continue
    }

    actionable.add(lineValue(item))
  }

  return Array.from(actionable)
}

function buildCadSummary(input: SupplierBriefInput) {
  const manufacturing = label(input.manufacturingType)
  const description = shortDescription(input.description)
  const hasMeasurements = Boolean(clean(input.measurements))
  const fitText = clean(input.fitFunction)

  if (fitText && hasMeasurements) {
    return `${description} for ${manufacturing.toLowerCase()}. Key measurements provided; fit/function noted.`
  }

  if (hasMeasurements) {
    return `${description} for ${manufacturing.toLowerCase()}. Measurements partially known.`
  }

  if (fitText) {
    return `${description} for ${manufacturing.toLowerCase()}. Fit/function described, dimensions still to confirm.`
  }

  return `${description} for ${manufacturing.toLowerCase()}. Dimensions still to confirm.`
}

export function generateSupplierBrief(input: SupplierBriefInput) {
  const subject = `Quote request: ${label(input.manufacturingType)} – ${lineValue(input.material)} – ${shortDescription(input.description)}`
  const rawFileUrls = uniqueUrls([input.fileUrl])
  const fileImageUrls = rawFileUrls.filter(isLikelyImageUrl)
  const nonImageFileUrls = rawFileUrls.filter((url) => !isLikelyImageUrl(url))
  const dedupedPhotoUrls = uniqueUrls([...(input.photoUrls ?? []), ...fileImageUrls]).filter(
    (url) => !nonImageFileUrls.includes(url)
  )
  const fileUrls = nonImageFileUrls.filter((url) => !dedupedPhotoUrls.includes(url))
  const visiblePhotoUrls = dedupedPhotoUrls.slice(0, 5)
  const extraPhotoCount = Math.max(dedupedPhotoUrls.length - visiblePhotoUrls.length, 0)
  const measurements = clean(input.measurements)
  const fitFunction = clean(input.fitFunction) || clean(input.description)
  const budgetRange = clean(input.estimateRange)
  const missingItems = normalizeMissingItems(input.photoMissingItems)
  const photoReadiness = input.photoAssessmentConfidence
    ? `${label(input.photoReadiness)} (${label(input.photoAssessmentConfidence)} confidence)`
    : label(input.photoReadiness)
  const cadSummary = buildCadSummary(input)

  const body = [
    'Hi,',
    '',
    'Can you quote this job? Looking for a quick turnaround if possible.',
    '',
    'It’s a small one-off part (happy to clarify anything).',
    '',
    '--- DETAILS ---',
    `Description: ${shortDescription(input.description)}`,
    `Material: ${lineValue(input.material)}`,
    `Quantity: ${input.quantity ?? 'Not specified'}`,
    `Manufacturing: ${label(input.manufacturingType)}`,
    budgetRange ? `Budget range: ${budgetRange}` : 'Budget range: Not specified',
    '---',
    '--- DIMENSIONS / FIT ---',
    measurements ? `Measurements: ${measurements}` : 'Measurements: To be confirmed',
    `Fit/function: ${fitFunction || 'Not specified'}`,
    '---',
    '--- FILES / PHOTOS ---',
    ...(fileUrls.length ? ['File:', ...formatLabeledUrls('File', fileUrls)] : ['File: None']),
    ...(visiblePhotoUrls.length ? ['Photos:', ...formatLabeledUrls('Photo', visiblePhotoUrls)] : ['Photos: None']),
    ...(extraPhotoCount > 0 ? [`+ ${extraPhotoCount} more photos available in admin`] : []),
    '---',
    '--- CAD / NOTES ---',
    `Photo readiness: ${photoReadiness}`,
    'Missing for CAD:',
    ...(missingItems.length ? missingItems.map((item) => `- ${lineValue(item)}`) : ['- Not specified']),
    `CAD summary: ${cadSummary}`,
    '---',
    '--- PLEASE CONFIRM ---',
    '• Can you make this?',
    '• Price',
    '• Lead time',
    '• Any missing info',
    '---',
    'If this looks straightforward, feel free to quote based on what\'s here 👍',
    '',
    'Thanks 👍',
    'Flangie',
  ].join('\n')

  return `Subject:\n${subject}\n\nBody:\n${body}`
}
