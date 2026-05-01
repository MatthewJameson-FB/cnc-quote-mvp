import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { AdapterLogger, PreleadAdapter, RawPreleadCandidate } from "./types";

const ROOT = process.cwd();
const DATA_DIR = `${ROOT}/data`;
const QUERY_HEALTH_PATH = `${DATA_DIR}/prelead-query-health.json`;
const SERPAPI_BUDGET_PATH = `${DATA_DIR}/serpapi-budget.json`;

type SearchRecency = "day" | "week" | "month" | "any";

type DiscoveryQuery = {
  query: string;
  recency: SearchRecency;
  kind: "core" | "rotating";
};

const CORE_QUERIES: DiscoveryQuery[] = [
  { kind: "core", recency: "week", query: 'site:reddit.com "can\'t find" "plastic clip" "BMW E46" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "core", recency: "week", query: 'site:reddit.com "discontinued" "interior trim" car -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "core", recency: "week", query: 'site:reddit.com "OEM unavailable" bracket car -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "core", recency: "week", query: 'site:reddit.com "replacement part not available" "classic car" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "core", recency: "week", query: 'site:reddit.com "no longer available" "trim clip" car -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "core", recency: "week", query: 'site:reddit.com "can\'t find" "interior cover" "VW Golf" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
];

const ROTATING_QUERIES: DiscoveryQuery[] = [
  { kind: "rotating", recency: "day", query: 'site:reddit.com "can\'t find" "trim piece" "MX5 NA" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "rotating", recency: "day", query: 'site:reddit.com "where can I get" "dashboard trim" "MX5" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "rotating", recency: "day", query: 'site:reddit.com "discontinued" "retainer clip" car -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "rotating", recency: "day", query: 'site:reddit.com "obsolete" "car trim clip" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "rotating", recency: "day", query: 'site:mx5oc.co.uk "discontinued" "trim clip" car -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
  { kind: "rotating", recency: "day", query: 'site:bimmerforums.com "can\'t find" "trim piece" "BMW E46" -engine -gearbox -sensor -ECU -wiring -"won\'t start" -"buying advice"' },
];

const MAX_DISCOVERY_QUERIES = 10;

type QueryHealthEntry = {
  disabled?: boolean;
  zeroAcceptedStreak?: number;
  lowQualityStreak?: number;
};

type QueryHealthState = {
  version: 1;
  queries: Record<string, QueryHealthEntry>;
};

type BudgetState = {
  date: string;
  usedQueries: number;
  updatedAt: string;
};

type DiscoveryQueryPlan = DiscoveryQuery & { disabled: boolean };

type RunMeta = {
  searchesUsed: number;
  skippedBudget: number;
  quotaExhausted: boolean;
};

function isTruthy(value: string | undefined) {
  return Boolean(value && /^(1|true|yes|on)$/i.test(value.trim()));
}

function classifySearchResultSource(link: string): "reddit" | "forum" | "google-indexed" {
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, "");
    if (/(^|\.)reddit\.com$/i.test(host) || /(^|\.)redd\.it$/i.test(host)) {
      return "reddit";
    }

    if (/(pistonheads\.com|forum|forums|club)/i.test(host)) {
      return "forum";
    }

    return "google-indexed";
  } catch {
    return "google-indexed";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDaySeed() {
  const today = new Date();
  return Math.floor(today.getTime() / 86400000);
}

function getBudgetInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(filePath: string, value: unknown) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function loadQueryHealthState(): Promise<QueryHealthState> {
  const parsed = await loadJson<QueryHealthState | null>(QUERY_HEALTH_PATH, null);
  if (!parsed || parsed.version !== 1 || !parsed.queries || typeof parsed.queries !== "object") {
    return { version: 1, queries: {} };
  }

  return parsed;
}

async function loadBudgetState(): Promise<BudgetState> {
  const parsed = await loadJson<BudgetState | null>(SERPAPI_BUDGET_PATH, null);
  const today = todayKey();
  if (!parsed || parsed.date !== today) {
    return { date: today, usedQueries: 0, updatedAt: new Date().toISOString() };
  }

  return {
    date: parsed.date,
    usedQueries: Number(parsed.usedQueries ?? 0),
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

async function saveBudgetState(state: BudgetState) {
  await saveJson(SERPAPI_BUDGET_PATH, state);
}

async function getDiscoveryQueries(): Promise<{ queries: DiscoveryQueryPlan[]; runBudget: number; skippedBudget: number; quotaExhausted: boolean }> {
  const rotatingSlots = Math.max(0, MAX_DISCOVERY_QUERIES - CORE_QUERIES.length);
  const start = ROTATING_QUERIES.length > 0 ? getDaySeed() % ROTATING_QUERIES.length : 0;
  const rotating = Array.from({ length: rotatingSlots }, (_, index) => ROTATING_QUERIES[(start + index) % ROTATING_QUERIES.length]);
  const planned = [...CORE_QUERIES, ...rotating].slice(0, MAX_DISCOVERY_QUERIES);
  const queryHealth = await loadQueryHealthState();
  const budgetState = await loadBudgetState();
  const dailyTarget = getBudgetInt("SERPAPI_DAILY_TARGET", MAX_DISCOVERY_QUERIES);
  const dailyMax = getBudgetInt("SERPAPI_DAILY_MAX", 15);
  const remainingBudget = Math.max(0, dailyMax - budgetState.usedQueries);
  const runBudget = Math.min(planned.length, dailyTarget, remainingBudget);
  const quotaExhausted = remainingBudget <= 0;

  const budgeted = planned.map((entry) => {
    const health = queryHealth.queries[entry.query];
    return {
      ...entry,
      disabled: Boolean(health?.disabled || (health?.zeroAcceptedStreak ?? 0) >= 3 || (health?.lowQualityStreak ?? 0) >= 3),
    };
  });

  const active = budgeted.filter((entry) => !entry.disabled);
  const disabledSkipped = budgeted.length - active.length;

  return {
    queries: active,
    runBudget: Math.min(active.length, runBudget),
    skippedBudget: disabledSkipped,
    quotaExhausted,
  };
}

function recencyToTbs(recency: SearchRecency) {
  if (recency === "day") return "qdr:d";
  if (recency === "week") return "qdr:w";
  if (recency === "month") return "qdr:m";
  return null;
}

function normalizeUrl(input: string, base?: string) {
  try {
    const url = new URL(input, base);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isRedditMediaUrl(url: URL) {
  return /(^|\.)reddit\.com$/i.test(url.hostname)
    ? false
    : /(^|\.)redd\.it$/i.test(url.hostname) || /(^|\.)redditmedia\.com$/i.test(url.hostname) || /(^|\.)i\.redd\.it$/i.test(url.hostname) || /(^|\.)preview\.redd\.it$/i.test(url.hostname) || /(^|\.)v\.redd\.it$/i.test(url.hostname);
}

function canonicalRedditThreadUrl(input: string) {
  try {
    const url = new URL(input);
    if (!/(^|\.)reddit\.com$/i.test(url.hostname)) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const commentsIndex = segments.indexOf("comments");
    if (commentsIndex === -1 || commentsIndex + 2 >= segments.length) {
      return null;
    }

    const threadSegments = segments.slice(0, commentsIndex + 3);
    return `https://www.reddit.com/${threadSegments.join("/")}/`;
  } catch {
    return null;
  }
}

function cleanSourceUrl(input: string) {
  const normalized = normalizeUrl(input);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);

    if (isRedditMediaUrl(url)) {
      return null;
    }

    if (/(^|\.)reddit\.com$/i.test(url.hostname)) {
      if (/\/search(?:\/|$)/i.test(url.pathname) || /\.json$/i.test(url.pathname)) {
        return null;
      }

      const canonical = canonicalRedditThreadUrl(normalized);
      return canonical;
    }

    url.hash = "";
    url.search = url.hostname === "www.reddit.com" && /\/comments\//i.test(url.pathname) ? "" : url.search;
    return url.toString();
  } catch {
    return null;
  }
}

type SerpApiOrganicResult = {
  title?: unknown;
  link?: unknown;
  snippet?: unknown;
};

type SerpApiResponse = {
  organic_results?: SerpApiOrganicResult[];
};

async function fetchSerpApiQuery(query: string, apiKey: string, recency: SearchRecency) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "10");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("hl", "en");

  const tbs = recencyToTbs(recency);
  if (tbs) {
    url.searchParams.set("tbs", tbs);
  }

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
    },
  });

  const body = await response.text().catch(() => "");

  if (response.status === 429) {
    const error = new Error(`SerpAPI quota exhausted: HTTP 429${body ? ` - ${body}` : ""}`);
    (error as Error & { quotaExhausted?: boolean }).quotaExhausted = true;
    throw error;
  }

  if (!response.ok) {
    throw new Error(`SerpAPI request failed: HTTP ${response.status}${body ? ` - ${body}` : ""}`);
  }

  let parsed: SerpApiResponse | null = null;
  try {
    parsed = JSON.parse(body) as SerpApiResponse;
  } catch {
    throw new Error(`SerpAPI request failed: invalid JSON${body ? ` - ${body.slice(0, 500)}` : ""}`);
  }

  return Array.isArray(parsed?.organic_results) ? parsed.organic_results : [];
}

export function createSerpapiAdapter(logger?: AdapterLogger): PreleadAdapter {
  const enabled = isTruthy(process.env.ENABLE_SEARCH_API) && process.env.SEARCH_PROVIDER?.trim().toLowerCase() === "serpapi";

  if (!enabled) {
    return {
      name: "serpapi",
      enabled: false,
      fetchCandidates: async () => [],
    };
  }

  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ENABLE_SEARCH_API=true requires SERPAPI_API_KEY");
  }

  return {
    name: "serpapi",
    enabled: true,
    getRunMeta: () => lastRunMeta,
    async fetchCandidates() {
      const all: RawPreleadCandidate[] = [];
      let failedQueries = 0;
      let quotaExhausted = false;
      let searchesUsed = 0;
      let skippedBudget = 0;
      const { queries, runBudget, skippedBudget: plannedSkipped, quotaExhausted: budgetQuotaExhausted } = await getDiscoveryQueries();
      skippedBudget += plannedSkipped;
      quotaExhausted = quotaExhausted || budgetQuotaExhausted;

      if (isTruthy(process.env.PRELEAD_DEBUG)) {
        console.log(`[preleads] discovery queries: ${queries.length}/${MAX_DISCOVERY_QUERIES}`);
      }
      logger?.debug("active query set: scarcity_first_automotive");

      for (const [index, plan] of queries.entries()) {
        if (index >= runBudget) {
          skippedBudget += queries.length - index;
          break;
        }

        const { query, recency, kind, disabled } = plan;
        if (disabled) {
          skippedBudget += 1;
          logger?.debug(`skipping disabled query: ${query}`);
          continue;
        }

        searchesUsed += 1;

        try {
          logger?.debug(`serpapi query (${kind}, ${recency}): ${query}`);
          const results = await fetchSerpApiQuery(query, apiKey, recency);

          for (const item of results) {
            const title = typeof item.title === "string" ? item.title.trim() : "";
            const link = typeof item.link === "string" ? item.link.trim() : "";
            if (!title || !link) {
              continue;
            }

            const cleanUrl = cleanSourceUrl(link);
            if (!cleanUrl) {
              continue;
            }

            all.push({
              source: classifySearchResultSource(link),
              source_platform: classifySearchResultSource(link),
              source_url: cleanUrl,
              title,
              snippet: typeof item.snippet === "string" ? item.snippet.trim() : "",
              published_at: null,
              query_used: query,
            });
          }
        } catch (error) {
          const quotaFlag = Boolean((error as { quotaExhausted?: boolean } | null)?.quotaExhausted);
          if (quotaFlag) {
            quotaExhausted = true;
            logger?.warn(`serpapi quota exhausted: ${query}`);
            break;
          }

          failedQueries += 1;
          const statusOrError = error instanceof Error ? error.message : String(error);
          logger?.warn(`serpapi query failed: ${query} ${statusOrError}`);
        }

        await sleep(500);
      }

      lastRunMeta = { searchesUsed, skippedBudget, quotaExhausted };

      if (queries.length > 0 && failedQueries === queries.length && !quotaExhausted) {
        throw new Error("All SerpAPI queries failed");
      }

      const budgetState = await loadBudgetState();
      budgetState.usedQueries += searchesUsed;
      budgetState.updatedAt = new Date().toISOString();
      await saveBudgetState(budgetState);

      return all;
    },
  };
}

let lastRunMeta: RunMeta = { searchesUsed: 0, skippedBudget: 0, quotaExhausted: false };
