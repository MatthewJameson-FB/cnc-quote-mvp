type SupplierBriefInput = {
  material: string;
  quantity: number | null | undefined;
  stage: string;
  manufacturingType: string;
  routing: string;
  estimateRange: string;
  description: string;
  fileUrl?: string | null;
  photoUrls?: string[];
  photoReadiness?: string;
  cadBrief?: string;
  followupQuestions?: string[];
}

function shortDescription(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'manual review'
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned
}

function label(value: string) {
  if (value === 'needs_cad' || value === 'needs_file') return 'Needs CAD recreation'
  if (value === 'needs_print') return 'Ready for supplier quote'
  if (value === 'needs_both') return 'Needs review (file + photos)'
  if (value === '3d_print') return '3D print'
  if (value === 'cnc') return 'CNC'
  if (value === 'fabrication') return 'Fabrication'
  if (value === 'cad_required') return 'Needs CAD recreation'
  if (value === 'ready_from_photos') return 'Ready from photos'
  if (value === 'needs_more_angles') return 'Needs more angles'
  if (value === 'needs_scale_reference') return 'Needs scale reference'
  if (value === 'needs_physical_part') return 'Needs physical part'
  return value || '—'
}

export function generateSupplierBrief(input: SupplierBriefInput) {
  const subject = `Quote request: ${label(input.manufacturingType)} / ${input.material || 'material tbc'} / ${shortDescription(input.description)}`
  const photoLines = input.photoUrls?.length
    ? input.photoUrls.map((url) => `- ${url}`)
    : ['- None']
  const followupLines = input.followupQuestions?.length
    ? input.followupQuestions.map((item) => `- ${item}`)
    : ['- None']

  const body = [
    'Hi,',
    '',
    'Can you quote this job?',
    '',
    'Customer request:',
    `- Description: ${input.description || '—'}`,
    `- Material: ${input.material || '—'}`,
    `- Quantity: ${input.quantity ?? '—'}`,
    `- Stage: ${label(input.stage)}`,
    `- Manufacturing type: ${label(input.manufacturingType)}`,
    `- Routing: ${label(input.routing)}`,
    `- Estimate range: ${input.estimateRange || '—'}`,
    '',
    'Files/photos:',
    `- File: ${input.fileUrl || 'None'}`,
    '- Photos:',
    ...photoLines,
    '',
    'CAD/photo assessment:',
    `- Photo readiness: ${label(input.photoReadiness || '—')}`,
    `- CAD brief: ${input.cadBrief || '—'}`,
    '- Follow-up details:',
    ...followupLines,
    '',
    'Questions for supplier:',
    '- Can you make this?',
    '- Estimated cost?',
    '- Lead time?',
    '- Any missing information?',
    '',
    'Please reply with price, lead time, and any questions.',
    '',
    'Thanks,',
    'Flangie',
  ].join('\n')

  return `Subject:\n${subject}\n\nBody:\n${body}`
}
