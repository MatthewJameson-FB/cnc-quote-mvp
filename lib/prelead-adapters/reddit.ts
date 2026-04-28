import { readFile } from "node:fs/promises";
import type { AdapterLogger, PreleadAdapter, RawPreleadCandidate } from "./types";

const ROOT = process.cwd();
const SOURCES_FILE = `${ROOT}/data/prelead-sources.json`;
const BUILTIN_SUBREDDITS = ["CNC", "Machinists", "projectcar", "kitcar", "Cartalk", "motorcycles", "3Dprinting", "AskEngineers"];
const BUILTIN_QUERIES = [
  "custom part",
  "quote",
  "machinist",
  "aluminium bracket",
  "small batch",
  "CNC",
  "machine shop",
  "billet",
  "replacement part",
  "STEP file",
  "DXF",
];
const REDDIT_TOKEN_ENDPOINT = "https://www.reddit.com/api/v1/access_token";
const REDDIT_API_BASE = "https://oauth.reddit.com";

type SourceEntry = {
  source: string;
  url: string;
  kind?: "url" | "reddit-search";
  subreddit?: string;
  query?: string;
};

type RedditChildData = {
  title?: unknown;
  link_title?: unknown;
  selftext?: unknown;
  body?: unknown;
  description?: unknown;
  subreddit_name_prefixed?: unknown;
  author?: unknown;
  created_utc?: unknown;
  created?: unknown;
  permalink?: unknown;
  url?: unknown;
};

type RedditChild = { data?: RedditChildData };
type RedditListing = { data?: { children?: RedditChild[] }; children?: RedditChild[] };

type RedditAuthMode = "app-only" | "script";
type RedditAuthConfig = { mode: RedditAuthMode; clientId: string; clientSecret: string; userAgent: string; username?: string; password?: string };

type RedditTokenCacheEntry = { cacheKey: string; accessToken: string; expiresAt: number };

let redditTokenCache: RedditTokenCacheEntry | null = null;

function isTruthy(value: string | undefined) {
  return Boolean(value && /^(1|true|yes|on)$/i.test(value.trim()));
}

function normalizeUrl(input: string, base?: string) {
  try {
    return new URL(input, base).toString();
  } catch {
    return null;
  }
}

function parseSourceEntry(entry: string): SourceEntry | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;

  if (trimmed.includes("|")) {
    const [source, url] = trimmed.split("|", 2).map((part) => part.trim());
    const normalized = normalizeUrl(url);
    return source && normalized ? { source, url: normalized, kind: "url" } : null;
  }

  const normalized = normalizeUrl(trimmed);
  return normalized ? { source: new URL(normalized).hostname.replace(/^www\./, ""), url: normalized, kind: "url" } : null;
}

function dedupeSources(sources: SourceEntry[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function buildRedditSearchUrl(subreddit: string, query: string) {
  const params = new URLSearchParams({ q: query, restrict_sr: "1", sort: "new", t: "all", limit: "25", raw_json: "1", type: "link" });
  return `${REDDIT_API_BASE}/r/${encodeURIComponent(subreddit)}/search?${params.toString()}`;
}

function buildBuiltinRedditSources(limit: number): SourceEntry[] {
  const sources: SourceEntry[] = [];

  for (const subreddit of BUILTIN_SUBREDDITS) {
    for (const query of BUILTIN_QUERIES) {
      sources.push({ source: `reddit:r/${subreddit} ${query}`, kind: "reddit-search", subreddit, query, url: buildRedditSearchUrl(subreddit, query) });
    }
  }

  return sources.slice(0, limit);
}

function isRedditUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return /(^|\.)reddit\.com$/i.test(hostname) || hostname === "old.reddit.com" || hostname === "new.reddit.com";
  } catch {
    return false;
  }
}

function redditJsonUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!isRedditUrl(parsed.toString())) {
      return parsed.toString();
    }

    parsed.protocol = "https:";
    parsed.hostname = "oauth.reddit.com";
    parsed.pathname = parsed.pathname.replace(/\.json$/i, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

function cleanRedditThreadUrl(input: string) {
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

    return `https://www.reddit.com/${segments.slice(0, commentsIndex + 3).join("/")}/`;
  } catch {
    return null;
  }
}

function cleanSourceUrl(input: string) {
  try {
    const url = new URL(input);
    if (/(^|\.)redd\.it$/i.test(url.hostname) || /(^|\.)redditmedia\.com$/i.test(url.hostname) || /(^|\.)i\.redd\.it$/i.test(url.hostname) || /(^|\.)preview\.redd\.it$/i.test(url.hostname) || /(^|\.)v\.redd\.it$/i.test(url.hostname)) {
      return null;
    }

    if (isRedditUrl(input)) {
      if (/\/search(?:\/|$)/i.test(url.pathname) || /\.json$/i.test(url.pathname)) {
        return null;
      }
      const canonical = cleanRedditThreadUrl(input);
      return canonical;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function getRedditAuthCandidates(): RedditAuthConfig[] {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  const userAgent = process.env.REDDIT_USER_AGENT?.trim();

  if (!clientId || !clientSecret || !userAgent) {
    return [];
  }

  const username = process.env.REDDIT_USERNAME?.trim();
  const password = process.env.REDDIT_PASSWORD?.trim();

  const appOnly: RedditAuthConfig = { mode: "app-only", clientId, clientSecret, userAgent };
  if (username && password) {
    return [{ mode: "script", clientId, clientSecret, userAgent, username, password }, appOnly];
  }

  return [appOnly];
}

function redditAuthCacheKey(auth: RedditAuthConfig) {
  return [auth.mode, auth.clientId, auth.username ?? "", auth.userAgent].join("|");
}

async function fetchRedditAccessToken(auth: RedditAuthConfig, logger?: AdapterLogger) {
  const body = new URLSearchParams({ grant_type: auth.mode === "script" ? "password" : "client_credentials", scope: "read" });
  if (auth.mode === "script") {
    body.set("username", auth.username ?? "");
    body.set("password", auth.password ?? "");
  }

  const response = await fetch(REDDIT_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": auth.userAgent,
      accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger?.warn(`Reddit token request failed (${auth.mode}): HTTP ${response.status}${text ? ` - ${text.slice(0, 160)}` : ""}`);
    return null;
  }

  const json = (await response.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  const accessToken = typeof json?.access_token === "string" ? json.access_token : null;
  const expiresIn = typeof json?.expires_in === "number" ? json.expires_in : 0;

  if (!accessToken) {
    logger?.warn(`Reddit token response missing access_token (${auth.mode})`);
    return null;
  }

  const cacheKey = redditAuthCacheKey(auth);
  redditTokenCache = { cacheKey, accessToken, expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000 };
  return accessToken;
}

async function getRedditAccessToken(logger?: AdapterLogger) {
  const candidates = getRedditAuthCandidates();
  if (candidates.length === 0) {
    return null;
  }

  for (const auth of candidates) {
    const cacheKey = redditAuthCacheKey(auth);
    if (redditTokenCache && redditTokenCache.cacheKey === cacheKey && redditTokenCache.expiresAt > Date.now()) {
      return redditTokenCache.accessToken;
    }

    const accessToken = await fetchRedditAccessToken(auth, logger);
    if (accessToken) {
      return accessToken;
    }
  }

  return null;
}

function collectRedditCandidates(payload: unknown): RawPreleadCandidate[] {
  const items: RawPreleadCandidate[] = [];

  const pushListingChild = (child: RedditChild) => {
    const data = child.data ?? child;
    if (!data || typeof data !== "object") return;

    const typed = data as RedditChildData;
    const title = typeof typed.title === "string" && typed.title.trim() ? typed.title.trim() : typeof typed.link_title === "string" ? typed.link_title.trim() : "Untitled";
    const bodyParts = [typed.selftext, typed.body, typed.description, typed.subreddit_name_prefixed].flatMap((value) => (typeof value === "string" && value.trim() ? [value.trim()] : []));
    const body = bodyParts.join(" ").trim();
    const author = typeof typed.author === "string" ? typed.author : null;

    if (typeof typed.permalink !== "string" || !typed.permalink.trim()) return;
    if (typeof typed.url === "string" && /preview\.redd\.it|i\.redd\.it|redditmedia\.com/i.test(typed.url)) return;

    const fullUrl = cleanSourceUrl(`https://www.reddit.com${typed.permalink}`);
    if (!fullUrl) return;

    const createdAt =
      typeof typed.created_utc === "number"
        ? new Date(typed.created_utc * 1000).toISOString()
        : typeof typed.created === "number"
          ? new Date(typed.created * 1000).toISOString()
          : null;

    items.push({
      source: "reddit",
      source_url: fullUrl,
      title,
      snippet: [title, body].filter(Boolean).join(" ").trim(),
      published_at: createdAt,
    });

    void author;
  };

  if (Array.isArray(payload)) {
    for (const part of payload) {
      const listing = part as RedditListing;
      if (listing && typeof listing === "object" && listing.data && Array.isArray(listing.data.children)) {
        for (const child of listing.data.children) {
          pushListingChild(child);
        }
      }
    }
    return items;
  }

  if (payload && typeof payload === "object") {
    const data = payload as RedditListing;
    if (data.data && Array.isArray(data.data.children)) {
      for (const child of data.data.children) {
        pushListingChild(child);
      }
      return items;
    }

    if (Array.isArray(data.children)) {
      for (const child of data.children) {
        pushListingChild(child);
      }
      return items;
    }
  }

  return items;
}

async function loadSources() {
  const envSources = process.env.PRELEAD_SOURCES?.split(",") ?? [];
  const sourcesFromEnv = envSources.map(parseSourceEntry).filter(Boolean) as SourceEntry[];
  const maxResults = Number(process.env.PRELEAD_MAX_RESULTS ?? 30);
  const builtinSources = buildBuiltinRedditSources(maxResults);

  let fileSources: SourceEntry[] = [];
  try {
    const raw = await readFile(SOURCES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Array<string | SourceEntry>;
    fileSources = parsed
      .map((entry) => (typeof entry === "string" ? parseSourceEntry(entry) : parseSourceEntry(`${entry.source}|${entry.url}`)))
      .filter(Boolean) as SourceEntry[];
  } catch {
    fileSources = [];
  }

  return dedupeSources([...builtinSources, ...fileSources, ...sourcesFromEnv]).filter((source) => !source.url.startsWith("https://www.reddit.com/search"));
}

async function fetchSourceItems(source: SourceEntry, timeoutMs: number, logger?: AdapterLogger) {
  const isRedditSource = source.kind === "reddit-search" || isRedditUrl(source.url);
  const fetchUrl = isRedditSource ? (source.kind === "reddit-search" ? source.url : redditJsonUrl(source.url)) : source.url;
  const isJson = isRedditSource || fetchUrl.endsWith(".json");

  if (isRedditSource && getRedditAuthCandidates().length === 0) {
    logger?.warn(`Skipping ${source.source}: Reddit env vars missing`);
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const redditToken = isRedditSource ? await getRedditAccessToken(logger) : null;
    if (isRedditSource && !redditToken) {
      logger?.warn(`Skipping ${source.source}: unable to get Reddit OAuth token`);
      return [];
    }

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": process.env.REDDIT_USER_AGENT?.trim() ?? "FlangiePreleadFinder/1.0 (+manual review only)",
        accept: isJson ? "application/json,text/plain,*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(redditToken ? { authorization: `Bearer ${redditToken}` } : {}),
      },
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}${text ? ` - ${text.slice(0, 200)}` : ""}`);
    }

    const text = await response.text();
    if (isJson) {
      try {
        return collectRedditCandidates(JSON.parse(text) as unknown);
      } catch (error) {
        logger?.warn(`Failed to parse Reddit JSON for ${fetchUrl}`, error instanceof Error ? error.message : error);
        return [];
      }
    }

    const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return [{ source: source.source, source_url: source.url, title: source.source, snippet, published_at: null }];
  } finally {
    clearTimeout(timeout);
  }
}

export function createRedditAdapter(logger?: AdapterLogger): PreleadAdapter {
  const enabled = isTruthy(process.env.ENABLE_REDDIT_API) && getRedditAuthCandidates().length > 0;

  if (isTruthy(process.env.ENABLE_REDDIT_API) && !enabled) {
    logger?.warn("Reddit adapter enabled but REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USER_AGENT are missing.");
  }

  return {
    name: "reddit",
    enabled,
    async fetchCandidates() {
      if (!enabled) {
        return [];
      }

      const timeoutMs = Number(process.env.PRELEAD_TIMEOUT_MS ?? 15000);
      const sources = await loadSources();
      const all: RawPreleadCandidate[] = [];

      for (const source of sources) {
        const items = await fetchSourceItems(source, timeoutMs, logger);
        all.push(...items);
      }

      return all;
    },
  };
}
