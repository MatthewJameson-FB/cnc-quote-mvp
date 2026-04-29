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
import { inferLocationSignal, type LocationInferenceResult, type LocationSignal } from "@/lib/prelead-location";
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
  location_confidence: number;
  location_reasons: string[];
  lead_score: number;
  suggested_reply: string;
  created_at: string;
  has_file?: boolean;
  has_photos?: boolean;
  stage?: LeadStage;
  manufacturing_type?: ManufacturingType;
  file_url?: string;
  photo_urls?: string[];
  measurements?: string;
  description?: string;
  routing_decision?: LeadRoute;
  part_candidate?: boolean;
  intake_validation_reason?: string | null;
};

type LeadStage = "needs_file" | "needs_print" | "needs_both" | "unknown";

type ManufacturingType = "3d_print" | "cnc" | "fabrication" | "unknown";

type LeadRoute = "cad_required" | "3d_print" | "cnc" | "cad_then_route" | "review";

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
const photoHintPatterns = [
  /\bphoto(?:s)?\b/i,
  /\bpicture(?:s)?\b/i,
  /\bimage(?:s)?\b/i,
  /\bsee (?:photo|picture|image|pics)\b/i,
  /\battached (?:photo|picture|image|pics)\b/i,
  /\bhere(?:'s| is) (?:a )?(?:photo|picture|image|pic)\b/i,
  /\bfrom (?:these|the) photo(?:s)?\b/i,
];
const measurementPatterns = [
  /\b\d+(?:\.\d+)?\s?(?:mm|millimeters?|cm|centimeters?|m|meters?|in|inch(?:es)?|"|')\b/gi,
  /\b\d+(?:\.\d+)?\s?[x×]\s?\d+(?:\.\d+)?(?:\s?[x×]\s?\d+(?:\.\d+)?)?\s?(?:mm|cm|m|in|inch(?:es)?|"|')?\b/gi,
  /\b(?:diameter|radius|length|width|height|depth|thickness|tolerance)\s*[:=]?\s*\d+(?:\.\d+)?\s?(?:mm|cm|m|in|inch(?:es)?|"|')\b/gi,
];
const fileUrlPattern = /https?:\/\/\S+\.(?:stl|step|stp|dxf|dwg|obj|3mf|iges|igs|x_t|sldprt|pdf)(?:\?\S*)?/i;
const photoUrlPattern = /https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/gi;

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
  | "tutorial_course"
  | "machine_purchase"
  | "business_advice";

type FinalRejectionReason =
  | "ai_confidence_too_low"
  | "missing_problem_signal"
  | "outside_uk"
  | "duplicate"
  | "hard_reject";

type PreleadIntent = {
  intent_type: PreleadIntentType;
  machining_signals: string[];
  three_d_print_signals: string[];
  make_intent_signals: string[];
  file_signals: string[];
  physical_part_signals: string[];
  need_signals: string[];
  negative_signals: string[];
  confidence: number;
};

const THREE_D_PRINT_SIGNALS = [
  "3d print",
  "printed",
  "stl",
  "filament",
  "pla",
  "abs",
  "resin",
  "printer",
  "slice",
  "model file",
] as const;

const MAKE_INTENT_SIGNALS = [
  "make this",
  "get this made",
  "custom part",
  "replacement part",
  "lost part",
  "broken part",
  "who can make",
  "anyone able to",
  "need this made",
] as const;

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

const threeDPrintSignalEntries: SignalEntry[] = [
  { label: "3d print", pattern: /\b3d print(?:ing|ed)?\b/i, weight: 0.22 },
  { label: "printed", pattern: /\bprinted\b/i, weight: 0.12 },
  { label: "stl", pattern: /\bstl\b/i, weight: 0.2 },
  { label: "filament", pattern: /\bfilament\b/i, weight: 0.12 },
  { label: "pla", pattern: /\bpla\b/i, weight: 0.12 },
  { label: "abs", pattern: /\babs\b/i, weight: 0.12 },
  { label: "resin", pattern: /\bresin\b/i, weight: 0.12 },
  { label: "printer", pattern: /\bprinter\b/i, weight: 0.1 },
  { label: "slice", pattern: /\bslic(?:e|ing|er)\b/i, weight: 0.1 },
  { label: "model file", pattern: /\bmodel file\b/i, weight: 0.16 },
];

const makeIntentSignalEntries: SignalEntry[] = [
  { label: "make this", pattern: /\bmake this\b/i, weight: 0.2 },
  { label: "get this made", pattern: /\bget this made\b/i, weight: 0.22 },
  { label: "custom part", pattern: /\bcustom part\b/i, weight: 0.18 },
  { label: "replacement part", pattern: /\breplacement part\b/i, weight: 0.2 },
  { label: "lost part", pattern: /\blost part\b/i, weight: 0.18 },
  { label: "broken part", pattern: /\bbroken part\b/i, weight: 0.18 },
  { label: "who can make", pattern: /\bwho can make\b/i, weight: 0.2 },
  { label: "anyone able to", pattern: /\banyone able to\b/i, weight: 0.18 },
  { label: "need this made", pattern: /\bneed this made\b/i, weight: 0.22 },
];

const fileSignalEntries: SignalEntry[] = [
  { label: "stl", pattern: /\bstl\b/i, weight: 0.2 },
  { label: "cad", pattern: /\bcad\b/i, weight: 0.18 },
  { label: "drawing", pattern: /\bdrawing\b/i, weight: 0.16 },
  { label: "step", pattern: /\bstep\b/i, weight: 0.18 },
  { label: "stp", pattern: /\bstp\b/i, weight: 0.16 },
  { label: "dxf", pattern: /\bdxf\b/i, weight: 0.16 },
  { label: "dwg", pattern: /\bdwg\b/i, weight: 0.16 },
  { label: "model file", pattern: /\bmodel file\b/i, weight: 0.16 },
  { label: "file", pattern: /\bfile\b/i, weight: 0.08 },
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
    ...intent.make_intent_signals,
    ...intent.file_signals,
    ...intent.three_d_print_signals,
    ...intent.physical_part_signals,
    ...intent.need_signals,
    ...intent.machining_signals,
  ];

  for (const label of [
    "replacement part",
    "lost part",
    "broken part",
    "custom part",
    "prototype",
    "3d print",
    "stl",
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
  const threeDPrintSignals = collectSignalMatches(text, threeDPrintSignalEntries);
  const makeIntentSignals = collectSignalMatches(text, makeIntentSignalEntries);
  const fileSignals = collectSignalMatches(text, fileSignalEntries);
  const physicalPartSignals = collectSignalMatches(text, physicalPartSignalEntries);
  const needSignals = collectSignalMatches(text, needSignalEntries);
  const directRequestNeedSignals = needSignals.filter((signal) => !weakNeedSignals.has(signal));
  const supplierSignals = collectSignalMatches(text, supplierAdSignalEntries);
  const businessSignals = collectSignalMatches(text, businessAdviceSignalEntries);
  const machineSignals = collectSignalMatches(text, machinePurchaseSignalEntries);
  const discussionSignals = collectSignalMatches(text, generalDiscussionSignalEntries);
  const negativeSignals = collectSignalMatches(text, negativeSignalEntries);
  const bannedSignals = collectSignalMatches(text, bannedKeywordEntries);

  const hasSupplierAd = supplierSignals.length > 0;
  const hasBusinessAdvice = businessSignals.length > 0 && !hasSupplierAd;
  const hasMachinePurchase = machineSignals.length > 0 && !hasSupplierAd && !hasBusinessAdvice;

  const positiveWeight = sumSignalWeights(text, [
    ...machiningSignalEntries,
    ...threeDPrintSignalEntries,
    ...makeIntentSignalEntries,
    ...fileSignalEntries,
    ...physicalPartSignalEntries,
    ...needSignalEntries,
  ]);
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
  } else if (
    directRequestNeedSignals.length > 0 &&
    (threeDPrintSignals.length > 0 || makeIntentSignals.length > 0 || physicalPartSignals.length > 0 || machiningSignals.length > 0)
  ) {
    intent_type = "buyer_problem";
    confidence = clampConfidence(Math.max(combinedConfidence, Math.min(0.98, 0.38 + positiveWeight)));
  } else if (discussionSignals.length > 0) {
    intent_type = "general_discussion";
    confidence = clampConfidence(Math.max(0.2, combinedConfidence * 0.6));
  }

  return {
    intent_type,
    machining_signals: machiningSignals,
    three_d_print_signals: threeDPrintSignals,
    make_intent_signals: makeIntentSignals,
    file_signals: fileSignals,
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

function extractFileUrl(text: string) {
  return text.match(fileUrlPattern)?.[0] ?? undefined;
}

function extractPhotoUrls(text: string) {
  return uniq(Array.from(text.matchAll(photoUrlPattern), (match) => match[0]));
}

function extractMeasurements(text: string) {
  return uniq(
    measurementPatterns.flatMap((pattern) => Array.from(text.matchAll(pattern), (match) => match[0]?.trim() ?? "")).filter(Boolean)
  ).join("; ") || undefined;
}

function inferHasPhotos(text: string, photoUrls: string[]) {
  return photoUrls.length > 0 || photoHintPatterns.some((pattern) => pattern.test(text));
}

function determineStage(hasFile: boolean, hasPhotos: boolean): LeadStage {
  if (hasFile && hasPhotos) return "needs_both";
  if (hasFile && !hasPhotos) return "needs_print";
  if (!hasFile && hasPhotos) return "needs_file";
  return "unknown";
}

function inferManufacturingType(intent: PreleadIntent, detectedMaterials: string[], text: string): ManufacturingType {
  if (
    intent.three_d_print_signals.length > 0 ||
    /(\bstl\b|\b3d print(?:ing|ed)?\b|\bprinter\b|\bpla\b|\babs\b|\bresin\b|\b3mf\b|\bobj\b)/i.test(text)
  ) {
    return "3d_print";
  }

  if (
    intent.machining_signals.length > 0 ||
    detectedMaterials.some((material) => ["aluminium", "aluminum", "steel", "stainless", "brass", "titanium", "copper"].includes(material)) ||
    /\b(?:tolerance|precision|machin(?:e|ing|ed)|lathe|milling|turned|billet)\b/i.test(text)
  ) {
    return "cnc";
  }

  if (intent.make_intent_signals.length > 0 || intent.physical_part_signals.length > 0) {
    return "fabrication";
  }

  return "unknown";
}

function validateLeadIntake(lead: Pick<Prelead, "has_file" | "has_photos" | "measurements">) {
  if (!lead.has_file && !lead.has_photos) {
    return { isValid: false, lowQuality: true, reason: "low_quality:no_file_or_photo" };
  }

  if (lead.has_photos && !(lead.measurements && lead.measurements.trim())) {
    return { isValid: false, lowQuality: true, reason: "low_quality:photos_missing_measurements" };
  }

  return { isValid: true, lowQuality: false, reason: null };
}

function routeLead(lead: Pick<Prelead, "stage" | "manufacturing_type">): LeadRoute {
  if (lead.stage === "needs_file") {
    return "cad_required";
  }

  if (lead.stage === "needs_print") {
    if (lead.manufacturing_type === "3d_print") return "3d_print";
    if (lead.manufacturing_type === "cnc") return "cnc";
    return "review";
  }

  if (lead.stage === "needs_both") {
    return "cad_then_route";
  }

  return "review";
}

function enrichLeadIntake(prelead: Omit<Prelead, "suggested_reply">, intent: PreleadIntent) {
  const combined = `${prelead.title} ${prelead.snippet}`;
  const fileUrl = prelead.file_url ?? extractFileUrl(combined);
  const photoUrls = prelead.photo_urls?.length ? prelead.photo_urls : extractPhotoUrls(combined);
  const hasFile = Boolean(prelead.has_file ?? fileUrl ?? intent.file_signals.length > 0);
  const hasPhotos = Boolean(prelead.has_photos ?? inferHasPhotos(combined, photoUrls));
  const measurements = prelead.measurements ?? extractMeasurements(combined);
  const stage = determineStage(hasFile, hasPhotos);
  const manufacturingType = prelead.manufacturing_type ?? inferManufacturingType(intent, prelead.detected_materials, combined);
  const validation = validateLeadIntake({ has_file: hasFile, has_photos: hasPhotos, measurements });
  const routingDecision = routeLead({ stage, manufacturing_type: manufacturingType });

  return {
    ...prelead,
    has_file: hasFile,
    has_photos: hasPhotos,
    stage,
    manufacturing_type: manufacturingType,
    file_url: fileUrl,
    photo_urls: photoUrls.length > 0 ? photoUrls : undefined,
    measurements,
    description: prelead.description ?? prelead.title,
    routing_decision: routingDecision,
    part_candidate: routingDecision === "cad_required" || routingDecision === "cad_then_route",
    intake_validation_reason: validation.reason,
  } satisfies Omit<Prelead, "suggested_reply">;
}

function applyAiClassificationToLead(lead: Prelead, classification: Pick<AiPreleadClassification, "manufacturing_type" | "problem_summary" | "suggested_reply">) {
  const manufacturingType = classification.manufacturing_type ?? lead.manufacturing_type ?? "unknown";
  const routingDecision = routeLead({ stage: lead.stage, manufacturing_type: manufacturingType });

  return {
    ...lead,
    manufacturing_type: manufacturingType,
    description: classification.problem_summary || lead.description,
    suggested_reply: classification.suggested_reply || lead.suggested_reply,
    routing_decision: routingDecision,
    part_candidate: routingDecision === "cad_required" || routingDecision === "cad_then_route",
  } satisfies Prelead;
}

function detectKeywords(text: string, intent?: PreleadIntent) {
  const keywords: string[] = [];
  const photoUrls = extractPhotoUrls(text);

  if (ukPatterns.some((pattern) => pattern.test(text)) || ukCityRegionPatterns.some((pattern) => pattern.test(text))) keywords.push("UK mention");
  if (intent?.intent_type === "buyer_problem") keywords.push("buyer problem");
  if (intent?.physical_part_signals.includes("replacement part")) keywords.push("replacement part");
  if (intent?.make_intent_signals.length) keywords.push("make intent");
  if (intent?.three_d_print_signals.length) keywords.push("3d print intent");
  if (intent?.file_signals.length) keywords.push("file signal");
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
  if (extractFileUrl(text) || intent?.file_signals.length) keywords.push("has file");
  if (inferHasPhotos(text, photoUrls)) keywords.push("has photos");
  if (extractMeasurements(text)) keywords.push("has measurements");
  if (intent?.intent_type && intent.intent_type !== "buyer_problem") keywords.push(`intent:${intent.intent_type}`);

  return uniq(keywords);
}

function calculateLeadScore(text: string, location: LocationInferenceResult, intent?: PreleadIntent) {
  let score = 0;

  const analysis = intent ?? classifyPreleadIntent({ title: text, snippet: text });
  const directRequestNeedCount = analysis.need_signals.filter((signal) => !weakNeedSignals.has(signal)).length;
  const weakNeedCount = analysis.need_signals.length - directRequestNeedCount;
  const clearProblemSignals = analysis.make_intent_signals.filter((signal) => ["replacement part", "lost part", "broken part"].includes(signal));
  const leadLikeShape = {
    source: "scored",
    source_url: "",
    source_author: null,
    title: text,
    snippet: text,
    detected_keywords: [],
    detected_materials: [],
    location_signal: location.location_signal,
    location_confidence: location.location_confidence,
    location_reasons: location.location_reasons,
    lead_score: 0,
    suggested_reply: "",
    created_at: new Date(0).toISOString(),
  } satisfies Prelead;

  if (analysis.intent_type === "buyer_problem") score += Math.round(analysis.confidence * 10);
  if (analysis.intent_type === "supplier_ad") score -= 18;
  if (analysis.intent_type === "business_advice") score -= 14;
  if (analysis.intent_type === "machine_purchase") score -= 14;
  if (analysis.intent_type === "general_discussion") score -= 6;
  if (location.location_signal === "uk") score += Math.round(4 + location.location_confidence * 6);
  if (location.location_signal === "outside_uk") score -= Math.round(8 + location.location_confidence * 10);
  if (location.location_signal === "unknown") score += Math.round(location.location_confidence * 2);
  score += Math.min(4, analysis.machining_signals.length * 1.5);
  if (analysis.three_d_print_signals.length > 0) score += 5;
  if (analysis.make_intent_signals.length > 0) score += 5;
  if (analysis.file_signals.length > 0) score += 7;
  if (clearProblemSignals.length > 0) score += 5;
  score += Math.min(6, analysis.physical_part_signals.length * 2);
  score += Math.min(8, directRequestNeedCount * 3);
  score += Math.min(2, weakNeedCount);
  if (directRequestNeedCount === 0 && analysis.intent_type !== "buyer_problem") score -= 5;
  if (!hasQualificationSignal(analysis)) score -= 10;
  if (hasStrongBuyerRequestShape(leadLikeShape, analysis)) score += 8;
  if (looksLikeFeasibilityOrDiscussionPost(leadLikeShape)) score -= 8;
  if (looksLikeShowcaseOrOwnerPost(text)) score -= 10;
  if (looksLikeSupportReplacementPost(text)) score -= 12;
  if (looksLikeConsumerDeviceReplacement(text)) score -= 10;
  if (hasHighTicketFabricationSignal(text, analysis)) score += 10;
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
  const printingNote = prelead.detected_keywords.includes("3d print intent")
    ? " This may be a strong 3D-printing fit rather than a full machining job."
    : "";

  return [
    `${intro} this looks like a real make-to-order part need rather than an off-the-shelf purchase.${materialNote}${printingNote}`,
    `If you have a sketch, photo, STL/CAD file, material preference, rough quantity, and any size or tolerance notes for the ${problemSummary}, I can help point you toward a suitable UK manufacturing partner.`,
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
  const location = inferLocationSignal({ title, snippet: text, source_url: url });
  const detectedKeywords = uniq([
    ...detectKeywords(combined, intent),
    `intent:${intent.intent_type}`,
    `intent_confidence:${intent.confidence.toFixed(2)}`,
    `problem_summary:${summarizeProblemSignals(intent)}`,
  ]);
  const detectedMaterials = detectMaterials(combined);
  const leadScore = calculateLeadScore(combined, location, intent);
  const snippet = getSnippet(text, ["print", "stl", "cad", "step", "dxf", "drawing", "prototype", "replacement", "quote", "machin", "cnc", "machinist"]);

  const prelead = enrichLeadIntake({
    source: source.source,
    source_url: url,
    source_author: author,
    title,
    snippet,
    detected_keywords: detectedKeywords,
    detected_materials: detectedMaterials,
    location_signal: location.location_signal,
    location_confidence: location.location_confidence,
    location_reasons: location.location_reasons,
    lead_score: leadScore,
    created_at: createdAt,
  }, intent);

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
  if (intent.confidence < 0.6) return "no_need_signal";
  if (!hasQualificationSignal(intent)) return "no_part_signal";
  if (intent.need_signals.length === 0 && intent.make_intent_signals.length === 0) return "no_need_signal";

  return null;
}

function getPreAiHardRejectReason(lead: Prelead, intent: PreleadIntent) {
  const text = getCandidateText(lead);
  const bannedSignals = collectSignalMatches(text, bannedKeywordEntries);
  const sourceUrl = lead.source_url.toLowerCase();

  if (intent.intent_type === "supplier_ad") return "supplier_ad";
  if (intent.intent_type === "business_advice") return "business_advice";
  if (intent.intent_type === "machine_purchase") return "machine_purchase";
  if (/\/r\/(politics|news|worldnews|ukpolitics|unitedkingdom)\//i.test(sourceUrl)) return "politics_news";
  if (/\/r\/(jobs|forhire|careerguidance|careeradvice)\//i.test(sourceUrl)) return "job";

  if (bannedSignals.some((signal) => ["job", "hiring", "salary", "career"].includes(signal))) return "job";
  if (bannedSignals.some((signal) => ["politics", "news", "election", "government"].includes(signal))) return "politics_news";
  if (bannedSignals.some((signal) => ["course", "tutorial", "training"].includes(signal))) return "tutorial_course";
  if (
    bannedSignals.some((signal) =>
      ["mattress", "sofa", "bed", "furniture", "clothes", "clothing", "fashion", "upholstery", "home decor", "t-shirt", "print on demand"].includes(signal)
    )
  ) {
    return "mattress_furniture";
  }

  return null;
}

function hasMachiningOrPhysicalPartSignal(intent: PreleadIntent) {
  return intent.machining_signals.length > 0 || intent.physical_part_signals.length > 0;
}

function hasThreeDPrintSignal(intent: PreleadIntent) {
  return intent.three_d_print_signals.some((signal) => THREE_D_PRINT_SIGNALS.includes(signal as (typeof THREE_D_PRINT_SIGNALS)[number]));
}

function hasMakeIntentSignal(intent: PreleadIntent) {
  return intent.make_intent_signals.some((signal) => MAKE_INTENT_SIGNALS.includes(signal as (typeof MAKE_INTENT_SIGNALS)[number]));
}

function hasQualificationSignal(intent: PreleadIntent) {
  return hasThreeDPrintSignal(intent) || hasMakeIntentSignal(intent) || intent.physical_part_signals.length > 0;
}

const weakNeedSignals = new Set(["quote", "CAD", "drawing", "machined", "machining", "custom"]);

function hasDirectRequestNeedSignal(intent: PreleadIntent) {
  return intent.need_signals.some((signal) => !weakNeedSignals.has(signal));
}

function looksLikeFeasibilityOrDiscussionPost(lead: Prelead) {
  const text = getCandidateText(lead);
  return [
    /\bis it possible to\b/i,
    /\bis .* a good move\b/i,
    /\bshould i\b/i,
    /\bwhat do you think\b/i,
    /\bdoes anyone know\b/i,
    /\bgetting started in\b/i,
    /\bmanual in cnc shops\b/i,
    /\bbecome a cnc operator\b/i,
  ].some((pattern) => pattern.test(text));
}

function looksLikeShowcaseOrOwnerPost(text: string) {
  return [
    /\bi made\b/i,
    /\bwe made\b/i,
    /\bjust knocked out\b/i,
    /\bfirst attempt\b/i,
    /\bjust picked up\b/i,
    /\bin love with\b/i,
    /\bconfirmed to be coming out\b/i,
    /\bwalkthrough\b/i,
    /\bshowcase\b/i,
  ].some((pattern) => pattern.test(text));
}

function looksLikeSupportReplacementPost(text: string) {
  return [
    /\bcustomer support\b/i,
    /\bcontact form\b/i,
    /\bemailed support\b/i,
    /\bno response\b/i,
    /\bdiscord\b/i,
    /\brefund\b/i,
    /\bpartial refund\b/i,
    /\bcredit card\b/i,
    /\baliexpress\b/i,
    /\bshipping\b/i,
    /\bshipped\b/i,
  ].some((pattern) => pattern.test(text));
}

function looksLikeConsumerDeviceReplacement(text: string, sourceUrl = "") {
  const combined = `${text} ${sourceUrl}`;
  return [
    /\btrigger\b/i,
    /\bjoystick\b/i,
    /\bface button\b/i,
    /\bbutton swap\b/i,
    /\bhandheld\b/i,
    /\bcontroller\b/i,
    /\bphone case\b/i,
    /\bsteam deck\b/i,
    /\bodin\b/i,
  ].some((pattern) => pattern.test(combined));
}

function hasHighTicketFabricationSignal(text: string, intent: PreleadIntent) {
  const signalCount = [
    /\bprototype\b/i,
    /\bsmall batch\b/i,
    /\bone[- ]off\b/i,
    /\breverse engineer\b/i,
    /\bmachine shop\b/i,
    /\bquote\b/i,
    /\bquotes\b/i,
    /\bdimensions?\b/i,
    /\btolerances?\b/i,
    /\bSTEP\b/i,
    /\bSTP\b/i,
    /\bDXF\b/i,
    /\bDWG\b/i,
    /\bSolidWorks\b/i,
    /\bFusion 360\b/i,
    /\baluminium\b/i,
    /\baluminum\b/i,
    /\bstainless\b/i,
    /\bsteel\b/i,
    /\bbrass\b/i,
  ].filter((pattern) => pattern.test(text)).length;

  return signalCount >= 2 || intent.need_signals.includes("small batch") || intent.physical_part_signals.includes("prototype");
}

function hasStrongBuyerRequestShape(lead: Prelead, intent: PreleadIntent) {
  if (intent.intent_type === "buyer_problem") {
    return true;
  }

  const text = getCandidateText(lead);
  if (hasDirectRequestNeedSignal(intent) || intent.make_intent_signals.length > 0 || intent.three_d_print_signals.length > 0) {
    return true;
  }

  return [
    /\blooking for (?:someone|a shop|a machinist|a fabricator|someone who can make)\b/i,
    /\bcan anyone make\b/i,
    /\bcan someone 3d print this\b/i,
    /\bneed this 3d printed\b/i,
    /\b3d print this for me\b/i,
    /\bwho can print this\b/i,
    /\bwhere can i get .* made\b/i,
    /\bwhere can i get .* machined\b/i,
    /\bneed (?:a|an|this|these|some) .* (?:made|machined|fabricated)\b/i,
    /\bwho can make\b/i,
  ].some((pattern) => pattern.test(text));
}

function isEligibleForAiShortlist(lead: Prelead, intent: PreleadIntent) {
  if (!hasQualificationSignal(intent) && !hasMachiningOrPhysicalPartSignal(intent)) {
    return false;
  }

  if (!hasStrongBuyerRequestShape(lead, intent)) {
    return false;
  }

  if (looksLikeFeasibilityOrDiscussionPost(lead) && intent.intent_type !== "buyer_problem") {
    return false;
  }

  if (intent.confidence < 0.3 && intent.intent_type !== "buyer_problem") {
    return false;
  }

  if (looksLikeSupportReplacementPost(getCandidateText(lead)) && looksLikeConsumerDeviceReplacement(getCandidateText(lead), lead.source_url)) {
    return false;
  }

  return true;
}

function calculateAiShortlistScore(lead: Prelead, intent: PreleadIntent) {
  let score = lead.lead_score;

  if (intent.intent_type === "buyer_problem") score += 14;
  if (intent.intent_type === "general_discussion") score -= 10;
  if (intent.intent_type === "unknown") score -= 8;
  if (intent.intent_type === "supplier_ad") score -= 20;

  score += Math.min(9, intent.need_signals.length * 3);
  score += Math.min(6, intent.machining_signals.length * 2);
  score += Math.min(9, intent.three_d_print_signals.length * 3);
  score += Math.min(9, intent.make_intent_signals.length * 3);
  score += Math.min(8, intent.file_signals.length * 3);
  score += Math.min(9, intent.physical_part_signals.length * 3);

  if (hasDirectRequestNeedSignal(intent)) score += 10;
  if (!hasQualificationSignal(intent)) score -= 12;
  if (intent.need_signals.length === 0) score -= 10;
  if (intent.confidence < 0.5) score -= 6;
  if (!hasStrongBuyerRequestShape(lead, intent)) score -= 18;
  if (looksLikeFeasibilityOrDiscussionPost(lead)) score -= 12;
  if (looksLikeSupportReplacementPost(getCandidateText(lead))) score -= 15;
  if (looksLikeConsumerDeviceReplacement(getCandidateText(lead), lead.source_url)) score -= 12;
  if (hasHighTicketFabricationSignal(getCandidateText(lead), intent)) score += 12;
  if (lead.location_signal === "outside_uk") score -= 6;

  return score;
}

function getFinalAiRejectionReason(
  lead: Prelead,
  intent: PreleadIntent,
  classification: AiPreleadClassification,
  includeOutsideUk: boolean
): FinalRejectionReason | null {
  if (!classification.is_lead) return "hard_reject";
  if (classification.confidence < 0.6) return "ai_confidence_too_low";
  if (lead.location_signal === "outside_uk" && !includeOutsideUk) return "outside_uk";
  if (intent.intent_type !== "buyer_problem") return "missing_problem_signal";
  if (!hasQualificationSignal(intent)) {
    return "missing_problem_signal";
  }
  return null;
}

function incrementReasonCount<T extends string>(counts: Map<T, number>, reason: T) {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
}

function topReasonCounts<T extends string>(counts: Map<T, number>, limit = 5) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([reason, count]) => ({ reason, count }));
}

function qualifiesPrelead(lead: Prelead, intent: PreleadIntent, includeOutsideUk: boolean, minScore: number) {
  return (
    getCandidateRejectionReason(lead, intent, includeOutsideUk) === null &&
    intent.intent_type === "buyer_problem" &&
    intent.confidence >= 0.6 &&
    hasQualificationSignal(intent) &&
    (intent.need_signals.length > 0 || intent.make_intent_signals.length > 0) &&
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

async function partitionFreshLeads(leads: Prelead[], logger: Logger) {
  if (leads.length === 0) {
    return { freshLeads: [] as Prelead[], duplicateUrls: new Set<string>() };
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

    const duplicateUrls = new Set((existing ?? []).map((row) => row.source_url as string));
    const freshLeads = leads.filter((lead) => !duplicateUrls.has(lead.source_url));
    return { freshLeads, duplicateUrls };
  } catch (error) {
    logger.warn(`Supabase duplicate check skipped: ${formatSupabaseError(error)}`);
    return { freshLeads: leads, duplicateUrls: new Set<string>() };
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
  let totalFetchedCandidates = 0;

  for (const adapter of adapters) {
    await sleep(requestDelayMs);

    try {
      const candidates = await adapter.fetchCandidates();
      totalFetchedCandidates += candidates.length;
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
    tutorial_course: [],
    machine_purchase: [],
    business_advice: [],
  };
  const preAiRejectedReasonCounts = new Map<string, number>();
  const aiRejectedReasonCounts = new Map<string, number>();
  const finalRejectedReasonCounts = new Map<FinalRejectionReason, number>();
  const aiDecisionByUrl = new Map<string, {
    ai_is_lead: boolean | null;
    ai_confidence: number | null;
    ai_reason: string | null;
    ai_manufacturing_type: string | null;
    ai_problem_summary: string | null;
    rejection_reason: string | null;
  }>();
  const preAiCandidates: Array<{ lead: Prelead; intent: PreleadIntent }> = [];
  const leads: Prelead[] = [];
  let aiCandidateUrls = new Set<string>();
  let aiCandidatesSent = 0;
  let aiAcceptedCount = 0;
  let aiRejectedCount = 0;
  let finalRejectedAfterAiCount = 0;

  for (const { lead, intent } of orderedScoredCandidates) {
    const preAiHardRejectReason = useAiPipeline ? getPreAiHardRejectReason(lead, intent) : null;

    if (debugEnabled) {
      const rawCandidate = rawCandidateByUrl.get(lead.source_url);
      logger.debug(
        `title=${lead.title} query_used=${rawCandidate?.query_used ?? 'none'} intent_type=${intent.intent_type} confidence=${intent.confidence.toFixed(2)} location_signal=${lead.location_signal} location_confidence=${lead.location_confidence.toFixed(2)} location_reasons=${lead.location_reasons.join('; ') || 'none'} machining_signals=${intent.machining_signals.join('; ') || 'none'} three_d_print_signals=${intent.three_d_print_signals.join('; ') || 'none'} make_intent_signals=${intent.make_intent_signals.join('; ') || 'none'} file_signals=${intent.file_signals.join('; ') || 'none'} physical_part_signals=${intent.physical_part_signals.join('; ') || 'none'} need_signals=${intent.need_signals.join('; ') || 'none'} negative_signals=${intent.negative_signals.join('; ') || 'none'} has_file=${lead.has_file ? 'yes' : 'no'} has_photos=${lead.has_photos ? 'yes' : 'no'} stage=${lead.stage ?? 'unknown'} manufacturing_type=${lead.manufacturing_type ?? 'unknown'} route=${lead.routing_decision ?? 'review'} part_candidate=${lead.part_candidate ? 'true' : 'false'} intake_validation=${lead.intake_validation_reason ?? 'ok'} pre_ai_reject_reason=${preAiHardRejectReason ?? 'none'}`
      );
      if (lead.routing_decision === 'cad_required') {
        logger.debug('CAD_REQUIRED');
      }
    }

    if (preAiHardRejectReason) {
      preAiRejectionBuckets[preAiHardRejectReason].push(lead);
      incrementReasonCount(preAiRejectedReasonCounts, preAiHardRejectReason);
      continue;
    }

    preAiCandidates.push({ lead, intent });
  }

  if (useAiPipeline) {
    const preAiCandidateByUrl = new Map(preAiCandidates.map((entry) => [entry.lead.source_url, entry]));
    const aiShortlistPool = preAiCandidates.filter(({ lead, intent }) => isEligibleForAiShortlist(lead, intent));
    const orderedAiCandidates = [...aiShortlistPool].sort((a, b) => {
      const scoreDifference = calculateAiShortlistScore(b.lead, b.intent) - calculateAiShortlistScore(a.lead, a.intent);
      return scoreDifference || b.lead.lead_score - a.lead.lead_score || a.lead.created_at.localeCompare(b.lead.created_at);
    });

    const aiCandidates = orderedAiCandidates.slice(0, aiConfig.maxCandidates).map((entry) => ({
      source_url: entry.lead.source_url,
      title: entry.lead.title,
      snippet: entry.lead.snippet,
      query_used: rawCandidateByUrl.get(entry.lead.source_url)?.query_used ?? null,
      has_file: entry.lead.has_file ?? false,
      has_photos: entry.lead.has_photos ?? false,
      stage: entry.lead.stage ?? "unknown",
      measurements: entry.lead.measurements ?? null,
      description: entry.lead.description ?? null,
      detected_keywords: entry.lead.detected_keywords,
      detected_materials: entry.lead.detected_materials,
      location_signal: entry.lead.location_signal,
      location_confidence: entry.lead.location_confidence,
      location_reasons: entry.lead.location_reasons,
      lead_score: entry.lead.lead_score,
      suggested_reply: entry.lead.suggested_reply,
    }));
    aiCandidateUrls = new Set(aiCandidates.map((candidate) => candidate.source_url));
    aiCandidatesSent = aiCandidates.length;

    if (debugEnabled) {
      logger.info(`AI shortlist pool size: ${aiShortlistPool.length}`);
      logger.info(`estimated classifier calls: ${aiCandidates.length}`);
      logger.info(`candidates sent to AI: ${aiCandidates.length}`);
      logger.debug(
        "top AI shortlist candidates:",
        orderedAiCandidates.slice(0, 10).map(({ lead, intent }) => ({
          title: lead.title,
          query_used: rawCandidateByUrl.get(lead.source_url)?.query_used ?? null,
          shortlist_score: calculateAiShortlistScore(lead, intent),
          lead_score: lead.lead_score,
          has_file: lead.has_file ?? false,
          has_photos: lead.has_photos ?? false,
          stage: lead.stage ?? "unknown",
          manufacturing_type: lead.manufacturing_type ?? "unknown",
          route: lead.routing_decision ?? "review",
          intent_type: intent.intent_type,
          intent_confidence: intent.confidence,
          machining_signals: intent.machining_signals,
          three_d_print_signals: intent.three_d_print_signals,
          make_intent_signals: intent.make_intent_signals,
          file_signals: intent.file_signals,
          physical_part_signals: intent.physical_part_signals,
          need_signals: intent.need_signals,
          location_signal: lead.location_signal,
        }))
      );
    }

    const aiResults = await classifyPreleadCandidatesWithAI(aiCandidates, logger);

    if (aiResults) {
      const accepted = [] as typeof aiResults;
      const rejected = [] as typeof aiResults;
      const finalAcceptedLeads: Prelead[] = [];
      const seenFinalUrls = new Set<string>();

      for (const { candidate, classification } of aiResults) {
        const preAiCandidate = preAiCandidateByUrl.get(candidate.source_url);
        if (!preAiCandidate) {
          continue;
        }

        if (!classification.is_lead) {
          aiRejectedCount += 1;
          rejected.push({ candidate, classification });
          incrementReasonCount(aiRejectedReasonCounts, classification.reason || "hard_reject");
          aiDecisionByUrl.set(candidate.source_url, {
            ai_is_lead: classification.is_lead,
            ai_confidence: classification.confidence,
            ai_reason: classification.reason,
            ai_manufacturing_type: classification.manufacturing_type,
            ai_problem_summary: classification.problem_summary,
            rejection_reason: "hard_reject",
          });
          continue;
        }

        aiAcceptedCount += 1;
        accepted.push({ candidate, classification });

        const finalRejectionReason = getFinalAiRejectionReason(
          preAiCandidate.lead,
          preAiCandidate.intent,
          classification,
          includeOutsideUk
        );

        if (finalRejectionReason) {
          finalRejectedAfterAiCount += 1;
          incrementReasonCount(finalRejectedReasonCounts, finalRejectionReason);
          aiDecisionByUrl.set(candidate.source_url, {
            ai_is_lead: classification.is_lead,
            ai_confidence: classification.confidence,
            ai_reason: classification.reason,
            ai_manufacturing_type: classification.manufacturing_type,
            ai_problem_summary: classification.problem_summary,
            rejection_reason: finalRejectionReason,
          });
          continue;
        }

        if (seenFinalUrls.has(candidate.source_url)) {
          finalRejectedAfterAiCount += 1;
          incrementReasonCount(finalRejectedReasonCounts, "duplicate");
          aiDecisionByUrl.set(candidate.source_url, {
            ai_is_lead: classification.is_lead,
            ai_confidence: classification.confidence,
            ai_reason: classification.reason,
            ai_manufacturing_type: classification.manufacturing_type,
            ai_problem_summary: classification.problem_summary,
            rejection_reason: "duplicate",
          });
          continue;
        }

        seenFinalUrls.add(candidate.source_url);

        aiDecisionByUrl.set(candidate.source_url, {
          ai_is_lead: classification.is_lead,
          ai_confidence: classification.confidence,
          ai_reason: classification.reason,
          ai_manufacturing_type: classification.manufacturing_type,
          ai_problem_summary: classification.problem_summary,
          rejection_reason: null,
        });

        finalAcceptedLeads.push(applyAiClassificationToLead(preAiCandidate.lead, classification));
      }

      leads.push(...finalAcceptedLeads);

      if (debugEnabled) {
        logger.info(`AI accepted count: ${aiAcceptedCount}`);
        logger.info(`AI rejected count: ${aiRejectedCount}`);
        logger.debug(
          'top accepted candidates:',
          accepted.slice(0, 5).map(({ candidate, classification }) => ({
            has_file: preAiCandidateByUrl.get(candidate.source_url)?.lead.has_file ?? false,
            has_photos: preAiCandidateByUrl.get(candidate.source_url)?.lead.has_photos ?? false,
            stage: preAiCandidateByUrl.get(candidate.source_url)?.lead.stage ?? "unknown",
            title: candidate.title,
            query_used: rawCandidateByUrl.get(candidate.source_url)?.query_used ?? null,
            confidence: classification.confidence,
            problem_type: classification.problem_type,
            manufacturing_type: classification.manufacturing_type,
            problem_summary: classification.problem_summary,
            route: routeLead({
              stage: preAiCandidateByUrl.get(candidate.source_url)?.lead.stage,
              manufacturing_type: classification.manufacturing_type,
            }),
            reason: classification.reason,
          }))
        );
        logger.debug(
          'top rejected candidates:',
          rejected.slice(0, 5).map(({ candidate, classification }) => ({
            has_file: preAiCandidateByUrl.get(candidate.source_url)?.lead.has_file ?? false,
            has_photos: preAiCandidateByUrl.get(candidate.source_url)?.lead.has_photos ?? false,
            stage: preAiCandidateByUrl.get(candidate.source_url)?.lead.stage ?? "unknown",
            title: candidate.title,
            query_used: rawCandidateByUrl.get(candidate.source_url)?.query_used ?? null,
            confidence: classification.confidence,
            manufacturing_type: classification.manufacturing_type,
            problem_summary: classification.problem_summary,
            route: routeLead({
              stage: preAiCandidateByUrl.get(candidate.source_url)?.lead.stage,
              manufacturing_type: classification.manufacturing_type,
            }),
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
          ai_manufacturing_type: null,
          ai_problem_summary: null,
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
  logger.info(`final rejected after AI: ${finalRejectedAfterAiCount}`);

  logger.info(`total candidates: ${rawCandidates.length}`);
  logger.info(`scored: ${scoredLeads.length}`);
  logger.info(`qualifying: ${leads.length}`);

  if (debugEnabled) {
    logger.info(`skipped duplicates: ${duplicateCandidatesSkipped}`);
    logger.info(`stage counts: fetched=${totalFetchedCandidates} deduped=${rawCandidates.length} hard_rejected_before_ai=${[...preAiRejectedReasonCounts.values()].reduce((sum, count) => sum + count, 0)} sent_to_ai=${aiCandidatesSent} ai_accepted=${aiAcceptedCount} ai_rejected=${aiRejectedCount} final_rejected_after_ai=${finalRejectedAfterAiCount}`);
    logger.debug(
      "top 5 candidate titles + scores:",
      topScored.slice(0, 5).map((lead) => ({
        title: lead.title,
        score: lead.lead_score,
        source_url: lead.source_url,
        query_used: rawCandidateByUrl.get(lead.source_url)?.query_used ?? null,
        has_file: lead.has_file ?? false,
        has_photos: lead.has_photos ?? false,
        stage: lead.stage ?? "unknown",
        manufacturing_type: lead.manufacturing_type ?? "unknown",
        route: lead.routing_decision ?? "review",
      }))
    );
    logger.debug("top 5 pre-AI rejection reasons:", topReasonCounts(preAiRejectedReasonCounts));
    logger.debug("top 5 AI rejected reasons:", topReasonCounts(aiRejectedReasonCounts));
    logger.debug("top 5 final rejection reasons:", topReasonCounts(finalRejectedReasonCounts));
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
          location_confidence: lead.location_confidence,
          location_reasons: lead.location_reasons,
          has_file: lead.has_file ?? false,
          has_photos: lead.has_photos ?? false,
          stage: lead.stage ?? null,
          file_url: lead.file_url ?? null,
          photo_urls: lead.photo_urls ?? [],
          measurements: lead.measurements ?? null,
          measurements_present: Boolean(lead.measurements?.trim()),
          description: aiDecision?.ai_problem_summary ?? lead.description ?? null,
          classifier_enabled: true,
          ai_is_lead: aiDecision?.ai_is_lead ?? null,
          ai_confidence: aiDecision?.ai_confidence ?? null,
          ai_reason: aiDecision?.ai_reason ?? null,
          ai_manufacturing_type: aiDecision?.ai_manufacturing_type ?? null,
          ai_problem_summary: aiDecision?.ai_problem_summary ?? null,
          routing_decision: routeLead({
            stage: lead.stage,
            manufacturing_type: (aiDecision?.ai_manufacturing_type as ManufacturingType | null) ?? lead.manufacturing_type,
          }),
          part_candidate: lead.part_candidate ?? false,
          intake_validation_reason: lead.intake_validation_reason ?? null,
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

  let candidateLeads = leads;
  if (persistSupabase && candidateLeads.length > 0) {
    const { freshLeads, duplicateUrls } = await partitionFreshLeads(candidateLeads, logger);
    if (duplicateUrls.size > 0) {
      finalRejectedAfterAiCount += duplicateUrls.size;
      for (const duplicateUrl of duplicateUrls) {
        incrementReasonCount(finalRejectedReasonCounts, "duplicate");
        const priorDecision = aiDecisionByUrl.get(duplicateUrl);
        aiDecisionByUrl.set(duplicateUrl, {
          ai_is_lead: priorDecision?.ai_is_lead ?? true,
          ai_confidence: priorDecision?.ai_confidence ?? null,
          ai_reason: priorDecision?.ai_reason ?? "Duplicate existing prelead.",
          ai_manufacturing_type: priorDecision?.ai_manufacturing_type ?? null,
          ai_problem_summary: priorDecision?.ai_problem_summary ?? null,
          rejection_reason: "duplicate",
        });
      }
    }
    candidateLeads = freshLeads;
  }

  if (debugEnabled) {
    logger.debug("top 5 final rejection reasons (post-duplicate-check):", topReasonCounts(finalRejectedReasonCounts));
  }

  let savedToSupabase = 0;
  if (persistSupabase) {
    savedToSupabase = await saveToSupabase(candidateLeads, logger);
  }
  logger.info(`inserted: ${savedToSupabase}`);
  if (debugEnabled) {
    logger.info(`stage counts (final): fetched=${totalFetchedCandidates} deduped=${rawCandidates.length} hard_rejected_before_ai=${[...preAiRejectedReasonCounts.values()].reduce((sum, count) => sum + count, 0)} sent_to_ai=${aiCandidatesSent} ai_accepted=${aiAcceptedCount} ai_rejected=${aiRejectedCount} final_rejected_after_ai=${finalRejectedAfterAiCount} inserted=${savedToSupabase}`);
  }
  leads.length = 0;
  leads.push(...candidateLeads);

  let savedToJson = false;
  const allowJsonOutput = persistJson && process.env.NODE_ENV !== "production";
  if (persistJson && !allowJsonOutput) {
    logger.info("Skipping JSON output in production.");
  }
  if (allowJsonOutput) {
    try {
      await saveToJson(candidateLeads, outputPath);
      savedToJson = true;
    } catch (error) {
      logger.warn(`JSON output skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let emailed = false;
  if (sendEmail && candidateLeads.length > 0) {
    emailed = await sendPreleadSummaryEmail(candidateLeads);
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
