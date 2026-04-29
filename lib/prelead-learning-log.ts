import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type HumanLabel = "good" | "bad" | "maybe";

export type PreleadLearningLogRow = {
  id: string;
  created_at: string;
  source: string;
  query_used: string | null;
  prelead_id: string | null;
  source_url: string;
  title: string;
  snippet: string;
  initial_score: number;
  location_signal: "uk" | "unknown" | "outside_uk";
  location_confidence: number;
  location_reasons: string[];
  has_file: boolean;
  has_photos: boolean;
  stage: string | null;
  file_url: string | null;
  photo_urls: string[];
  measurements: string | null;
  measurements_present: boolean;
  description: string | null;
  classifier_enabled: boolean;
  ai_is_lead: boolean | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  ai_manufacturing_type: string | null;
  ai_problem_summary: string | null;
  routing_decision: string | null;
  part_candidate: boolean;
  intake_validation_reason: string | null;
  estimate_range: string | null;
  estimate_accepted: boolean | null;
  converted_to_quote: boolean;
  rejection_reason: string | null;
  inserted_to_pre_leads: boolean;
  human_label: HumanLabel | null;
  human_notes: string | null;
};

const ROOT = process.cwd();
const DEFAULT_LOG_PATH = path.join(ROOT, "data", "prelead-learning-log.jsonl");

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

export function defaultPreleadLearningLogPath() {
  return process.env.PRELEAD_LEARNING_LOG_PATH?.trim() || DEFAULT_LOG_PATH;
}

export async function appendPreleadLearningLog(rows: PreleadLearningLogRow[]) {
  if (!isDevelopment() || rows.length === 0) {
    return false;
  }

  const logPath = defaultPreleadLearningLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  const payload = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await appendFile(logPath, payload, "utf8");
  return true;
}

export function createPreleadLearningLogId(sourceUrl: string, createdAt: string) {
  const safeUrl = sourceUrl.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "candidate";
  const safeTime = createdAt.replace(/[^0-9]/g, "").slice(0, 14) || Date.now().toString();
  return `${safeTime}-${safeUrl}`;
}

export function createPreleadConversionLearningLogRow({
  preleadId,
  quoteId,
  estimateRange,
  estimateAccepted,
  createdAt = new Date().toISOString(),
}: {
  preleadId: string;
  quoteId: string;
  estimateRange: string | null;
  estimateAccepted: boolean | null;
  createdAt?: string;
}): PreleadLearningLogRow {
  const accepted = estimateAccepted === true;

  return {
    id: createPreleadLearningLogId(`quote:${quoteId}`, createdAt),
    created_at: createdAt,
    source: "conversion_tracking",
    query_used: null,
    prelead_id: preleadId,
    source_url: `quote:${quoteId}`,
    title: accepted ? "Prelead estimate accepted" : "Prelead quote tracked",
    snippet: accepted
      ? `Estimate accepted for prelead ${preleadId}`
      : `Quote created for prelead ${preleadId}`,
    initial_score: 0,
    location_signal: "unknown",
    location_confidence: 0,
    location_reasons: [],
    has_file: false,
    has_photos: false,
    stage: null,
    file_url: null,
    photo_urls: [],
    measurements: null,
    measurements_present: false,
    description: null,
    classifier_enabled: false,
    ai_is_lead: null,
    ai_confidence: null,
    ai_reason: null,
    ai_manufacturing_type: null,
    ai_problem_summary: null,
    routing_decision: null,
    part_candidate: false,
    intake_validation_reason: null,
    estimate_range: estimateRange,
    estimate_accepted: estimateAccepted,
    converted_to_quote: accepted,
    rejection_reason: null,
    inserted_to_pre_leads: false,
    human_label: null,
    human_notes: null,
  };
}
