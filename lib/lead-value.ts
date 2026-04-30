export type LeadValueTier = 'low' | 'medium' | 'high'

const expensiveObjectPatterns = [
  /\bcar\b/i,
  /\bvan\b/i,
  /\bcaravan\b/i,
  /\bmotorhome\b/i,
  /\btool\b/i,
  /\bmachinery\b/i,
  /\bfurniture\b/i,
  /\bgym equipment\b/i,
  /\bboat\b/i,
]

const unavailablePatterns = [
  /can't find/i,
  /cannot find/i,
  /discontinued/i,
  /manufacturer doesn't sell/i,
  /out of stock/i,
]

const usageBlockingPatterns = [
  /can't use/i,
  /won't close/i,
  /won't latch/i,
  /won't stay/i,
  /can't attach/i,
]

const simplePartPatterns = [
  /\bclip\b/i,
  /\bbracket\b/i,
  /\bcover\b/i,
  /\bknob\b/i,
  /\bhandle\b/i,
  /\btrim\b/i,
  /\blatch\b/i,
]

const internalElectricalPatterns = [
  /\bmotor\b/i,
  /\bcircuit\b/i,
  /\bpcb\b/i,
  /\bsensor\b/i,
  /\bengine\b/i,
  /\binternal\b/i,
]

const lowValuePatterns = [
  /\bkettle\b/i,
  /\btoy\b/i,
  /\bcheap\b/i,
  /\bremote\b/i,
]

export type LeadValueScoreResult = {
  value_tier: LeadValueTier
  value_score: number
  value_reason: string
}

export function classifyLeadValueTier(score: number): LeadValueTier {
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

export function scoreLeadValue(text: string): LeadValueScoreResult {
  const haystack = text.trim()
  let value_score = 0
  const reasons: string[] = []

  if (expensiveObjectPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 3
    reasons.push('expensive object')
  }

  if (unavailablePatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 3
    reasons.push('unavailable/discontinued')
  }

  if (usageBlockingPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 2
    reasons.push('blocks usage')
  }

  if (simplePartPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 1
    reasons.push('simple part')
  }

  if (internalElectricalPatterns.some((pattern) => pattern.test(haystack))) {
    value_score -= 3
    reasons.push('internal/electrical')
  }

  if (lowValuePatterns.some((pattern) => pattern.test(haystack))) {
    value_score -= 2
    reasons.push('cheap/low-value object')
  }

  return {
    value_tier: classifyLeadValueTier(value_score),
    value_score,
    value_reason: reasons.length ? reasons.join('; ') : 'baseline',
  }
}
