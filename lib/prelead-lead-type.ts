export type PreleadLeadType =
  | 'unavailable_replacement'
  | 'needs_cad_or_stl'
  | 'custom_fabrication_request'
  | 'workaround_or_bodge'
  | 'group_buy_candidate'
  | 'generic_broken_part'
  | 'showcase_not_lead'
  | 'not_relevant';

export type LeadSignalProfile = {
  supply_gap_signal: boolean;
  cad_or_stl_need: boolean;
  fabrication_request: boolean;
  manufacturable_part_signal: boolean;
  unresolved_need_signal: boolean;
  workaround_signal: boolean;
  repeated_demand_signal: boolean;
  showcase_signal: boolean;
  generic_broken_signal: boolean;
};

const SHOWCASE_PATTERNS = [
  /\bfixed\b/i,
  /\bsolved\b/i,
  /\bupdated\b/i,
  /\bbefore and after\b/i,
  /\bfinally done\b/i,
  /\bshowcase\b/i,
  /\blook what i built\b/i,
  /\bi made this\b/i,
  /\binstalled\b/i,
  /\bdone\b/i,
  /\bhappy with\b/i,
  /\binterior update\b/i,
  /\bcompleted\b/i,
  /\bproject complete\b/i,
];

const SUPPLY_GAP_PATTERNS = [
  /\bdiscontinued\b/i,
  /\bno longer available\b/i,
  /\bnla\b/i,
  /\bdealer can(?:'|’)t get\b/i,
  /\bdealer cannot supply\b/i,
  /\boem unavailable\b/i,
  /\bbackorder forever\b/i,
  /\bunavailable anywhere\b/i,
  /\bcan(?:'|’)t find anywhere\b/i,
  /\bcan(?:'|’)t find this part\b/i,
  /\bdoes anyone sell this\b/i,
  /\bwhere can i get this\b/i,
  /\bneed replacement\b/i,
  /\blooking for replacement\b/i,
];

const CAD_PATTERNS = [
  /\banyone have an stl\b/i,
  /\blooking for stl\b/i,
  /\bneed a cad file\b/i,
  /\banyone got a 3d model\b/i,
  /\bcan someone model this\b/i,
  /\b3d scan this part\b/i,
  /\bcould this be 3d printed\b/i,
  /\bthinking of printing this\b/i,
  /\bstl\b/i,
  /\bcad\b/i,
  /\b3d model\b/i,
  /\b3d print\b/i,
];

const FABRICATION_PATTERNS = [
  /\bcustom fabricate\b/i,
  /\bfabricate\b/i,
  /\bcnc\b/i,
  /\bmachine\b/i,
  /\bmachine shop\b/i,
  /\bmake a bracket\b/i,
  /\bneed a bracket\b/i,
  /\bcustom bracket\b/i,
  /\bcustom mount\b/i,
  /\badapter for\b/i,
  /\bfit(?:ting)?\s+.*\s+into\s+.*\b/i,
  /\bswap\b/i,
  /\bretrofit\b/i,
  /\bsmall batch\b/i,
  /\breproduction part\b/i,
];

const BODGE_PATTERNS = [
  /\bglued it\b/i,
  /\btemporary fix\b/i,
  /\bbodge\b/i,
  /\bzip tied\b/i,
  /\bpatched\b/i,
  /\brepaired it but\b/i,
  /\btried ebay\b/i,
  /\btried junkyard\b/i,
  /\btried breaker\b/i,
  /\bcouldn(?:'|’)t source\b/i,
  /\bworkaround\b/i,
  /\badapter\b/i,
  /\bshim\b/i,
  /\bspacer\b/i,
  /\bconvert(?:ion)?\b/i,
];

const REPEATED_PATTERNS = [
  /\bsame issue\b/i,
  /\bme too\b/i,
  /\bi need one\b/i,
  /\bgroup buy\b/i,
  /\bsmall batch\b/i,
  /\breproduction part\b/i,
  /\bmultiple users?\b/i,
  /\banyone else\b/i,
];

const MANUFACTURABLE_PART_PATTERNS = [
  /\bclip\b/i,
  /\btab\b/i,
  /\bbracket\b/i,
  /\bmount\b/i,
  /\btrim\b/i,
  /\bcover\b/i,
  /\bretainer\b/i,
  /\bhinge\b/i,
  /\bspacer\b/i,
  /\badapter\b/i,
  /\bknob\b/i,
  /\bvent\b/i,
  /\bsurround\b/i,
  /\bpanel\b/i,
  /\bhousing\b/i,
  /\bclip broke\b/i,
  /\btab snapped\b/i,
  /\bplastic broke\b/i,
  /\btrim broke\b/i,
  /\bmissing piece\b/i,
  /\bcar trim\b/i,
  /\binterior trim\b/i,
];

const GENERIC_BROKEN_PATTERNS = [
  /\bbroken\b/i,
  /\bbroke\b/i,
  /\bsnapped\b/i,
  /\bcracked\b/i,
  /\bmissing\b/i,
  /\blost\b/i,
];

const NOISE_PATTERNS = [
  /\bengine\b/i,
  /\bgearbox\b/i,
  /\becu\b/i,
  /\bsensor\b/i,
  /\bwiring\b/i,
  /\bdiagnos/i,
  /\bwon'?t start\b/i,
  /\binsurance\b/i,
  /\bwrite off\b/i,
  /\bbuying advice\b/i,
  /\bperformance tune\b/i,
];

function clean(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function hasAny(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function leadSignalProfile(text: string): LeadSignalProfile {
  const haystack = clean(text);
  return {
    supply_gap_signal: hasAny(SUPPLY_GAP_PATTERNS, haystack),
    cad_or_stl_need: hasAny(CAD_PATTERNS, haystack),
    fabrication_request: hasAny(FABRICATION_PATTERNS, haystack),
    manufacturable_part_signal: hasAny(MANUFACTURABLE_PART_PATTERNS, haystack),
    unresolved_need_signal: /\bneed\b/i.test(haystack) || /\blooking for\b/i.test(haystack) || /\bcan't find\b/i.test(haystack) || /\bwhere can i get\b/i.test(haystack),
    workaround_signal: hasAny(BODGE_PATTERNS, haystack),
    repeated_demand_signal: hasAny(REPEATED_PATTERNS, haystack),
    showcase_signal: hasAny(SHOWCASE_PATTERNS, haystack),
    generic_broken_signal: hasAny(GENERIC_BROKEN_PATTERNS, haystack) && !hasAny(SUPPLY_GAP_PATTERNS, haystack) && !hasAny(CAD_PATTERNS, haystack) && !hasAny(FABRICATION_PATTERNS, haystack) && !hasAny(BODGE_PATTERNS, haystack),
  };
}

export function classifyLeadType(text: string): PreleadLeadType {
  const profile = leadSignalProfile(text);
  const haystack = clean(text);

  if (!haystack) return 'not_relevant';
  if (hasAny(NOISE_PATTERNS, haystack)) return 'not_relevant';
  if (profile.showcase_signal) return 'showcase_not_lead';
  if (profile.supply_gap_signal && profile.cad_or_stl_need) return 'needs_cad_or_stl';
  if (profile.supply_gap_signal) return 'unavailable_replacement';
  if (profile.cad_or_stl_need) return 'needs_cad_or_stl';
  if (profile.fabrication_request && profile.repeated_demand_signal) return 'group_buy_candidate';
  if (profile.fabrication_request) return 'custom_fabrication_request';
  if (profile.workaround_signal) return 'workaround_or_bodge';
  if (profile.repeated_demand_signal) return 'group_buy_candidate';
  if (profile.generic_broken_signal) return 'generic_broken_part';
  if (/\b(car|vehicle|auto|automotive|interior|trim|bracket|mount|clip|cover|panel|vent|knob|latch|surround)\b/i.test(haystack)) {
    return 'generic_broken_part';
  }
  return 'not_relevant';
}
