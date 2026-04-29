export type LocationSignal = "uk" | "unknown" | "outside_uk";

export type LocationInferenceCandidate = {
  title: string;
  snippet: string;
  source_url: string;
};

export type LocationInferenceResult = {
  location_signal: LocationSignal;
  location_confidence: number;
  location_reasons: string[];
};

const UK_TEXT_PATTERNS = [
  { label: "text:uk", pattern: /\bUK\b/i },
  { label: "text:united_kingdom", pattern: /\bUnited Kingdom\b/i },
  { label: "text:britain", pattern: /\bBritain\b/i },
  { label: "text:british", pattern: /\bBritish\b/i },
  { label: "text:england", pattern: /\bEngland\b/i },
  { label: "text:scotland", pattern: /\bScotland\b/i },
  { label: "text:wales", pattern: /\bWales\b/i },
  { label: "text:northern_ireland", pattern: /\bNorthern Ireland\b/i },
  { label: "text:london", pattern: /\bLondon\b/i },
  { label: "text:manchester", pattern: /\bManchester\b/i },
  { label: "text:birmingham", pattern: /\bBirmingham\b/i },
  { label: "text:leeds", pattern: /\bLeeds\b/i },
  { label: "text:liverpool", pattern: /\bLiverpool\b/i },
  { label: "text:bristol", pattern: /\bBristol\b/i },
  { label: "text:sheffield", pattern: /\bSheffield\b/i },
  { label: "text:glasgow", pattern: /\bGlasgow\b/i },
  { label: "text:edinburgh", pattern: /\bEdinburgh\b/i },
  { label: "text:cardiff", pattern: /\bCardiff\b/i },
  { label: "text:belfast", pattern: /\bBelfast\b/i },
  { label: "text:midlands", pattern: /\bMidlands\b/i },
  { label: "text:yorkshire", pattern: /\bYorkshire\b/i },
  { label: "text:surrey", pattern: /\bSurrey\b/i },
  { label: "text:kent", pattern: /\bKent\b/i },
  { label: "text:essex", pattern: /\bEssex\b/i },
  { label: "currency:gbp", pattern: /£|\bGBP\b|\bquid\b|\bpence\b/i },
  { label: "spelling:aluminium", pattern: /\baluminium\b/i },
  { label: "spelling:colour", pattern: /\bcolour\b/i },
  { label: "spelling:customisation", pattern: /\bcustomisation\b/i },
  { label: "spelling:centre", pattern: /\bcentre\b/i },
  { label: "spelling:metre", pattern: /\bmetre\b/i },
  { label: "spelling:tyre", pattern: /\btyre\b/i },
  { label: "spelling:mould", pattern: /\bmould\b/i },
];

const OUTSIDE_TEXT_PATTERNS = [
  { label: "text:usa", pattern: /\bUSA\b/i },
  { label: "text:united_states", pattern: /\bUnited States\b/i },
  { label: "text:america", pattern: /\bAmerica\b/i },
  { label: "text:canada", pattern: /\bCanada\b/i },
  { label: "text:australia", pattern: /\bAustralia\b/i },
  { label: "text:new_zealand", pattern: /\bNew Zealand\b/i },
  { label: "text:eurozone", pattern: /\bEU\b|\bEUR\b/i },
  { label: "text:ireland", pattern: /(?<!Northern )\bIreland\b/i },
  { label: "text:dublin", pattern: /\bDublin\b/i },
  { label: "text:us_states", pattern: /\bCalifornia\b|\bTexas\b|\bNew York\b/i },
];

const OUTSIDE_CURRENCY_PATTERNS = [
  { label: "currency:usd", pattern: /\$|\bUSD\b/i },
  { label: "currency:cad", pattern: /\bCAD\b/i },
  { label: "currency:aud", pattern: /\bAUD\b/i },
  { label: "currency:eur", pattern: /€|\bEUR\b/i },
  { label: "currency:nzd", pattern: /\bNZD\b/i },
];

const OUTSIDE_SUBREDDIT_PATTERNS = [
  { label: "subreddit:askanamerican", pattern: /\br\/AskAnAmerican\b/i },
  { label: "subreddit:personalfinancecanada", pattern: /\br\/PersonalFinanceCanada\b/i },
  { label: "subreddit:ireland", pattern: /\br\/(?:Ireland|AskIreland)\b/i },
  { label: "subreddit:aus", pattern: /\br\/Aus[A-Za-z0-9_]+\b/i },
];

const ENGLISH_STOPWORDS = [
  "the",
  "and",
  "for",
  "with",
  "need",
  "quote",
  "part",
  "help",
  "please",
  "looking",
  "can",
  "have",
  "from",
  "that",
  "this",
  "are",
  "is",
  "to",
  "of",
  "in",
  "on",
  "a",
  "an",
  "we",
  "you",
];

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function extractHostAndPath(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl);
    return {
      hostname: parsed.hostname.toLowerCase(),
      pathname: parsed.pathname.toLowerCase(),
      href: parsed.href.toLowerCase(),
    };
  } catch {
    return { hostname: "", pathname: "", href: sourceUrl.toLowerCase() };
  }
}

function collectMatches(text: string, entries: Array<{ label: string; pattern: RegExp }>) {
  const matches: string[] = [];
  for (const entry of entries) {
    if (entry.pattern.test(text)) {
      matches.push(entry.label);
    }
  }
  return uniq(matches);
}

function getSubredditReasons(sourceUrl: string) {
  const { pathname } = extractHostAndPath(sourceUrl);
  const reasons: string[] = [];
  const match = pathname.match(/\/r\/([^/?#]+)/i);
  const subreddit = match?.[1]?.toLowerCase() ?? "";

  if (subreddit === "askuk") reasons.push("subreddit:askuk");
  if (subreddit === "diyuk") reasons.push("subreddit:diyuk");
  if (subreddit === "cartalkuk") reasons.push("subreddit:cartalkuk");
  if (subreddit === "motouk") reasons.push("subreddit:motouk");
  if (subreddit === "legaladviceuk") reasons.push("subreddit:legaladviceuk");
  if (subreddit.startsWith("aus")) reasons.push("subreddit:aus");
  if (subreddit === "askanamerican") reasons.push("subreddit:askanamerican");
  if (subreddit === "personalfinancecanada") reasons.push("subreddit:personalfinancecanada");
  if (subreddit === "ireland" || subreddit === "askireland") reasons.push(`subreddit:${subreddit}`);

  return reasons;
}

function getDomainReasons(sourceUrl: string) {
  const { hostname } = extractHostAndPath(sourceUrl);
  const reasons: string[] = [];

  if (hostname.endsWith(".co.uk")) reasons.push("domain:co.uk");
  if (hostname.endsWith(".uk") && !hostname.endsWith(".co.uk")) reasons.push("domain:uk");

  return reasons;
}

function detectEnglish(text: string) {
  const words: string[] = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = ENGLISH_STOPWORDS.filter((word) => words.includes(word));
  return hits.length >= 2;
}

function detectNonEnglish(text: string) {
  if (/[¿¡áéíóúñçàèìòùäöüß]/i.test(text)) {
    return true;
  }

  const lower = text.toLowerCase();
  return /\b(hola|bonjour|merci|gracias|danke|ciao|salut)\b/i.test(lower);
}

function scoreSignalCount(count: number, base: number, cap: number) {
  return clamp(count * base, 0, cap);
}

export function inferLocationSignal(candidate: LocationInferenceCandidate): LocationInferenceResult {
  const text = `${candidate.title} ${candidate.snippet}`.trim();
  const sourceUrl = candidate.source_url ?? "";
  const reasons: string[] = [];

  const ukTextReasons = collectMatches(text, UK_TEXT_PATTERNS);
  const ukDomainReasons = getDomainReasons(sourceUrl);
  const ukSubredditReasons = getSubredditReasons(sourceUrl).filter((reason) => reason.startsWith("subreddit:"));
  const outsideTextReasons = collectMatches(text, OUTSIDE_TEXT_PATTERNS);
  const outsideCurrencyReasons = collectMatches(text, OUTSIDE_CURRENCY_PATTERNS);
  const outsideSubredditReasons = collectMatches(`${text} ${sourceUrl}`, OUTSIDE_SUBREDDIT_PATTERNS);

  const hasStrongUkCurrency = ukTextReasons.includes("currency:gbp");
  const hasStrongUkDomain = ukDomainReasons.some((reason) => reason === "domain:co.uk" || reason === "domain:uk");
  const hasStrongUkSubreddit = ukSubredditReasons.some((reason) => ["subreddit:askuk", "subreddit:diyuk", "subreddit:cartalkuk", "subreddit:motouk", "subreddit:legaladviceuk"].includes(reason));
  const hasStrongUkText = ukTextReasons.some((reason) => [
    "text:uk",
    "text:united_kingdom",
    "text:britain",
    "text:british",
    "text:england",
    "text:scotland",
    "text:wales",
    "text:northern_ireland",
    "text:london",
    "text:manchester",
    "text:birmingham",
    "text:leeds",
    "text:liverpool",
    "text:bristol",
    "text:sheffield",
    "text:glasgow",
    "text:edinburgh",
    "text:cardiff",
    "text:belfast",
  ].includes(reason));
  const hasUkSpelling = ukTextReasons.some((reason) => reason.startsWith("spelling:"));

  const hasStrongOutsideCurrency = outsideCurrencyReasons.some((reason) => ["currency:eur", "currency:cad", "currency:aud", "currency:nzd"].includes(reason));
  const hasStrongOutsideText = outsideTextReasons.some((reason) => [
    "text:usa",
    "text:united_states",
    "text:canada",
    "text:australia",
    "text:new_zealand",
    "text:dublin",
    "text:ireland",
    "text:us_states",
  ].includes(reason));
  const hasStrongOutsideSubreddit = outsideSubredditReasons.some((reason) =>
    ["subreddit:askanamerican", "subreddit:personalfinancecanada", "subreddit:ireland", "subreddit:askireland", "subreddit:aus"].includes(reason)
  );
  const hasStrongOutside = hasStrongOutsideCurrency || hasStrongOutsideText || hasStrongOutsideSubreddit;
  const hasStrongUk = hasStrongUkCurrency || hasStrongUkDomain || hasStrongUkSubreddit || hasStrongUkText;

  reasons.push(...ukTextReasons, ...ukDomainReasons, ...ukSubredditReasons, ...outsideCurrencyReasons, ...outsideTextReasons, ...outsideSubredditReasons);

  const english = detectEnglish(text);
  const nonEnglish = detectNonEnglish(text);
  if (english) reasons.push("language:english");
  if (nonEnglish) reasons.push("language:non_english");

  const explicitIreland = outsideTextReasons.includes("text:ireland") || outsideTextReasons.includes("text:dublin");
  const explicitEurope = outsideTextReasons.includes("text:eurozone");

  const conflict = hasStrongUk && hasStrongOutside;

  if (conflict) {
    return {
      location_signal: "unknown",
      location_confidence: 0.55,
      location_reasons: uniq(["conflict:uk_vs_non_uk", ...reasons]),
    };
  }

  if (hasStrongUk) {
    let confidence = 0.78;
    if (hasStrongUkCurrency) confidence = 0.95;
    if (hasStrongUkDomain || hasStrongUkSubreddit) confidence = Math.max(confidence, 0.94);
    confidence += scoreSignalCount(ukTextReasons.length - (hasStrongUkCurrency ? 1 : 0), 0.02, 0.08);
    if (hasUkSpelling) confidence += 0.03;
    if (hasStrongOutsideCurrency && !hasStrongOutsideText && !hasStrongOutsideSubreddit) confidence -= 0.12;

    return {
      location_signal: "uk",
      location_confidence: clamp(confidence, 0.7, 0.99),
      location_reasons: uniq(reasons),
    };
  }

  if (hasStrongOutside) {
    let confidence = 0.8;
    if (hasStrongOutsideCurrency) confidence = 0.93;
    if (explicitIreland || explicitEurope) confidence = 0.95;
    confidence += scoreSignalCount(outsideTextReasons.length + outsideCurrencyReasons.length + outsideSubredditReasons.length - 1, 0.02, 0.08);

    return {
      location_signal: "outside_uk",
      location_confidence: clamp(confidence, 0.75, 0.99),
      location_reasons: uniq(reasons),
    };
  }

  let confidence = 0.42;
  if (english) {
    confidence = 0.48;
  }
  if (nonEnglish) {
    confidence = 0.32;
  }
  if (outsideCurrencyReasons.includes("currency:usd")) {
    confidence = 0.38; // $ alone should only lower confidence.
  }
  if (outsideCurrencyReasons.includes("currency:usd") && /\bUSA\b|\bUnited States\b/i.test(text)) {
    confidence = 0.85;
    return {
      location_signal: "outside_uk",
      location_confidence: clamp(confidence, 0.75, 0.99),
      location_reasons: uniq(reasons),
    };
  }

  if (explicitIreland || explicitEurope) {
    return {
      location_signal: "outside_uk",
      location_confidence: 0.86,
      location_reasons: uniq(reasons),
    };
  }

  return {
    location_signal: "unknown",
    location_confidence: clamp(confidence, 0.15, 0.7),
    location_reasons: uniq(reasons),
  };
}
