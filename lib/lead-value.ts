export type LeadValueTier = 'low' | 'medium' | 'high'

const automotiveContextPatterns = [
  /\bcar\b/i,
  /\bvehicle\b/i,
  /\bBMW\b/i,
  /\bAudi\b/i,
  /\bMercedes\b/i,
  /\bVW\b/i,
  /\bVolkswagen\b/i,
  /\bFord\b/i,
  /\bToyota\b/i,
  /\bHonda\b/i,
  /\binterior\b/i,
  /\btrim\b/i,
]

const automotivePartPatterns = [
  /\binterior trim\b/i,
  /\bdashboard\b/i,
  /\bpanel\b/i,
  /\bbracket\b/i,
  /\bmount\b/i,
  /\bclip\b/i,
  /\bhousing\b/i,
  /\bcover\b/i,
  /\btrim piece\b/i,
  /\bmirror casing\b/i,
  /\bbumper trim\b/i,
  /\bgrille\b/i,
]

const unavailablePatterns = [
  /can't find/i,
  /cannot find/i,
  /discontinued/i,
  /nla/i,
  /no longer available/i,
  /dealer unavailable/i,
  /no replacement/i,
  /oem too expensive/i,
  /manufacturer doesn't sell/i,
  /out of stock/i,
]

const usageBlockingPatterns = [
  /can't use/i,
  /won't close/i,
  /won't latch/i,
  /won't stay/i,
  /can't attach/i,
  /missing piece/i,
  /missing trim/i,
  /broken clip/i,
  /snapped clip/i,
  /loose panel/i,
  /need a bracket/i,
  /custom mount/i,
]

const simplePartPatterns = [
  /\bclip\b/i,
  /\bbracket\b/i,
  /\bcover\b/i,
  /\bknob\b/i,
  /\bhandle\b/i,
  /\btrim\b/i,
  /\blatch\b/i,
  /\bpanel\b/i,
  /\bhousing\b/i,
  /\bmount\b/i,
  /\btab\b/i,
  /\bvent\b/i,
  /\badapter\b/i,
]

const internalElectricalPatterns = [
  /\bmotor\b/i,
  /\bcircuit\b/i,
  /\bpcb\b/i,
  /\bsensor\b/i,
  /\bengine\b/i,
  /\bgearbox\b/i,
  /\btransmission\b/i,
  /\becu\b/i,
  /\bwiring\b/i,
  /\bbattery\b/i,
  /\balternator\b/i,
  /\belectrical issue\b/i,
  /\binternal\b/i,
]

const lowValuePatterns = [
  /\bkettle\b/i,
  /\btoy\b/i,
  /\bcheap\b/i,
  /\bremote\b/i,
]

const multiUserPatterns = [
  /\banyone else\b/i,
  /\bmultiple people\b/i,
  /\bgroup buy\b/i,
  /\bwe need\b/i,
]

const showcasePatterns = [
  /\bfixed\b/i,
  /\bsolved\b/i,
  /\bbefore and after\b/i,
  /\bfinally done\b/i,
  /\bshowcase\b/i,
]

const noIntentPatterns = [
  /\bany ideas\b/i,
  /\bwhat is this\b/i,
  /\bjust curious\b/i,
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

  if (automotiveContextPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 3
    reasons.push('automotive context')
  }

  if (unavailablePatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 3
    reasons.push('unavailable/discontinued')
  }

  if (usageBlockingPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 2
    reasons.push('blocks usage')
  }

  if (automotivePartPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 3
    reasons.push('automotive part')
  }

  if (simplePartPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 2
    reasons.push('simple manufacturable geometry')
  }

  if (multiUserPatterns.some((pattern) => pattern.test(haystack))) {
    value_score += 1
    reasons.push('multiple users same issue')
  }

  if (showcasePatterns.some((pattern) => pattern.test(haystack))) {
    value_score -= 3
    reasons.push('already solved/showcase')
  }

  if (noIntentPatterns.some((pattern) => pattern.test(haystack))) {
    value_score -= 2
    reasons.push('no clear intent')
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
