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
  '-"won\'t start"',
  '-"buying advice"',
  '-"how much"',
  '-"insurance"',
  '-"write off"',
] as const;

export const DISCOVERY_USER_PHRASES = [
  'broken part',
  'broke plastic',
  "can't find part",
  'missing part',
  'broken trim',
  'missing clip',
  'plastic broke',
  'part snapped',
] as const;

export const DISCOVERY_CAR_CONTEXTS = ['car', 'car interior', 'car trim'] as const;

export const DISCOVERY_PRIORITY_MODELS = ['mx5', 'bmw e46', 'vw golf mk5', 'land rover defender'] as const;

const NEGATIVE_SUFFIX = DISCOVERY_NEGATIVE_FILTERS.join(' ');

function cleanText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function appendNegativeFilters(query: string) {
  return cleanText(`${query} ${NEGATIVE_SUFFIX}`).replace(/\s+/g, ' ');
}

function modelVariantQuery(model: string, phrase: string) {
  return appendNegativeFilters(`site:reddit.com ${model} ${phrase}`);
}

export function buildDiscoverySearchTemplates(): { core: DiscoveryQueryTemplate[]; rotating: DiscoveryQueryTemplate[] } {
  const core = [
    appendNegativeFilters('site:reddit.com broken part car'),
    appendNegativeFilters('site:reddit.com broke plastic car'),
    appendNegativeFilters('site:reddit.com missing clip car interior'),
    appendNegativeFilters('site:reddit.com can\'t find part car'),
    appendNegativeFilters('site:reddit.com broken trim car'),
    modelVariantQuery('mx5', 'broken part'),
    modelVariantQuery('bmw e46', 'broken part'),
    modelVariantQuery('vw golf mk5', 'broken trim'),
  ].map((query) => ({ kind: 'core' as const, recency: 'week' as const, query }));

  const rotating: DiscoveryQueryTemplate[] = [];

  return { core, rotating };
}

export function buildRedditSearchQueries() {
  const queries = [
    'broken part car',
    'broke plastic car',
    'missing clip car interior',
    "can't find part car",
    'broken trim car',
    'mx5 broken part',
    'bmw e46 broken part',
    'vw golf mk5 broken trim',
    'land rover defender broken part',
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
  return appendNegativeFilters(`site:reddit.com ${parts.join(' ')}`);
}

export function buildRecommendedDiscoveryQueries(winningPatterns: { query: string; group_name?: string }[]): DiscoveryQueryRecommendation[] {
  const seeds = buildPhraseSeeds(winningPatterns);
  const recommendations = new Map<string, string>();

  for (const phrase of DISCOVERY_USER_PHRASES) {
    for (const context of DISCOVERY_CAR_CONTEXTS) {
      const query = buildBroadQuery([phrase, context]);
      recommendations.set(query, `Broad natural-language phrasing: ${phrase} with ${context}.`);
      if (recommendations.size >= 8) break;
    }
    if (recommendations.size >= 8) break;
  }

  for (const seed of seeds) {
    for (const model of DISCOVERY_PRIORITY_MODELS) {
      const context = seed.includes(' ') ? seed : `${seed} part`;
      const query = buildBroadQuery([model, context]);
      recommendations.set(query, `Derived from winning phrasing ${seed} and focused on priority model ${model}.`);
      if (recommendations.size >= 10) break;
    }
    if (recommendations.size >= 10) break;
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
