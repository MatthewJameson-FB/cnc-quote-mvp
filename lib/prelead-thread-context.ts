export type ThreadContextSummary = {
  already_solved: boolean;
  mentions_stl: boolean;
  mentions_measurements: boolean;
  suggested_repair: boolean;
  still_unsolved: boolean;
};

const solvedPatterns = [
  /\bsolved\b/i,
  /\bsorted\b/i,
  /\bfixed\b/i,
  /\bresolved\b/i,
  /\bworking now\b/i,
  /\bgot it working\b/i,
  /\bfound (?:the )?solution\b/i,
  /\bthanks(?:,|!)? (?:all|everyone)\b/i,
];

const stlPatterns = [
  /\bstl\b/i,
  /\bstp\b/i,
  /\bstep\b/i,
  /\bcad\b/i,
  /\bdxf\b/i,
  /\bdwg\b/i,
  /\bsolidworks\b/i,
  /\bfusion 360\b/i,
  /\bmodel file\b/i,
];

const measurementPatterns = [
  /\b\d+(?:\.\d+)?\s?(?:mm|millimeters?|cm|centimeters?|m|meters?|in|inch(?:es)?|"|')\b/i,
  /\b(?:diameter|radius|length|width|height|depth|thickness|tolerance|size|measurements?)\b/i,
  /\brough measurement\b/i,
  /\bmeasure(?:ment)?s?\b/i,
];

const repairPatterns = [
  /\brepair\b/i,
  /\brepaired\b/i,
  /\bfix\b/i,
  /\bfixed\b/i,
  /\bmend\b/i,
  /\brestore\b/i,
  /\bweld\b/i,
  /\bglue\b/i,
  /\bepoxy\b/i,
  /\bpatch\b/i,
  /\breplace\b/i,
  /\brefit\b/i,
];

const unsolvedPatterns = [
  /\bstill (?:need|looking|trying)\b/i,
  /\bany ideas\b/i,
  /\bany suggestions\b/i,
  /\bdoes anyone know\b/i,
  /\bhelp(?: me)?\b/i,
  /\bnot solved\b/i,
  /\bno solution\b/i,
  /\bunsure\b/i,
  /\bcan'?t find\b/i,
  /\blooking for\b/i,
];

function hasPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function summarizeThreadContext(text: string): ThreadContextSummary {
  const normalized = text.trim() || "";
  const alreadySolved = hasPattern(normalized, solvedPatterns);
  return {
    already_solved: alreadySolved,
    mentions_stl: hasPattern(normalized, stlPatterns),
    mentions_measurements: hasPattern(normalized, measurementPatterns),
    suggested_repair: hasPattern(normalized, repairPatterns),
    still_unsolved: !alreadySolved && hasPattern(normalized, unsolvedPatterns),
  };
}

export function formatThreadContextSummary(summary: ThreadContextSummary | null | undefined) {
  if (!summary) return "none";

  return [
    `already_solved=${summary.already_solved ? "true" : "false"}`,
    `mentions_stl=${summary.mentions_stl ? "true" : "false"}`,
    `mentions_measurements=${summary.mentions_measurements ? "true" : "false"}`,
    `suggested_repair=${summary.suggested_repair ? "true" : "false"}`,
    `still_unsolved=${summary.still_unsolved ? "true" : "false"}`,
  ].join(", ");
}
