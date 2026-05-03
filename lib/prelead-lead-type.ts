export type PreleadLeadType =
  | "unavailable_replacement"
  | "needs_cad_or_stl"
  | "custom_fabrication_request"
  | "workaround_or_bodge"
  | "group_buy_candidate"
  | "showcase_not_lead"
  | "not_relevant";

const GROUP_BUY_PATTERNS = [
  /\bgroup buy\b/i,
  /\bbulk order\b/i,
  /\banyone else (?:interested|need|want)\b/i,
  /\bmultiple people\b/i,
  /\bshared demand\b/i,
  /\bwe need\b/i,
  /\bseveral of us\b/i,
];

const SHOWCASE_PATTERNS = [
  /\bfixed\b/i,
  /\bsolved\b/i,
  /\bupdated\b/i,
  /\bbefore and after\b/i,
  /\bfinally done\b/i,
  /\bshowcase\b/i,
  /\blook what i built\b/i,
  /\bi made this\b/i,
];

const CAD_PATTERNS = [
  /\bstl\b/i,
  /\bcad\b/i,
  /\b3d model\b/i,
  /\b3d print\b/i,
  /\bcan someone model\b/i,
  /\bneed a cad file\b/i,
  /\bneed an stl\b/i,
  /\blooking for stl\b/i,
  /\bscan this\b/i,
];

const UNAVAILABLE_PATTERNS = [
  /\bnla\b/i,
  /\bdiscontinued\b/i,
  /\bdealer unavailable\b/i,
  /\bcan'?t find this part\b/i,
  /\bcannot find this part\b/i,
  /\bno longer available\b/i,
  /\bout of stock\b/i,
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
];

const BODGE_PATTERNS = [
  /\bworkaround\b/i,
  /\bbodge\b/i,
  /\badapter\b/i,
  /\bshim\b/i,
  /\bspacer\b/i,
  /\bconvert(?:ion)?\b/i,
  /\bfitting .* into .*\b/i,
];

const NOT_RELEVANT_PATTERNS = [
  /\bengine\b/i,
  /\bgearbox\b/i,
  /\becu\b/i,
  /\bwiring\b/i,
  /\bdiagnos/i,
  /\bwon'?t start\b/i,
  /\bbuying advice\b/i,
  /\binsurance\b/i,
  /\bwrite off\b/i,
];

function clean(text: string) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function hasAny(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyLeadType(text: string): PreleadLeadType {
  const haystack = clean(text);

  if (!haystack) return "not_relevant";
  if (hasAny(SHOWCASE_PATTERNS, haystack)) return "showcase_not_lead";
  if (hasAny(GROUP_BUY_PATTERNS, haystack)) return "group_buy_candidate";
  if (hasAny(UNAVAILABLE_PATTERNS, haystack)) return "unavailable_replacement";
  if (hasAny(CAD_PATTERNS, haystack)) return "needs_cad_or_stl";
  if (hasAny(FABRICATION_PATTERNS, haystack)) return "custom_fabrication_request";
  if (hasAny(BODGE_PATTERNS, haystack)) return "workaround_or_bodge";
  if (hasAny(NOT_RELEVANT_PATTERNS, haystack)) return "not_relevant";

  if (/\b(car|vehicle|auto|automotive|interior|trim|bracket|mount|clip|cover|panel|vent|knob|latch)\b/i.test(haystack)) {
    return "unavailable_replacement";
  }

  return "not_relevant";
}
