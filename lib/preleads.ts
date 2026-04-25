import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendPreleadSummaryEmail } from "@/lib/notifications";

export type SourceEntry = {
  source: string;
  url: string;
};

export type Prelead = {
  source: string;
  source_url: string;
  source_author: string | null;
  title: string;
  snippet: string;
  detected_keywords: string[];
  detected_materials: string[];
  location_signal: LocationSignal;
  lead_score: number;
  suggested_reply: string;
  created_at: string;
};

export type LocationSignal = "uk" | "unknown" | "outside_uk";

type MonitorOptions = {
  persistJson?: boolean;
  persistSupabase?: boolean;
  sendEmail?: boolean;
  minScore?: number;
  maxResults?: number;
  requestDelayMs?: number;
  timeoutMs?: number;
  outputPath?: string;
};

type MonitorResult = {
  scanned: number;
  qualifying: number;
  savedToSupabase: number;
  savedToJson: boolean;
  emailed: boolean;
  leads: Prelead[];
};

type FetchedItem = {
  title: string;
  body: string;
  url: string;
  sourceUrl: string;
  author: string | null;
  createdAt: string;
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

type RedditChild = {
  data?: RedditChildData;
};

type RedditListing = {
  data?: {
    children?: RedditChild[];
  };
  children?: RedditChild[];
};

type Logger = {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
};

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "data", "preleads.json");
const SOURCES_FILE = path.join(ROOT, "data", "prelead-sources.json");
const BUILTIN_SUBREDDITS = [
  "CNC",
  "Machinists",
  "projectcar",
  "kitcar",
  "Cartalk",
  "motorcycles",
  "3Dprinting",
  "AskEngineers",
];
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
const DEFAULT_MAX_RESULTS = 30;

const intentPatterns = [
  /\bquote\b/i,
  /\bsupplier\b/i,
  /\bmachinist\b/i,
  /\bmachining\b/i,
  /\bfabricator\b/i,
  /\bmanufacturer\b/i,
  /\bbuilder\b/i,
  /\blead\b/i,
  /\bsource\b/i,
];

const ukPatterns = [
  /\bUK\b/i,
  /\bUnited Kingdom\b/i,
  /\bBritain\b/i,
  /\bEngland\b/i,
  /\bScotland\b/i,
  /\bWales\b/i,
  /\bNorthern Ireland\b/i,
];
const ukCityRegionPatterns = [
  /\bLondon\b/i,
  /\bManchester\b/i,
  /\bBirmingham\b/i,
  /\bLeeds\b/i,
  /\bLiverpool\b/i,
  /\bBristol\b/i,
  /\bSheffield\b/i,
  /\bGlasgow\b/i,
  /\bEdinburgh\b/i,
  /\bCardiff\b/i,
  /\bBelfast\b/i,
  /\bMidlands\b/i,
  /\bYorkshire\b/i,
  /\bSurrey\b/i,
  /\bKent\b/i,
  /\bEssex\b/i,
];
const outsideUkPatterns = [
  /\bUSA\b/i,
  /\bU\.S\.A\.?\b/i,
  /\bUS\b/i,
  /\bUnited States\b/i,
  /\bCanada\b/i,
  /\bAustralia\b/i,
  /\bGermany\b/i,
  /\bFrance\b/i,
  /\bNetherlands\b/i,
  /\bIndia\b/i,
  /\bCalifornia\b/i,
  /\bTexas\b/i,
  /\bNew York\b/i,
  /\bOntario\b/i,
  /\bEU[- ]only\b/i,
];
const cncPatterns = [/\bCNC\b/i, /\bmachining\b/i, /\bmill(?:ing)?\b/i, /\blathe\b/i, /\bturning\b/i, /\bfab(?:rication)?\b/i];
const cadPatterns = [
  /\bCAD\b/i,
  /\bSTEP\b/i,
  /\bSTP\b/i,
  /\bDXF\b/i,
  /\bDWG\b/i,
  /\bdrawing\b/i,
  /\bSolidWorks\b/i,
  /\bFusion 360\b/i,
];
const materialPatterns = [
  /\baluminium\b/i,
  /\baluminum\b/i,
  /\bsteel\b/i,
  /\bstainless\b/i,
  /\bbrass\b/i,
  /\bacetal\b/i,
  /\bPOM\b/i,
  /\bnylon\b/i,
  /\btitanium\b/i,
  /\bcopper\b/i,
  /\bdelrin\b/i,
];
const quantityPatterns = [
  /\bquantity\b/i,
  /\bsmall batch\b/i,
  /\bbatch\b/i,
  /\bprototype\b/i,
  /\bone[- ]off\b/i,
  /\bpilot run\b/i,
  /\blow volume\b/i,
  /\b\d+\s*[x×]\s*\d+/i,
];
const automotivePatterns = [
  /\bautomotive\b/i,
  /\bcar\b/i,
  /\bmotorcycle\b/i,
  /\bclassic\b/i,
  /\brestoration\b/i,
  /\bprototype\b/i,
];
const studentPatterns = [/\bstudent\b/i, /\bhomework\b/i, /\bassignment\b/i, /\bcoursework\b/i, /\bdissertation\b/i];
const threeDPrintOnlyPatterns = [
  /\b3d print(?:ing)?\b/i,
  /\b3d printer\b/i,
  /\bPLA\b/i,
  /\bresin\b/i,
  /\bFDM\b/i,
  /\bhobby printer\b/i,
];
const freeBudgetPatterns = [/\bfree\b/i, /\bno budget\b/i, /\bzero budget\b/i, /\bcheap as possible\b/i, /\bfor free\b/i, /\bdonate\b/i];

function isTruthy(value: string | undefined) {
  return Boolean(value && /^(1|true|yes|on)$/i.test(value.trim()));
}

function createLogger(debugEnabled: boolean): Logger {
  return {
    debug: (message, ...args) => {
      if (debugEnabled) {
        console.log(`[preleads:debug] ${message}`, ...args);
      }
    },
    info: (message, ...args) => {
      console.log(`[preleads] ${message}`, ...args);
    },
    warn: (message, ...args) => {
      console.warn(`[preleads] ${message}`, ...args);
    },
  };
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMaterials(text: string) {
  const materials: string[] = [];
  for (const pattern of materialPatterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      materials.push(match[0].toLowerCase());
    }
  }
  return uniq(materials);
}

function detectKeywords(text: string) {
  const keywords: string[] = [];

  if (intentPatterns.some((pattern) => pattern.test(text))) keywords.push("quote/supplier/machinist intent");
  if (ukPatterns.some((pattern) => pattern.test(text)) || ukCityRegionPatterns.some((pattern) => pattern.test(text))) keywords.push("UK mention");
  if (cncPatterns.some((pattern) => pattern.test(text))) keywords.push("CNC/machining mention");
  if (cadPatterns.some((pattern) => pattern.test(text))) keywords.push("CAD/STEP/DXF/drawing mention");
  if (materialPatterns.some((pattern) => pattern.test(text))) keywords.push("material mention");
  if (quantityPatterns.some((pattern) => pattern.test(text))) keywords.push("quantity/small batch mention");
  if (automotivePatterns.some((pattern) => pattern.test(text))) keywords.push("automotive/prototype/restoration mention");
  if (studentPatterns.some((pattern) => pattern.test(text))) keywords.push("student/homework");
  if (threeDPrintOnlyPatterns.some((pattern) => pattern.test(text))) keywords.push("pure 3D printing only");
  if (freeBudgetPatterns.some((pattern) => pattern.test(text))) keywords.push("free/no budget wording");

  return uniq(keywords);
}

function detectLocationSignal(text: string): LocationSignal {
  if (ukPatterns.some((pattern) => pattern.test(text)) || ukCityRegionPatterns.some((pattern) => pattern.test(text))) {
    return "uk";
  }

  if (outsideUkPatterns.some((pattern) => pattern.test(text))) {
    return "outside_uk";
  }

  return "unknown";
}

function calculateLeadScore(text: string, locationSignal: LocationSignal) {
  let score = 0;

  if (intentPatterns.some((pattern) => pattern.test(text))) score += 5;
  if (locationSignal === "uk") score += 5;
  if (locationSignal === "outside_uk") score -= 20;
  if (cncPatterns.some((pattern) => pattern.test(text))) score += 4;
  if (cadPatterns.some((pattern) => pattern.test(text))) score += 3;
  if (materialPatterns.some((pattern) => pattern.test(text))) score += 3;
  if (quantityPatterns.some((pattern) => pattern.test(text))) score += 2;
  if (automotivePatterns.some((pattern) => pattern.test(text))) score += 2;
  if (studentPatterns.some((pattern) => pattern.test(text))) score -= 5;
  if (threeDPrintOnlyPatterns.some((pattern) => pattern.test(text))) score -= 5;
  if (freeBudgetPatterns.some((pattern) => pattern.test(text))) score -= 10;

  return score;
}

function getSnippet(text: string, phrases: string[]) {
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    const index = lower.indexOf(phrase.toLowerCase());
    if (index !== -1) {
      const start = Math.max(0, index - 120);
      const end = Math.min(text.length, index + 240);
      return text.slice(start, end).trim();
    }
  }

  return text.slice(0, 360).trim();
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return stripHtml(titleMatch[1]);
  }

  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle?.[1]) {
    return stripHtml(ogTitle[1]);
  }

  return "Untitled";
}

function extractSourceAuthorFromHtml(html: string) {
  const candidates = [
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']parsely-author["'][^>]+content=["']([^"']+)["']/i,
    /"author"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }

  return null;
}

function extractCreatedAtFromHtml(html: string) {
  const candidates = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return new Date().toISOString();
}

function normalizeUrl(input: string, base?: string) {
  try {
    return new URL(input, base).toString();
  } catch {
    return null;
  }
}

function isMediaUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return ["preview.redd.it", "i.redd.it", "i.imgur.com", "imgur.com"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function normalizeRedditPermalink(permalink: string) {
  const cleaned = permalink.trim();
  if (!cleaned) {
    return null;
  }

  const withSlash = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return normalizeUrl(withSlash, "https://www.reddit.com");
}

function parseSourceEntry(entry: string): SourceEntry | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("|")) {
    const [source, url] = trimmed.split("|", 2).map((part) => part.trim());
    const normalized = normalizeUrl(url);
    return source && normalized ? { source, url: normalized } : null;
  }

  const normalized = normalizeUrl(trimmed);
  return normalized
    ? { source: new URL(normalized).hostname.replace(/^www\./, ""), url: normalized }
    : null;
}

function buildBuiltinRedditSources(limit: number): SourceEntry[] {
  const sources: SourceEntry[] = [];

  for (const subreddit of BUILTIN_SUBREDDITS) {
    for (const query of BUILTIN_QUERIES) {
      sources.push({
        source: `reddit:r/${subreddit} ${query}`,
        url: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(
          query
        )}&restrict_sr=1&sort=new&t=all&limit=25`,
      });
    }
  }

  return sources.slice(0, limit);
}

function dedupeSources(sources: SourceEntry[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }
    seen.add(source.url);
    return true;
  });
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

    if (parsed.pathname.endsWith(".json")) {
      return parsed.toString();
    }

    parsed.pathname = parsed.pathname.replace(/\/$/, "") + ".json";
    return parsed.toString();
  } catch {
    return url;
  }
}

async function loadSources(logger: Logger): Promise<SourceEntry[]> {
  const envSources = process.env.PRELEAD_SOURCES?.split(",") ?? [];
  const sourcesFromEnv = envSources.map(parseSourceEntry).filter(Boolean) as SourceEntry[];
  const maxResults = Number(process.env.PRELEAD_MAX_RESULTS ?? DEFAULT_MAX_RESULTS);
  const builtinSources = buildBuiltinRedditSources(maxResults);

  let fileSources: SourceEntry[] = [];

  try {
    const raw = await readFile(SOURCES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Array<string | SourceEntry>;
    fileSources = parsed
      .map((entry) =>
        typeof entry === "string"
          ? parseSourceEntry(entry)
          : parseSourceEntry(`${entry.source}|${entry.url}`)
      )
      .filter(Boolean) as SourceEntry[];
  } catch {
    fileSources = [];
  }

  const merged = dedupeSources([...builtinSources, ...fileSources, ...sourcesFromEnv]).slice(0, maxResults);
  logger.info(`Loaded built-in Reddit sources: ${builtinSources.length}`);
  logger.info(`Loaded PRELEAD_SOURCES from file/env: ${fileSources.length + sourcesFromEnv.length}`);
  logger.info(`Total sources scheduled this run: ${merged.length} (max ${maxResults})`);
  logger.debug("Loaded PRELEAD_SOURCES", merged);
  return merged;
}

function buildSuggestedReply(prelead: Omit<Prelead, "suggested_reply">) {
  const intro = prelead.detected_keywords.includes("UK mention") ? "Hi —" : "Hello —";
  const materialNote = prelead.detected_materials.length
    ? ` I noticed you mentioned ${prelead.detected_materials.join(", ")}.`
    : "";

  return [
    `${intro} I came across your post and thought Flangie might be useful.${materialNote}`,
    "If you have a drawing or CAD file (STEP, DXF, or similar), we can help get an indicative CNC quote from UK suppliers.",
    "No pressure if you're still at concept stage — happy to point you in the right direction.",
  ].join(" ");
}

function fromPlainText(
  source: SourceEntry,
  text: string,
  title: string,
  url: string,
  createdAt: string,
  author: string | null
): Prelead {
  const combined = `${title} ${text}`;
  const detectedKeywords = detectKeywords(combined);
  const detectedMaterials = detectMaterials(combined);
  const locationSignal = detectLocationSignal(combined);
  const leadScore = calculateLeadScore(combined, locationSignal);
  const snippet = getSnippet(text, ["quote", "machin", "cnc", "cad", "step", "dxf", "drawing", "prototype", "supplier", "machinist"]);

  const prelead: Omit<Prelead, "suggested_reply"> = {
    source: source.source,
    source_url: url,
    source_author: author,
    title,
    snippet,
    detected_keywords: detectedKeywords,
    detected_materials: detectedMaterials,
    location_signal: locationSignal,
    lead_score: leadScore,
    created_at: createdAt,
  };

  return {
    ...prelead,
    suggested_reply: buildSuggestedReply(prelead),
  };
}

function itemFromHtml(source: SourceEntry, html: string, url: string): FetchedItem {
  const text = stripHtml(html);
  return {
    title: extractTitle(html),
    body: text,
    url,
    sourceUrl: url,
    author: extractSourceAuthorFromHtml(html),
    createdAt: extractCreatedAtFromHtml(html),
  };
}

function collectRedditItems(payload: unknown, baseUrl: string): FetchedItem[] {
  const items: FetchedItem[] = [];

  const pushListingChild = (child: RedditChild) => {
    const data = child.data ?? child;
    if (!data || typeof data !== "object") {
      return;
    }

    const typed = data as RedditChildData;

    const title =
      typeof typed.title === "string" && typed.title.trim()
        ? typed.title
        : typeof typed.link_title === "string"
          ? typed.link_title
          : "Untitled";
    const bodyParts = [typed.selftext, typed.body, typed.description, typed.subreddit_name_prefixed].flatMap(
      (value) => (typeof value === "string" && value.trim() ? [value] : [])
    );
    const body = bodyParts.join(" ").trim();
    const author = typeof typed.author === "string" ? typed.author : null;
    const createdAt =
      typeof typed.created_utc === "number"
        ? new Date(typed.created_utc * 1000).toISOString()
        : typeof typed.created === "number"
          ? new Date(typed.created * 1000).toISOString()
          : new Date().toISOString();
    const permalink = typeof typed.permalink === "string" ? normalizeRedditPermalink(typed.permalink) : null;

    if (!permalink || isMediaUrl(permalink)) {
      return;
    }

    const text = [title, body, typeof typed.url === "string" ? typed.url : ""].filter(Boolean).join(" ").trim();
    items.push({ title, body: text, url: baseUrl, sourceUrl: permalink, author, createdAt });
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

async function fetchSourceItems(source: SourceEntry, timeoutMs: number, logger: Logger) {
  const redditJson = isRedditUrl(source.url) ? redditJsonUrl(source.url) : source.url;
  const fetchUrl = redditJson;
  const isJson = fetchUrl.endsWith(".json");

  if (isRedditUrl(source.url) && fetchUrl !== source.url) {
    logger.debug(`Converted Reddit HTML URL to JSON: ${source.url} -> ${fetchUrl}`);
  }

  logger.debug(`Fetching source ${source.source}`, { fetchUrl });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": "FlangiePreleadFinder/1.0 (+manual review only)",
        accept: isJson ? "application/json,text/plain,*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    logger.debug(`HTTP ${response.status} for ${fetchUrl}`);

    if (!response.ok) {
      if (response.status === 403) {
        logger.warn(`Source blocked or requires official API: ${fetchUrl}`);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    if (isJson) {
      try {
        const parsed = JSON.parse(text) as unknown;
        const items = collectRedditItems(parsed, fetchUrl);
        logger.debug(`Raw items found for ${source.source}: ${items.length}`);
        return items;
      } catch (error) {
        logger.warn(`Failed to parse Reddit JSON for ${fetchUrl}`, error instanceof Error ? error.message : error);
        return [];
      }
    }

    const htmlItem = itemFromHtml(source, text, source.url);
    logger.debug(`Raw items found for ${source.source}: 1`);
    return [htmlItem];
  } finally {
    clearTimeout(timeout);
  }
}

function itemToPrelead(source: SourceEntry, item: FetchedItem): Prelead {
  return fromPlainText(source, item.body, item.title, item.sourceUrl || item.url, item.createdAt, item.author);
}

async function saveToSupabase(leads: Prelead[]) {
  if (leads.length === 0) {
    return 0;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const sourceUrls = leads.map((lead) => lead.source_url);
    const { data: existing, error: selectError } = await supabase
      .from("pre_leads")
      .select("source_url")
      .in("source_url", sourceUrls);

    if (selectError) {
      throw new Error(selectError.message);
    }

    const existingUrls = new Set((existing ?? []).map((row) => row.source_url as string));
    const freshLeads = leads.filter((lead) => !existingUrls.has(lead.source_url));

    if (freshLeads.length === 0) {
      return 0;
    }

    const { error } = await supabase.from("pre_leads").insert(
      freshLeads.map((lead) => ({
        created_at: lead.created_at,
        source: lead.source,
        source_url: lead.source_url,
        source_author: lead.source_author,
        title: lead.title,
        snippet: lead.snippet,
        matched_keywords: lead.detected_keywords,
        detected_materials: lead.detected_materials,
        location_signal: lead.location_signal,
        lead_score: lead.lead_score,
        suggested_reply: lead.suggested_reply,
        status: "new",
      }))
    );

    if (error) {
      throw new Error(error.message);
    }

    return freshLeads.length;
  } catch (error) {
    console.warn(`Supabase save skipped: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

async function saveToJson(leads: Prelead[], outputPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(leads, null, 2) + "\n", "utf8");
}

export async function runPreleadMonitor(options: MonitorOptions = {}): Promise<MonitorResult> {
  const debugEnabled = isTruthy(process.env.PRELEAD_DEBUG);
  const includeOutsideUk = isTruthy(process.env.PRELEAD_INCLUDE_OUTSIDE_UK);
  const logger = createLogger(debugEnabled);
  const {
    persistJson = true,
    persistSupabase = true,
    sendEmail = true,
    minScore = Number(process.env.PRELEAD_MIN_SCORE ?? 6),
    maxResults = Number(process.env.PRELEAD_MAX_RESULTS ?? DEFAULT_MAX_RESULTS),
    requestDelayMs = Number(process.env.PRELEAD_DELAY_MS ?? 750),
    timeoutMs = Number(process.env.PRELEAD_TIMEOUT_MS ?? 15000),
    outputPath = OUTPUT_PATH,
  } = options;

  logger.info(`Debug mode: ${debugEnabled ? "on" : "off"}`);
  logger.info(`Include outside-UK leads: ${includeOutsideUk ? "on" : "off"}`);
  const sources = (await loadSources(logger)).slice(0, maxResults);
  const leads: Prelead[] = [];
  const rejected: Prelead[] = [];
  const rejectedOutsideUk: Prelead[] = [];
  const seen = new Set<string>();
  let rawItemsFound = 0;
  let passedThreshold = 0;

  for (const source of sources) {
    // Keep the crawler polite: one request at a time, with a small delay.
    // Check robots.txt and the site’s terms before adding any source here.
    await sleep(requestDelayMs);

    try {
      const items = await fetchSourceItems(source, timeoutMs, logger);
      rawItemsFound += items.length;

      let sourcePassed = 0;
      for (const item of items) {
        const lead = itemToPrelead(source, item);

        if (lead.location_signal === "outside_uk" && !includeOutsideUk) {
          rejectedOutsideUk.push(lead);
          continue;
        }

        if (lead.lead_score < minScore) {
          rejected.push(lead);
          continue;
        }

        sourcePassed += 1;

        if (seen.has(lead.source_url)) {
          continue;
        }

        seen.add(lead.source_url);
        leads.push(lead);
      }

      passedThreshold += sourcePassed;
      logger.debug(`Passing threshold for ${source.source}: ${sourcePassed}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`Skipping ${source.url}: ${message}`);
    }
  }

  leads.sort((a, b) => b.lead_score - a.lead_score || a.created_at.localeCompare(b.created_at));

  logger.info(`Raw items found: ${rawItemsFound}`);
  logger.info(`Passing score threshold: ${passedThreshold}`);
  logger.info(`Qualifying unique leads: ${leads.length}`);

  if (debugEnabled && rejectedOutsideUk.length > 0) {
    const topRejectedOutsideUk = rejectedOutsideUk.sort((a, b) => b.lead_score - a.lead_score).slice(0, 8);
    logger.debug(
      "Top rejected outside-UK leads:",
      topRejectedOutsideUk.map((lead) => ({
        score: lead.lead_score,
        location_signal: lead.location_signal,
        title: lead.title,
        url: lead.source_url,
        keywords: lead.detected_keywords,
      }))
    );
  }

  if (debugEnabled && rejected.length > 0) {
    const topRejected = rejected.sort((a, b) => b.lead_score - a.lead_score).slice(0, 8);
    logger.debug(
      "Top rejected leads:",
      topRejected.map((lead) => ({
        score: lead.lead_score,
        location_signal: lead.location_signal,
        title: lead.title,
        url: lead.source_url,
        keywords: lead.detected_keywords,
      }))
    );
  }

  let savedToSupabase = 0;
  if (persistSupabase) {
    savedToSupabase = await saveToSupabase(leads);
  }

  let savedToJson = false;
  if (persistJson) {
    await saveToJson(leads, outputPath);
    savedToJson = true;
  }

  let emailed = false;
  if (sendEmail && leads.length > 0) {
    emailed = await sendPreleadSummaryEmail(leads);
  }

  return {
    scanned: sources.length,
    qualifying: leads.length,
    savedToSupabase,
    savedToJson,
    emailed,
    leads,
  };
}

export function defaultPreleadOutputPath() {
  return OUTPUT_PATH;
}
