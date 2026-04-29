import type { AdapterLogger, PreleadAdapter, RawPreleadCandidate } from "./types";

const QUERIES = [
  // 🔥 Broken / replacement (highest intent)
  `site:reddit.com "broken part" "replacement"`,
  `site:reddit.com "lost part" "replacement"`,
  `site:reddit.com "missing piece" "fix"`,
  `site:reddit.com "discontinued part"`,
  `site:reddit.com "can't find replacement"`,

  // 🔧 Fix / repair intent
  `site:reddit.com "how do I fix this part"`,
  `site:reddit.com "how to repair plastic part"`,
  `site:reddit.com "any way to fix this"`,

  // 🧩 Real-world objects
  `site:reddit.com "car trim broken"`,
  `site:reddit.com "washing machine part broken"`,
  `site:reddit.com "sofa leg broken"`,
  `site:reddit.com "window switch broken"`,

  // 📐 CAD / STL frustration
  `site:reddit.com "can't find STL"`,
  `site:reddit.com "no STL file"`,
  `site:reddit.com "need CAD file"`,

  // 🧠 Existing 3D print intent (keep some)
  `site:reddit.com "can someone 3d print this"`,
  `site:reddit.com "need this 3d printed"`,
];

type SearchRecency = "day" | "week" | "month" | "any";

function isTruthy(value: string | undefined) {
  return Boolean(value && /^(1|true|yes|on)$/i.test(value.trim()));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSearchRecency(): SearchRecency {
  const value = process.env.PRELEAD_SEARCH_RECENCY?.trim().toLowerCase();
  if (value === "day" || value === "week" || value === "month" || value === "any") {
    return value;
  }

  return "week";
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

async function fetchSerpApiQuery(query: string, apiKey: string) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "10");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("hl", "en");

  const recency = getSearchRecency();
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
    async fetchCandidates() {
      const all: RawPreleadCandidate[] = [];
      let failedQueries = 0;
      const recency = getSearchRecency();

      if (isTruthy(process.env.PRELEAD_DEBUG)) {
        console.log(`[preleads] search recency: ${recency}`);
      }
      logger?.debug("active query set: machining_problem_queries");

      for (const query of QUERIES) {
        try {
          logger?.debug(`serpapi query: ${query}`);
          const results = await fetchSerpApiQuery(query, apiKey);

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
              source: "serpapi",
              source_url: cleanUrl,
              title,
              snippet: typeof item.snippet === "string" ? item.snippet.trim() : "",
              published_at: null,
              query_used: query,
            });
          }
        } catch (error) {
          failedQueries += 1;
          const statusOrError = error instanceof Error ? error.message : String(error);
          logger?.warn(`serpapi query failed: ${query} ${statusOrError}`);
        }

        await sleep(500);
      }

      if (failedQueries === QUERIES.length) {
        throw new Error("All SerpAPI queries failed");
      }

      return all;
    },
  };
}
