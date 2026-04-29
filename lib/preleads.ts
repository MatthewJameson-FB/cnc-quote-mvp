import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient, getSupabaseAdminEnvStatus } from "@/lib/supabase-admin";
import { sendPreleadSummaryEmail } from "@/lib/notifications";
import { buildEnabledPreleadAdapters } from "@/lib/prelead-adapters";
import type { RawPreleadCandidate } from "@/lib/prelead-adapters/types";
import {
  type AiPreleadClassification,
  classifyPreleadCandidatesWithAI,
  getAiPreleadClassifierConfig,
} from "@/lib/prelead-ai-classifier";
import {
  appendPreleadLearningLog,
  createPreleadLearningLogId,
} from "@/lib/prelead-learning-log";

export type SourceEntry = {
  source: string;
  url: string;
  kind?: "url" | "reddit-search";
  subreddit?: string;
  query?: string;
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

type RedditAuthMode = "app-only" | "script";

type RedditAuthConfig = {
  mode: RedditAuthMode;
  clientId: string;
  clientSecret: string;
  userAgent: string;
  username?: string;
  password?: string;
};

type RedditTokenCacheEntry = {
  cacheKey: string;
  accessToken: string;
  expiresAt: number;
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
const REDDIT_TOKEN_ENDPOINT = "https://www.reddit.com/api/v1/access_token";
const REDDIT_API_BASE = "https://oauth.reddit.com";

let redditTokenCache: RedditTokenCacheEntry | null = null;

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

type PreleadIntentType =
  | "buyer_problem"
  | "supplier_ad"
  | "business_advice"
  | "machine_purchase"
  | "general_discussion"
  | "unknown";

type PreAiHardRejectReason =
  | "supplier_ad"
  | "job"
  | "politics_news"
  | "mattress_furniture"
  | "outside_uk"
  | "machine_purchase"
  | "business_advice";

type PreleadIntent = {
  intent_type: PreleadIntentType;
  machining_signals: string[];
  physical_part_signals: string[];
  need_signals: string[];
  negative_signals: string[];
  confidence: number;
};

type SignalEntry = {
  label: string;
  pattern: RegExp;
  weight: number;
};

const machiningSignalEntries: SignalEntry[] = [
  { label: "machined", pattern: /\bmachined\b/i, weight: 0.18 },
  { label: "machining", pattern: /\bmachining\b/i, weight: 0.18 },
  { label: "CNC", pattern: /\bcnc\b/i, weight: 0.16 },
  { label: "milling", pattern: /\bmill(?:ing)?\b/i, weight: 0.14 },
  { label: "turning", pattern: /\bturning\b/i, weight: 0.14 },
  { label: "lathe", pattern: /\blathe\b/i, weight: 0.14 },
  { label: "fabricated", pattern: /\bfabricat(?:ed|e|ion)\b/i, weight: 0.16 },
  { label: "metalwork", pattern: /\bmetalwork\b/i, weight: 0.12 },
  { label: "aluminium", pattern: /\baluminium\b/i, weight: 0.12 },
  { label: "aluminum", pattern: /\baluminum\b/i, weight: 0.12 },
  { label: "steel", pattern: /\bsteel\b/i, weight: 0.12 },
  { label: "stainless", pattern: /\bstainless\b/i, weight: 0.12 },
  { label: "brass", pattern: /\bbrass\b/i, weight: 0.1 },
  { label: "acetal", pattern: /\bacetal\b/i, weight: 0.1 },
  { label: "delrin", pattern: /\bdelrin\b/i, weight: 0.1 },
  { label: "engineering plastic", pattern: /\bengineering plastic\b/i, weight: 0.12 },
];

const physicalPartSignalEntries: SignalEntry[] = [
  { label: "bracket", pattern: /\bbracket\b/i, weight: 0.14 },
  { label: "spacer", pattern: /\bspacer\b/i, weight: 0.14 },
  { label: "plate", pattern: /\bplate\b/i, weight: 0.14 },
  { label: "housing", pattern: /\bhousing\b/i, weight: 0.14 },
  { label: "adapter", pattern: /\badapter\b/i, weight: 0.14 },
  { label: "replacement part", pattern: /\breplacement part\b/i, weight: 0.18 },
  { label: "prototype", pattern: /\bprototype\b/i, weight: 0.14 },
  { label: "enclosure", pattern: /\benclosure\b/i, weight: 0.14 },
  { label: "shaft", pattern: /\bshaft\b/i, weight: 0.12 },
  { label: "bushing", pattern: /\bbushing\b/i, weight: 0.12 },
  { label: "mount", pattern: /\bmount\b/i, weight: 0.12 },
  { label: "fixture", pattern: /\bfixture\b/i, weight: 0.12 },
  { label: "jig", pattern: /\bjig\b/i, weight: 0.12 },
  { label: "flange", pattern: /\bflange\b/i, weight: 0.12 },
  { label: "panel", pattern: /\bpanel\b/i, weight: 0.12 },
  { label: "gear", pattern: /\bgear\b/i, weight: 0.12 },
  { label: "pulley", pattern: /\bpulley\b/i, weight: 0.12 },
  { label: "clamp", pattern: /\bclamp\b/i, weight: 0.12 },
  { label: "rail", pattern: /\brail\b/i, weight: 0.12 },
  { label: "block", pattern: /\bblock\b/i, weight: 0.12 },
  { label: "manifold", pattern: /\bmanifold\b/i, weight: 0.12 },
  { label: "motorcycle part", pattern: /\bmotorcycle part\b/i, weight: 0.16 },
  { label: "car part", pattern: /\bcar part\b/i, weight: 0.16 },
  { label: "robotics", pattern: /\brobotics\b/i, weight: 0.12 },
];

const needSignalEntries: SignalEntry[] = [
  { label: "need", pattern: /\bneed(?:s|ing)?\b/i, weight: 0.14 },
  { label: "looking for someone", pattern: /\blooking for (?:someone|a shop|a machinist|a fabricator|a maker|someone to make|someone who can make)\b/i, weight: 0.18 },
  { label: "can anyone make", pattern: /\bcan anyone make\b/i, weight: 0.2 },
  { label: "where can I get", pattern: /\bwhere can i get\b/i, weight: 0.18 },
  { label: "quote", pattern: /\bquote\b/i, weight: 0.12 },
  { label: "broken", pattern: /\bbroken\b/i, weight: 0.1 },
  { label: "discontinued", pattern: /\bdiscontinued\b/i, weight: 0.12 },
  { label: "custom", pattern: /\bcustom\b/i, weight: 0.12 },
  { label: "one-off", pattern: /\bone[- ]off\b/i, weight: 0.12 },
  { label: "small batch", pattern: /\bsmall batch\b/i, weight: 0.14 },
  { label: "CAD", pattern: /\bcad\b/i, weight: 0.12 },
  { label: "drawing", pattern: /\bdrawing\b/i, weight: 0.12 },
  { label: "dimensions", pattern: /\bdimensions?\b/i, weight: 0.1 },
  { label: "fabricate", pattern: /\bfabricat(?:e|ion)\b/i, weight: 0.12 },
  { label: "machined", pattern: /\bmachined\b/i, weight: 0.12 },
  { label: "machining", pattern: /\bmachining\b/i, weight: 0.12 },
];

const supplierAdSignalEntries: SignalEntry[] = [
  { label: "we offer", pattern: /\bwe offer\b/i, weight: 0.3 },
  { label: "our services", pattern: /\bour services\b/i, weight: 0.3 },
  { label: "CNC services", pattern: /\bcnc services\b/i, weight: 0.35 },
  { label: "machine shop advertising", pattern: /\bmachine shop\b/i, weight: 0.15 },
  { label: "contact us", pattern: /\bcontact us\b/i, weight: 0.18 },
  { label: "portfolio", pattern: /\bportfolio\b/i, weight: 0.12 },
  { label: "service page", pattern: /\bservices?\b/i, weight: 0.12 },
  { label: "send us your drawings", pattern: /\bsend us your drawings\b/i, weight: 0.22 },
  { label: "request a quote form", pattern: /\brequest a quote\b/i, weight: 0.18 },
  { label: "manufacturing company", pattern: /\bmanufacturing company\b/i, weight: 0.18 },
  { label: "shop advertising", pattern: /\bshop\b/i, weight: 0.08 },
];

const businessAdviceSignalEntries: SignalEntry[] = [
  { label: "starting a CNC business", pattern: /\bstarting a cnc business\b/i, weight: 0.4 },
  { label: "how to start a CNC business", pattern: /\bhow to start a cnc business\b/i, weight: 0.4 },
  { label: "how to get clients", pattern: /\bhow to get clients\b/i, weight: 0.35 },
  { label: "marketing", pattern: /\bmarketing\b/i, weight: 0.2 },
  { label: "supplier list", pattern: /\bsupplier list\b/i, weight: 0.25 },
  { label: "recommendations", pattern: /\brecommendations?\b/i, weight: 0.12 },
  { label: "business advice", pattern: /\bbusiness\b/i, weight: 0.08 },
];

const machinePurchaseSignalEntries: SignalEntry[] = [
  { label: "best CNC machine", pattern: /\bbest cnc machine\b/i, weight: 0.42 },
  { label: "which CNC", pattern: /\bwhich cnc\b/i, weight: 0.4 },
  { label: "buy CNC", pattern: /\bbuy(?:ing)? a cnc\b/i, weight: 0.35 },
  { label: "router", pattern: /\brouter\b/i, weight: 0.15 },
  { label: "woodworking", pattern: /\bwoodworking\b/i, weight: 0.3 },
  { label: "hobby CNC", pattern: /\bhobby cnc\b/i, weight: 0.3 },
  { label: "machine purchase", pattern: /\bbuy\b/i, weight: 0.1 },
  { label: "training", pattern: /\btraining\b/i, weight: 0.1 },
  { label: "course", pattern: /\bcourse\b/i, weight: 0.1 },
  { label: "tutorial", pattern: /\btutorial\b/i, weight: 0.1 },
];

const generalDiscussionSignalEntries: SignalEntry[] = [
  { label: "advice", pattern: /\badvice\b/i, weight: 0.1 },
  { label: "discussion", pattern: /\bdiscussion\b/i, weight: 0.1 },
  { label: "what do you think", pattern: /\bwhat do you think\b/i, weight: 0.12 },
  { label: "recommendations", pattern: /\brecommendations?\b/i, weight: 0.12 },
];

const negativeSignalEntries: SignalEntry[] = [
  ...supplierAdSignalEntries,
  ...businessAdviceSignalEntries,
  ...machinePurchaseSignalEntries,
  { label: "custom product", pattern: /\bcustom product\b/i, weight: 0.12 },
  ...threeDPrintOnlyPatterns.map((pattern) => ({ label: "3d printing only", pattern, weight: 0.1 })),
  ...studentPatterns.map((pattern) => ({ label: "student/homework", pattern, weight: 0.08 })),
  ...freeBudgetPatterns.map((pattern) => ({ label: "free/no budget", pattern, weight: 0.08 })),
];

const bannedKeywordEntries: SignalEntry[] = [
  { label: "mattress", pattern: /\bmattress(?:es)?\b/i, weight: 1 },
  { label: "sofa", pattern: /\bsofa(?:s)?\b/i, weight: 1 },
  { label: "bed", pattern: /\bbed(?:s)?\b/i, weight: 1 },
  { label: "furniture", pattern: /\bfurniture\b/i, weight: 1 },
  { label: "clothes", pattern: /\bclothes?\b/i, weight: 1 },
  { label: "clothing", pattern: /\bclothing\b/i, weight: 1 },
  { label: "fashion", pattern: /\bfashion\b/i, weight: 1 },
  { label: "upholstery", pattern: /\bupholstery\b/i, weight: 1 },
  { label: "home decor", pattern: /\bhome decor\b/i, weight: 1 },
  { label: "t-shirt", pattern: /\bt-?shirt\b/i, weight: 1 },
  { label: "print on demand", pattern: /\bprint[- ]on[- ]demand\b/i, weight: 1 },
  { label: "job", pattern: /\bjob(?:s)?\b/i, weight: 1 },
  { label: "hiring", pattern: /\bhiring\b/i, weight: 1 },
  { label: "salary", pattern: /\bsalary\b/i, weight: 1 },
  { label: "career", pattern: /\bcareer\b/i, weight: 1 },
  { label: "politics", pattern: /\bpolitics?\b/i, weight: 1 },
  { label: "news", pattern: /\bnews\b/i, weight: 1 },
  { label: "election", pattern: /\belection(?:s)?\b/i, weight: 1 },
  { label: "government", pattern: /\bgovernment\b/i, weight: 1 },
  { label: "course", pattern: /\bcourse\b/i, weight: 1 },
  { label: "tutorial", pattern: /\btutorial\b/i, weight: 1 },
  { label: "training", pattern: /\btraining\b/i, weight: 1 },
  { label: "best CNC machine", pattern: /\bbest cnc machine\b/i, weight: 1 },
  { label: "which CNC should I buy", pattern: /\bwhich cnc should i buy\b/i, weight: 1 },
  { label: "how to start a CNC business", pattern: /\bhow to start a cnc business\b/i, weight: 1 },
  { label: "how to get clients", pattern: /\bhow to get clients\b/i, weight: 1 },
  { label: "we offer", pattern: /\bwe offer\b/i, weight: 1 },
  { label: "our services", pattern: /\bour services\b/i, weight: 1 },
  { label: "CNC services", pattern: /\bcnc services\b/i, weight: 1 },
  { label: "supplier page", pattern: /\bsupplier\b/i, weight: 0.6 },
  { label: "service page", pattern: /\bservices?\b/i, weight: 0.6 },
  { label: "SEO page", pattern: /\bseo\b/i, weight: 0.7 },
  { label: "company advertising", pattern: /\bcompany\b/i, weight: 0.4 },
  { label: "generic custom product", pattern: /\bcustom product\b/i, weight: 0.8 },
];

function collectSignalMatches(text: string, entries: SignalEntry[]) {
  const matches: string[] = [];
  for (const entry of entries) {
    if (entry.pattern.test(text)) {
      matches.push(entry.label);
    }
  }
  return uniq(matches);
}

function sumSignalWeights(text: string, entries: SignalEntry[]) {
  return entries.reduce((total, entry) => (entry.pattern.test(text) ? total + entry.weight : total), 0);
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}

function summarizeProblemSignals(intent: PreleadIntent) {
  const priority = [
    ...intent.physical_part_signals,
    ...intent.need_signals,
    ...intent.machining_signals,
  ];

  for (const label of [
    "replacement part",
    "custom part",
    "prototype",
    "small batch",
    "CAD",
    "drawing",
    "bracket",
    "plate",
    "spacer",
    "housing",
    "adapter",
    "shaft",
    "bushing",
    "mount",
    "fixture",
    "jig",
    "flange",
    "panel",
    "gear",
    "pulley",
    "clamp",
    "rail",
    "block",
    "manifold",
  ]) {
    if (priority.includes(label)) {
      return label;
    }
  }

  return priority[0] ?? "custom machined part";
}

function classifyPreleadIntent(candidate: { title: string; snippet: string; source?: string; source_url?: string }): PreleadIntent {
  const text = `${candidate.title} ${candidate.snippet}`;
  const machiningSignals = collectSignalMatches(text, machiningSignalEntries);
  const physicalPartSignals = collectSignalMatches(text, physicalPartSignalEntries);
  const needSignals = collectSignalMatches(text, needSignalEntries);
  const supplierSignals = collectSignalMatches(text, supplierAdSignalEntries);
  const businessSignals = collectSignalMatches(text, businessAdviceSignalEntries);
  const machineSignals = collectSignalMatches(text, machinePurchaseSignalEntries);
  const discussionSignals = collectSignalMatches(text, generalDiscussionSignalEntries);
  const negativeSignals = collectSignalMatches(text, negativeSignalEntries);
  const bannedSignals = collectSignalMatches(text, bannedKeywordEntries);

  const hasSupplierAd = supplierSignals.length > 0;
  const hasBusinessAdvice = businessSignals.length > 0 && !hasSupplierAd;
  const hasMachinePurchase = machineSignals.length > 0 && !hasSupplierAd && !hasBusinessAdvice;

  const positiveWeight = sumSignalWeights(text, [...machiningSignalEntries, ...physicalPartSignalEntries, ...needSignalEntries]);
  const negativeWeight = sumSignalWeights(text, negativeSignalEntries);
  const combinedConfidence = clampConfidence(0.08 + positiveWeight - Math.min(0.45, negativeWeight * 0.35));

  let intent_type: PreleadIntentType = "unknown";
  let confidence = combinedConfidence;

  if (bannedSignals.length > 0 || hasSupplierAd) {
    intent_type = "supplier_ad";
    confidence = clampConfidence(Math.max(0.6, negativeWeight));
  } else if (hasBusinessAdvice) {
    intent_type = "business_advice";
    confidence = clampConfidence(Math.max(0.58, negativeWeight));
  } else if (hasMachinePurchase) {
    intent_type = "machine_purchase";
    confidence = clampConfidence(Math.max(0.58, negativeWeight));
  } else if (machiningSignals.length > 0 && physicalPartSignals.length > 0 && needSignals.length > 0) {
    intent_type = "buyer_problem";
    confidence = clampConfidence(Math.max(combinedConfidence, Math.min(0.98, 0.38 + positiveWeight)));
  } else if (discussionSignals.length > 0) {
    intent_type = "general_discussion";
    confidence = clampConfidence(Math.max(0.2, combinedConfidence * 0.6));
  }

  return {
    intent_type,
    machining_signals: machiningSignals,
    physical_part_signals: physicalPartSignals,
    need_signals: needSignals,
    negative_signals: negativeSignals,
    confidence,
  };
}

function isTruthy(value: string | undefined) {
  return Boolean(value && /^(1|true|yes|on)$/i.test(value.trim()));
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

  const appOnly: RedditAuthConfig = {
    mode: "app-only",
    clientId,
    clientSecret,
    userAgent,
  };

  if (username && password) {
    return [
      {
        mode: "script",
        clientId,
        clientSecret,
        userAgent,
        username,
        password,
      },
      appOnly,
    ];
  }

  return [appOnly];
}

function hasRedditAuth() {
  return getRedditAuthCandidates().length > 0;
}

function redditAuthCacheKey(auth: RedditAuthConfig) {
  return [auth.mode, auth.clientId, auth.username ?? "", auth.userAgent].join("|");
}

async function fetchRedditAccessToken(auth: RedditAuthConfig, logger: Logger) {
  const body = new URLSearchParams({
    grant_type: auth.mode === "script" ? "password" : "client_credentials",
    scope: "read",
  });

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
    logger.warn(`Reddit token request failed (${auth.mode}): HTTP ${response.status}${text ? ` - ${text.slice(0, 160)}` : ""}`);
    return null;
  }

  const json = (await response.json().catch(() => null)) as
    | { access_token?: unknown; expires_in?: unknown }
    | null;

  const accessToken = typeof json?.access_token === "string" ? json.access_token : null;
  const expiresIn = typeof json?.expires_in === "number" ? json.expires_in : 0;

  if (!accessToken) {
    logger.warn(`Reddit token response missing access_token (${auth.mode})`);
    return null;
  }

  const cacheKey = redditAuthCacheKey(auth);
  redditTokenCache = {
    cacheKey,
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };

  return accessToken;
}

async function getRedditAccessToken(logger: Logger) {
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

function buildRedditSearchUrl(subreddit: string, query: string) {
  const params = new URLSearchParams({
    q: query,
    restrict_sr: "1",
    sort: "new",
    t: "all",
    limit: "25",
    raw_json: "1",
    type: "link",
  });

  return `${REDDIT_API_BASE}/r/${encodeURIComponent(subreddit)}/search?${params.toString()}`;
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

function detectKeywords(text: string, intent?: PreleadIntent) {
  const keywords: string[] = [];

  if (ukPatterns.some((pattern) => pattern.test(text)) || ukCityRegionPatterns.some((pattern) => pattern.test(text))) keywords.push("UK mention");
  if (intent?.intent_type === "buyer_problem") keywords.push("buyer problem");
  if (intent?.physical_part_signals.includes("replacement part")) keywords.push("replacement part");
  if (intent?.physical_part_signals.some((signal) => ["bracket", "spacer", "plate", "housing", "adapter"].includes(signal))) keywords.push("physical part");
  if (intent?.physical_part_signals.includes("prototype")) keywords.push("prototype");
  if (intent?.need_signals.includes("small batch")) keywords.push("small batch");
  if (intent?.need_signals.some((signal) => ["CAD", "drawing"].includes(signal))) keywords.push("CAD/drawing mention");
  if (intent?.machining_signals.length) keywords.push("machining mention");
  if (cadPatterns.some((pattern) => pattern.test(text))) keywords.push("CAD/STEP/DXF/drawing mention");
  if (materialPatterns.some((pattern) => pattern.test(text))) keywords.push("material mention");
  if (quantityPatterns.some((pattern) => pattern.test(text))) keywords.push("quantity/small batch mention");
  if (automotivePatterns.some((pattern) => pattern.test(text))) keywords.push("automotive/prototype/restoration mention");
  if (studentPatterns.some((pattern) => pattern.test(text))) keywords.push("student/homework");
  if (threeDPrintOnlyPatterns.some((pattern) => pattern.test(text))) keywords.push("pure 3D printing only");
  if (freeBudgetPatterns.some((pattern) => pattern.test(text))) keywords.push("free/no budget wording");
  if (intent?.intent_type && intent.intent_type !== "buyer_problem") keywords.push(`intent:${intent.intent_type}`);

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

function calculateLeadScore(text: string, locationSignal: LocationSignal, intent?: PreleadIntent) {
  let score = 0;

  const analysis = intent ?? classifyPreleadIntent({ title: text, snippet: text });

  if (analysis.intent_type === "buyer_problem") score += Math.round(analysis.confidence * 10);
  if (analysis.intent_type === "supplier_ad") score -= 18;
  if (analysis.intent_type === "business_advice") score -= 14;
  if (analysis.intent_type === "machine_purchase") score -= 14;
  if (analysis.intent_type === "general_discussion") score -= 6;
  if (locationSignal === "uk") score += 5;
  if (locationSignal === "outside_uk") score -= 20;
  score += Math.min(6, analysis.machining_signals.length * 2);
  score += Math.min(6, analysis.physical_part_signals.length * 2);
  score += Math.min(4, analysis.need_signals.length * 1.5);
  if (analysis.negative_signals.length) score -= Math.min(8, analysis.negative_signals.length);

  return Math.round(score);
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

function parsePreleadSourcesInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((entry) => (typeof entry === "string" ? [entry] : []));
      }
    } catch {
      // fall through to delimiter parsing
    }
  }

  return trimmed
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSourceEntry(entry: string): SourceEntry | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("|")) {
    const [source, url] = trimmed.split("|", 2).map((part) => part.trim());
    const normalized = normalizeUrl(url);
    return source && normalized ? { source, url: normalized, kind: "url" } : null;
  }

  const normalized = normalizeUrl(trimmed);
  return normalized
    ? { source: new URL(normalized).hostname.replace(/^www\./, ""), url: normalized, kind: "url" }
    : null;
}

function buildBuiltinRedditSources(limit: number): SourceEntry[] {
  const sources: SourceEntry[] = [];

  for (const subreddit of BUILTIN_SUBREDDITS) {
    for (const query of BUILTIN_QUERIES) {
      sources.push({
        source: `reddit:r/${subreddit} ${query}`,
        kind: "reddit-search",
        subreddit,
        query,
        url: buildRedditSearchUrl(subreddit, query),
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

    parsed.protocol = "https:";
    parsed.hostname = "oauth.reddit.com";
    parsed.pathname = parsed.pathname.replace(/\.json$/i, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

async function loadSources(logger: Logger): Promise<SourceEntry[]> {
  const envSources = process.env.PRELEAD_SOURCES ? parsePreleadSourcesInput(process.env.PRELEAD_SOURCES) : [];
  const sourcesFromEnv = envSources.map(parseSourceEntry).filter(Boolean) as SourceEntry[];
  const maxResults = Number(process.env.PRELEAD_MAX_RESULTS ?? DEFAULT_MAX_RESULTS);
  const redditAuthAvailable = hasRedditAuth();
  const builtinSources = redditAuthAvailable ? buildBuiltinRedditSources(maxResults) : [];

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

  const merged = dedupeSources([...builtinSources, ...fileSources, ...sourcesFromEnv])
    .filter((source) => redditAuthAvailable || !isRedditUrl(source.url))
    .slice(0, maxResults);
  logger.info(`Loaded built-in Reddit sources: ${builtinSources.length}`);
  if (!redditAuthAvailable) {
    logger.warn("Reddit env vars missing; skipping Reddit sources.");
  }
  logger.info(`Loaded PRELEAD_SOURCES from file/env: ${fileSources.length + sourcesFromEnv.length}`);
  logger.info(`Total sources scheduled this run: ${merged.length} (max ${maxResults})`);
  logger.debug("Loaded PRELEAD_SOURCES", merged);
  return merged;
}

function buildSuggestedReply(prelead: Omit<Prelead, "suggested_reply">, problemSummary: string) {
  const intro = prelead.detected_keywords.includes("UK mention") ? "Hi —" : "Hello —";
  const materialNote = prelead.detected_materials.length ? ` I noticed ${prelead.detected_materials.join(", ")} in the mix.` : "";

  return [
    `${intro} this looks like a custom machining problem rather than an off-the-shelf part.${materialNote}`,
    `If you have a sketch, photo, CAD file, material preference, rough quantity, and any tolerance notes for the ${problemSummary}, I can help point you toward a suitable UK machining partner.`,
    "If it's just an idea so far, that's fine too — a rough outline is enough to start.",
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
  const intent = classifyPreleadIntent({ source: source.source, source_url: url, title, snippet: text });
  const detectedKeywords = uniq([
    ...detectKeywords(combined, intent),
    `intent:${intent.intent_type}`,
    `intent_confidence:${intent.confidence.toFixed(2)}`,
    `problem_summary:${summarizeProblemSignals(intent)}`,
  ]);
  const detectedMaterials = detectMaterials(combined);
  const locationSignal = detectLocationSignal(combined);
  const leadScore = calculateLeadScore(combined, locationSignal, intent);
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
    suggested_reply: buildSuggestedReply(prelead, summarizeProblemSignals(intent)),
  };
}

function analyzeRawCandidate(candidate: RawPreleadCandidate) {
  const createdAt = candidate.published_at && !Number.isNaN(new Date(candidate.published_at).getTime())
    ? new Date(candidate.published_at).toISOString()
    : new Date().toISOString();

  const source: SourceEntry = {
    source: candidate.source,
    url: candidate.source_url,
    kind: "url",
  };

  const intent = classifyPreleadIntent({ source: candidate.source, source_url: candidate.source_url, title: candidate.title, snippet: candidate.snippet });
  const problemSummary = summarizeProblemSignals(intent);
  const lead = fromPlainText(source, candidate.snippet?.trim() || candidate.title, candidate.title, candidate.source_url, createdAt, null);

  return { lead, intent, problemSummary };
}

function getCandidateText(lead: Pick<Prelead, "title" | "snippet">) {
  return `${lead.title} ${lead.snippet}`;
}

function getCandidateRejectionReason(lead: Prelead, intent: PreleadIntent, includeOutsideUk: boolean) {
  const text = getCandidateText(lead);
  const bannedSignals = collectSignalMatches(text, bannedKeywordEntries);

  if (lead.location_signal === "outside_uk" && !includeOutsideUk) return "outside_uk";
  if (bannedSignals.length > 0) return "banned_keyword";
  if (intent.intent_type === "supplier_ad") return "supplier_ad";
  if (intent.intent_type === "business_advice") return "business_advice";
  if (intent.intent_type === "machine_purchase") return "machine_purchase";
  if (intent.intent_type !== "buyer_problem") return "no_problem_signal";
  if (intent.confidence < 0.7) return "no_need_signal";
  if (intent.machining_signals.length === 0) return "no_machining_signal";
  if (intent.physical_part_signals.length === 0) return "no_part_signal";
  if (intent.need_signals.length === 0) return "no_need_signal";

  return null;
}

function getPreAiHardRejectReason(lead: Prelead, intent: PreleadIntent) {
  const text = getCandidateText(lead);
  const bannedSignals = collectSignalMatches(text, bannedKeywordEntries);

  if (lead.location_signal === "outside_uk") return "outside_uk";
  if (intent.intent_type === "supplier_ad") return "supplier_ad";
  if (intent.intent_type === "business_advice") return "business_advice";
  if (intent.intent_type === "machine_purchase") return "machine_purchase";

  if (bannedSignals.some((signal) => ["job", "hiring", "salary", "career"].includes(signal))) return "job";
  if (bannedSignals.some((signal) => ["politics", "news", "election", "government"].includes(signal))) return "politics_news";
  if (
    bannedSignals.some((signal) =>
      ["mattress", "sofa", "bed", "furniture", "clothes", "clothing", "fashion", "upholstery", "home decor", "t-shirt", "print on demand"].includes(signal)
    )
  ) {
    return "mattress_furniture";
  }

  return null;
}

function isFinalAiApprovedLead(lead: Pick<Prelead, "location_signal">, classification: AiPreleadClassification, minConfidence: number) {
  return classification.is_lead && classification.confidence >= minConfidence && (lead.location_signal === "uk" || lead.location_signal === "unknown");
}

function incrementReasonCount(counts: Map<string, number>, reason: string) {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
}

function topReasonCounts(counts: Map<string, number>, limit = 5) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([reason, count]) => ({ reason, count }));
}

function qualifiesPrelead(lead: Prelead, intent: PreleadIntent, includeOutsideUk: boolean, minScore: number) {
  return (
    getCandidateRejectionReason(lead, intent, includeOutsideUk) === null &&
    intent.intent_type === "buyer_problem" &&
    intent.confidence >= 0.7 &&
    intent.machining_signals.length > 0 &&
    intent.physical_part_signals.length > 0 &&
    intent.need_signals.length > 0 &&
    lead.lead_score >= minScore
  );
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

function collectRedditItems(payload: unknown, logger: Logger): FetchedItem[] {
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
    if (typeof typed.permalink !== "string" || !typed.permalink.trim()) {
      return;
    }

    if (typeof typed.url === "string" && /preview\.redd\.it|i\.redd\.it|redditmedia\.com/i.test(typed.url)) {
      return;
    }

    const fullUrl = `https://www.reddit.com${typed.permalink}`;
    logger.debug("Clean Reddit URL:", fullUrl);

    const text = [title, body].filter(Boolean).join(" ").trim();
    items.push({ title, body: text, url: fullUrl, sourceUrl: fullUrl, author, createdAt });
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
  const isRedditSource = source.kind === "reddit-search" || isRedditUrl(source.url);
  const fetchUrl = isRedditSource ? (source.kind === "reddit-search" ? source.url : redditJsonUrl(source.url)) : source.url;
  const isJson = isRedditSource || fetchUrl.endsWith(".json");

  if (isRedditSource && !hasRedditAuth()) {
    logger.warn(`Skipping ${source.source}: Reddit env vars missing`);
    return [];
  }

  if (isRedditSource && fetchUrl !== source.url) {
    logger.debug(`Converted Reddit URL to OAuth API: ${source.url} -> ${fetchUrl}`);
  }

  logger.debug(`Fetching source ${source.source}`, { fetchUrl });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const redditToken = isRedditSource ? await getRedditAccessToken(logger) : null;
    if (isRedditSource && !redditToken) {
      logger.warn(`Skipping ${source.source}: unable to get Reddit OAuth token`);
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
        const items = collectRedditItems(parsed, logger);
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

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  const typed = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return [
    typeof typed.message === "string" ? typed.message : undefined,
    typeof typed.code === "string" ? `code=${typed.code}` : undefined,
    typeof typed.details === "string" ? `details=${typed.details}` : undefined,
    typeof typed.hint === "string" ? `hint=${typed.hint}` : undefined,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function saveToSupabase(leads: Prelead[], logger: Logger) {
  if (leads.length === 0) {
    return 0;
  }

  try {
    const envStatus = getSupabaseAdminEnvStatus();
    logger.debug(`Supabase URL present: ${envStatus.urlPresent ? "yes" : "no"}`);
    logger.debug(`Service role key present: ${envStatus.serviceRoleKeyPresent ? "yes" : "no"}`);

    const supabase = createSupabaseAdminClient();
    const sourceUrls = leads.map((lead) => lead.source_url);
    const { data: existing, error: selectError } = await supabase
      .from("pre_leads")
      .select("source_url")
      .in("source_url", sourceUrls);

    if (selectError) {
      throw selectError;
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
      throw error;
    }

    return freshLeads.length;
  } catch (error) {
    logger.warn(`Supabase save skipped: ${formatSupabaseError(error)}`);
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
  const aiConfig = getAiPreleadClassifierConfig();
  const {
    persistJson = true,
    persistSupabase = true,
    sendEmail = true,
    minScore = Number(process.env.PRELEAD_MIN_SCORE ?? 6),
    requestDelayMs = Number(process.env.PRELEAD_DELAY_MS ?? 750),
    outputPath = OUTPUT_PATH,
  } = options;

  logger.info(`Debug mode: ${debugEnabled ? "on" : "off"}`);
  logger.info(`Include outside-UK leads: ${includeOutsideUk ? "on" : "off"}`);
  if (debugEnabled) {
    logger.info(`AI classifier enabled: ${aiConfig.enabled ? "yes" : "no"}`);
    logger.info(`OpenAI API key present: ${aiConfig.apiKeyPresent ? "yes" : "no"}`);
    logger.info(`AI max candidates: ${aiConfig.maxCandidates}`);
    logger.info(`AI min confidence: ${aiConfig.minConfidence}`);
  }
  const useAiPipeline = aiConfig.enabled && Boolean(aiConfig.apiKey);
  const adapters = buildEnabledPreleadAdapters(logger);
  if (adapters.length === 0) {
    throw new Error("No prelead adapters enabled");
  }

  logger.info(`enabled adapters: ${adapters.map((adapter) => adapter.name).join(", ")}`);

  const rawCandidates: RawPreleadCandidate[] = [];
  const seenCandidateUrls = new Set<string>();
  let duplicateCandidatesSkipped = 0;

  for (const adapter of adapters) {
    await sleep(requestDelayMs);

    try {
      const candidates = await adapter.fetchCandidates();
      logger.info(`${adapter.name}: fetched ${candidates.length} candidates`);

      for (const candidate of candidates) {
        const url = candidate.source_url.trim();
        if (!url) {
          continue;
        }

        if (seenCandidateUrls.has(url)) {
          duplicateCandidatesSkipped += 1;
          continue;
        }

        seenCandidateUrls.add(url);
        rawCandidates.push(candidate);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`${adapter.name}: ${message}`);
    }
  }

  const scoredCandidates = rawCandidates.map(analyzeRawCandidate);
  const rawCandidateByUrl = new Map(rawCandidates.map((candidate) => [candidate.source_url, candidate]));
  const scoredLeads = scoredCandidates.map(({ lead }) => lead);
  const topScored = [...scoredLeads].sort((a, b) => b.lead_score - a.lead_score || a.created_at.localeCompare(b.created_at));
  const orderedScoredCandidates = [...scoredCandidates].sort(
    (a, b) => b.lead.lead_score - a.lead.lead_score || a.lead.created_at.localeCompare(b.lead.created_at)
  );
  const preAiRejectionBuckets: Record<PreAiHardRejectReason, Prelead[]> = {
    supplier_ad: [],
    job: [],
    politics_news: [],
    mattress_furniture: [],
    outside_uk: [],
    machine_purchase: [],
    business_advice: [],
  };
  const preAiRejectedReasonCounts = new Map<string, number>();
  const aiRejectedReasonCounts = new Map<string, number>();
  const aiDecisionByUrl = new Map<string, {
    ai_is_lead: boolean | null;
    ai_confidence: number | null;
    ai_reason: string | null;
    rejection_reason: string | null;
  }>();
  const preAiCandidates: Array<{ lead: Prelead; intent: PreleadIntent }> = [];
  const leads: Prelead[] = [];
  let aiCandidateUrls = new Set<string>();
  let aiCandidatesSent = 0;
  let aiAcceptedCount = 0;
  let aiRejectedCount = 0;

  for (const { lead, intent } of orderedScoredCandidates) {
    const preAiHardRejectReason = useAiPipeline ? getPreAiHardRejectReason(lead, intent) : null;

    if (debugEnabled) {
      logger.debug(
        `title=${lead.title} intent_type=${intent.intent_type} confidence=${intent.confidence.toFixed(2)} machining_signals=${intent.machining_signals.join('; ') || 'none'} physical_part_signals=${intent.physical_part_signals.join('; ') || 'none'} need_signals=${intent.need_signals.join('; ') || 'none'} negative_signals=${intent.negative_signals.join('; ') || 'none'} pre_ai_reject_reason=${preAiHardRejectReason ?? 'none'}`
      );
    }

    if (preAiHardRejectReason) {
      preAiRejectionBuckets[preAiHardRejectReason].push(lead);
      incrementReasonCount(preAiRejectedReasonCounts, preAiHardRejectReason);
      continue;
    }

    preAiCandidates.push({ lead, intent });
  }

  if (useAiPipeline) {
    const aiCandidates = preAiCandidates.slice(0, aiConfig.maxCandidates).map((entry) => ({
      source_url: entry.lead.source_url,
      title: entry.lead.title,
      snippet: entry.lead.snippet,
      detected_keywords: entry.lead.detected_keywords,
      detected_materials: entry.lead.detected_materials,
      location_signal: entry.lead.location_signal,
      lead_score: entry.lead.lead_score,
      suggested_reply: entry.lead.suggested_reply,
    }));
    aiCandidateUrls = new Set(aiCandidates.map((candidate) => candidate.source_url));
    aiCandidatesSent = aiCandidates.length;

    if (debugEnabled) {
      logger.info(`estimated classifier calls: ${aiCandidates.length}`);
      logger.info(`candidates sent to AI: ${aiCandidates.length}`);
    }

    const aiResults = await classifyPreleadCandidatesWithAI(aiCandidates, logger);

    if (aiResults) {
      const accepted = [] as typeof aiResults;
      const rejected = [] as typeof aiResults;

      for (const { candidate, classification } of aiResults) {
        const approved = isFinalAiApprovedLead(candidate, classification, aiConfig.minConfidence);
        const rejectionReason = approved
          ? null
          : !classification.is_lead
            ? classification.reason || 'ai_rejected'
            : classification.confidence < aiConfig.minConfidence
              ? 'below_min_confidence'
              : candidate.location_signal === 'outside_uk'
                ? 'outside_uk'
                : 'ai_rejected';

        aiDecisionByUrl.set(candidate.source_url, {
          ai_is_lead: classification.is_lead,
          ai_confidence: classification.confidence,
          ai_reason: classification.reason,
          rejection_reason: rejectionReason,
        });

        if (approved) {
          accepted.push({ candidate, classification });
          continue;
        }

        rejected.push({ candidate, classification });
        incrementReasonCount(aiRejectedReasonCounts, rejectionReason ?? 'ai_rejected');
      }

      aiAcceptedCount = accepted.length;
      aiRejectedCount = rejected.length;

      const acceptedByUrl = new Map(
        accepted.map(({ candidate, classification }) => [candidate.source_url, classification])
      );

      leads.push(
        ...preAiCandidates
          .map(({ lead }) => lead)
          .filter((lead) => acceptedByUrl.has(lead.source_url))
          .map((lead) => {
            const aiClassification = acceptedByUrl.get(lead.source_url);
            return aiClassification?.suggested_reply
              ? { ...lead, suggested_reply: aiClassification.suggested_reply }
              : lead;
          })
      );

      if (debugEnabled) {
        logger.info(`AI accepted count: ${accepted.length}`);
        logger.info(`AI rejected count: ${rejected.length}`);
        logger.debug(
          'top accepted candidates:',
          accepted.slice(0, 5).map(({ candidate, classification }) => ({
            title: candidate.title,
            confidence: classification.confidence,
            problem_type: classification.problem_type,
            reason: classification.reason,
          }))
        );
        logger.debug(
          'top rejected candidates:',
          rejected.slice(0, 5).map(({ candidate, classification }) => ({
            title: candidate.title,
            confidence: classification.confidence,
            reason: classification.reason,
          }))
        );
      }
    } else {
      aiRejectedCount = aiCandidates.length;
      for (const candidate of aiCandidates) {
        aiDecisionByUrl.set(candidate.source_url, {
          ai_is_lead: null,
          ai_confidence: null,
          ai_reason: 'AI unavailable; no final AI decision was recorded.',
          rejection_reason: 'ai_unavailable',
        });
      }
    }
  } else if (!aiConfig.enabled) {
    const heuristicRejectionBuckets: Record<
      "supplier_ad" | "business_advice" | "machine_purchase" | "no_machining_signal" | "no_part_signal" | "no_need_signal" | "outside_uk" | "banned_keyword",
      Prelead[]
    > = {
      supplier_ad: [],
      business_advice: [],
      machine_purchase: [],
      no_machining_signal: [],
      no_part_signal: [],
      no_need_signal: [],
      outside_uk: [],
      banned_keyword: [],
    };

    for (const { lead, intent } of preAiCandidates) {
      const rejectionReason = getCandidateRejectionReason(lead, intent, includeOutsideUk);

      if (rejectionReason) {
        if (rejectionReason in heuristicRejectionBuckets) {
          heuristicRejectionBuckets[rejectionReason as keyof typeof heuristicRejectionBuckets].push(lead);
        }
        continue;
      }

      if (!qualifiesPrelead(lead, intent, includeOutsideUk, minScore)) {
        heuristicRejectionBuckets.no_need_signal.push(lead);
        continue;
      }

      leads.push(lead);
    }

    leads.sort((a, b) => b.lead_score - a.lead_score || a.created_at.localeCompare(b.created_at));
  } else {
    logger.warn("AI classifier is enabled but OPENAI_API_KEY is missing; skipping AI classification.");
  }

  logger.info(`AI classifier enabled: ${aiConfig.enabled ? 'yes' : 'no'}`);
  logger.info(`candidates sent to AI: ${aiCandidatesSent}`);
  logger.info(`AI accepted: ${aiAcceptedCount}`);
  logger.info(`AI rejected: ${aiRejectedCount}`);

  logger.info(`total candidates: ${rawCandidates.length}`);
  logger.info(`scored: ${scoredLeads.length}`);
  logger.info(`qualifying: ${leads.length}`);

  if (debugEnabled) {
    logger.info(`skipped duplicates: ${duplicateCandidatesSkipped}`);
    logger.debug(
      "top 5 candidate titles + scores:",
      topScored.slice(0, 5).map((lead) => ({ title: lead.title, score: lead.lead_score, source_url: lead.source_url }))
    );
    logger.debug("top 5 pre-AI rejection reasons:", topReasonCounts(preAiRejectedReasonCounts));
    logger.debug("top 5 AI rejected reasons:", topReasonCounts(aiRejectedReasonCounts));
  }

  if (useAiPipeline && aiCandidateUrls.size > 0) {
    const finalLeadUrls = new Set(leads.map((lead) => lead.source_url));
    const learningRows = preAiCandidates
      .map(({ lead }) => lead)
      .filter((lead) => aiCandidateUrls.has(lead.source_url))
      .map((lead) => {
        const rawCandidate = rawCandidateByUrl.get(lead.source_url);
        const aiDecision = aiDecisionByUrl.get(lead.source_url);

        return {
          id: createPreleadLearningLogId(lead.source_url, lead.created_at),
          created_at: lead.created_at,
          source: lead.source,
          query_used: rawCandidate?.query_used ?? null,
          source_url: lead.source_url,
          title: lead.title,
          snippet: lead.snippet,
          initial_score: lead.lead_score,
          location_signal: lead.location_signal,
          classifier_enabled: true,
          ai_is_lead: aiDecision?.ai_is_lead ?? null,
          ai_confidence: aiDecision?.ai_confidence ?? null,
          ai_reason: aiDecision?.ai_reason ?? null,
          rejection_reason: aiDecision?.rejection_reason ?? null,
          inserted_to_pre_leads: finalLeadUrls.has(lead.source_url),
          human_label: null,
          human_notes: null,
        };
      });

    try {
      const wroteLearningLog = await appendPreleadLearningLog(learningRows);
      if (debugEnabled && wroteLearningLog) {
        logger.info(`learning log rows written: ${learningRows.length}`);
      }
    } catch (error) {
      logger.warn(`Learning log write skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let savedToSupabase = 0;
  if (persistSupabase) {
    savedToSupabase = await saveToSupabase(leads, logger);
  }
  logger.info(`inserted: ${savedToSupabase}`);

  let savedToJson = false;
  const allowJsonOutput = persistJson && process.env.NODE_ENV !== "production";
  if (persistJson && !allowJsonOutput) {
    logger.info("Skipping JSON output in production.");
  }
  if (allowJsonOutput) {
    try {
      await saveToJson(leads, outputPath);
      savedToJson = true;
    } catch (error) {
      logger.warn(`JSON output skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let emailed = false;
  if (sendEmail && leads.length > 0) {
    emailed = await sendPreleadSummaryEmail(leads);
  }

  return {
    scanned: adapters.length,
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

void loadSources;
void fetchSourceItems;
