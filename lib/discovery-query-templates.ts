export type DiscoveryQueryKind = "core" | "rotating";
export type DiscoverySearchRecency = "day" | "week" | "month" | "any";

export type DiscoveryQueryTemplate = {
  query: string;
  recency: DiscoverySearchRecency;
  kind: DiscoveryQueryKind;
};

export type DiscoveryQueryRecommendation = {
  query: string;
  reason: string;
};

export const DISCOVERY_NEGATIVE_FILTERS = [
  '-engine',
  '-gearbox',
  '-sensor',
  '-ECU',
  '-wiring',
  '-diagnostics',
  '-"won\'t start"',
  '-"buying advice"',
  '-"how much"',
  '-"insurance"',
  '-"write off"',
  '-performance',
] as const;

export const DISCOVERY_USER_PHRASES = [
  'clip broke',
  'tab snapped',
  'plastic broke',
  'trim broke',
  'missing piece',
  'can\'t find this part',
  'what is this part called',
  'need a bracket',
  'custom mount',
  'adapter for',
  'does anyone have an STL',
  'need a CAD file',
] as const;

export const DISCOVERY_CAR_CONTEXTS = ['car', 'car interior', 'car trim', 'automotive'] as const;

export const DISCOVERY_PRIORITY_MODELS = ['mx5', 'bmw e46', 'vw golf mk4', 'land rover defender'] as const;

const NEGATIVE_SUFFIX = DISCOVERY_NEGATIVE_FILTERS.join(' ');

function cleanText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function appendNegativeFilters(query: string) {
  return cleanText(`${query} ${NEGATIVE_SUFFIX}`).replace(/\s+/g, ' ');
}

function dedupeWords(query: string) {
  const seen = new Set<string>();
  return cleanText(query)
    .split(/\s+/)
    .filter((token) => {
      const normalized = token.toLowerCase();
      if (!normalized) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(' ');
}

function makeQuery(parts: string[]) {
  return appendNegativeFilters(dedupeWords(`site:reddit.com ${parts.join(' ')}`));
}

function closeSemanticVariants(seed: string) {
  const phrases = [seed];
  const lower = seed.toLowerCase();

  if (/trim|clip|tab|plastic/.test(lower)) {
    phrases.push('broken interior trim car', 'broken door trim car', 'cracked dashboard trim car', 'broken plastic part car');
  }

  if (/bracket|mount|adapter/.test(lower)) {
    phrases.push('custom bracket car', 'need a bracket car', 'custom mount car', 'adapter for car part');
  }

  if (/stl|cad|3d/.test(lower)) {
    phrases.push('looking for STL car', 'need a CAD file car', '3D print this part car', 'can someone model this car part');
  }

  if (/cannot find|can't find|missing piece/.test(lower)) {
    phrases.push("can't find this part car", 'missing car trim piece', 'unavailable car replacement part');
  }

  return [...new Set(phrases.map((value) => dedupeWords(value)))].filter(Boolean).slice(0, 8);
}

export function buildDiscoverySearchTemplates(): { core: DiscoveryQueryTemplate[]; rotating: DiscoveryQueryTemplate[] } {
  const core = [
    makeQuery(['"clip broke"', 'car']),
    makeQuery(['"tab snapped"', 'car interior']),
    makeQuery(['"plastic broke"', 'trim', 'car']),
    makeQuery(['"missing piece"', 'car trim']),
    makeQuery(["can't find this part", 'car']),
    makeQuery(['"what is this part called"', 'car']),
    makeQuery(['"need a bracket"', 'car']),
    makeQuery(['"does anyone have an STL"', 'car']),
    makeQuery(['"need a CAD file"', 'car']),
    makeQuery(['"3D print this part"', 'car trim']),
  ].map((query) => ({ kind: 'core' as const, recency: 'week' as const, query }));

  const rotating = [
    makeQuery(['"custom mount"', 'car']),
    makeQuery(['"adapter for"', 'car']),
    makeQuery(['"does anyone have an STL"', 'car interior']),
    makeQuery(['"need a CAD file"', 'automotive']),
    makeQuery(['"custom bracket"', 'car']),
    makeQuery(['"missing piece"', 'car interior']),
  ].map((query) => ({ kind: 'rotating' as const, recency: 'month' as const, query }));

  return { core, rotating };
}

export function buildRedditSearchQueries() {
  const queries = [
    'clip broke car',
    'tab snapped car',
    'plastic broke trim car',
    'missing piece car interior',
    "can't find this part car",
    'what is this part called car',
    'need a bracket car',
    'custom mount car',
    'does anyone have an STL car',
    'need a CAD file car',
  ];

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 12);
}

function extractQuotedPhrases(query: string) {
  return [...query.matchAll(/"([^"\n]{3,80})"/g)].map((match) => match[1].trim()).filter(Boolean);
}

function normalizePhrase(phrase: string) {
  return phrase
    .toLowerCase()
    .replace(/\b(replacement|part|parts|quote|quote\?|need|needs|need\s+replacement|car|vehicle|ford|bmw|audi|vw|golf|mini|mx5|trim|interior|clip)\b/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildPhraseSeeds(winningPatterns: { query: string }[]) {
  const seeds = winningPatterns.flatMap((pattern) => {
    const quoted = extractQuotedPhrases(pattern.query).map(normalizePhrase);
    if (quoted.length > 0) {
      return quoted;
    }

    return [normalizePhrase(pattern.query)];
  });

  const filtered = seeds.filter((phrase) => {
    if (!phrase) return false;
    if (phrase.length < 4) return false;
    if (/\b(engine|gearbox|sensor|ecu|wiring|repair|buying advice|how much|insurance|write off)\b/i.test(phrase)) return false;
    return true;
  });

  return uniqueNonEmpty(filtered).slice(0, 6);
}

function buildBroadQuery(parts: string[]) {
  return appendNegativeFilters(dedupeWords(`site:reddit.com ${parts.join(' ')}`));
}

export function buildRecommendedDiscoveryQueries(winningPatterns: { query: string; group_name?: string }[]): DiscoveryQueryRecommendation[] {
  const seeds = buildPhraseSeeds(winningPatterns);
  const recommendations = new Map<string, string>();

  for (const seed of seeds) {
    for (const variant of closeSemanticVariants(seed)) {
      const query = buildBroadQuery([variant]);
      recommendations.set(query, `Close semantic variant of winning phrasing: ${variant}.`);
      if (recommendations.size >= 8) break;
    }
    if (recommendations.size >= 8) break;
  }

  if (recommendations.size < 8) {
    for (const model of DISCOVERY_PRIORITY_MODELS) {
      for (const phrase of DISCOVERY_USER_PHRASES) {
        const query = buildBroadQuery([model, phrase]);
        recommendations.set(query, `Priority model ${model} with natural phrasing ${phrase}.`);
        if (recommendations.size >= 8) break;
      }
      if (recommendations.size >= 8) break;
    }
  }

  return [...recommendations.entries()].slice(0, 10).map(([query, reason]) => ({ query, reason }));
}
