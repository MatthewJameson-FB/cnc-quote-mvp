import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type HumanLabel = "good" | "bad" | "maybe";

export type PreleadLearningLogRow = {
  id: string;
  created_at: string;
  source: string;
  query_used: string | null;
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
