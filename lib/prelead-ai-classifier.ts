type LoggerLike = {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
};

export type AiProblemType = "replacement_part" | "prototype" | "custom_part" | "repair" | "fabrication" | "unknown";

export type AiPreleadCandidateInput = {
  source_url: string;
  title: string;
  snippet: string;
  query_used?: string | null;
  has_file?: boolean;
  has_photos?: boolean;
  stage?: "needs_file" | "needs_print" | "needs_both" | "unknown";
  measurements?: string | null;
  description?: string | null;
  detected_keywords: string[];
  detected_materials: string[];
  location_signal: "uk" | "unknown" | "outside_uk";
  location_confidence: number;
  location_reasons: string[];
  lead_score: number;
  suggested_reply: string;
};

export type AiPreleadClassification = {
  is_lead: boolean;
  confidence: number;
  reason: string;
  problem_type: AiProblemType;
  manufacturing_type: "3d_print" | "cnc" | "fabrication" | "unknown";
  problem_summary: string;
  suggested_reply: string;
};

export type AiClassifiedCandidate = {
  candidate: AiPreleadCandidateInput;
  classification: AiPreleadClassification;
};

export type AiClassifierConfig = {
  enabled: boolean;
  apiKeyPresent: boolean;
  apiKey: string | null;
  maxCandidates: number;
  minConfidence: number;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

function isTruthy(value: string | undefined) {
  return Boolean(value && /^(1|true|yes|on)$/i.test(value.trim()));
}

function toBoundedNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function getAiPreleadClassifierConfig(): AiClassifierConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;

  return {
    enabled: isTruthy(process.env.ENABLE_AI_PRELEAD_CLASSIFIER),
    apiKeyPresent: Boolean(apiKey),
    apiKey,
    maxCandidates: Math.round(toBoundedNumber(process.env.AI_PRELEAD_MAX_CANDIDATES, 25, 1, 100)),
    minConfidence: toBoundedNumber(process.env.AI_PRELEAD_MIN_CONFIDENCE, 0.7, 0, 1),
    model: process.env.AI_PRELEAD_MODEL?.trim() || "gpt-4o-mini",
  };
}

function buildPrompt(candidate: AiPreleadCandidateInput) {
  return [
    "Decide whether this is a real buyer-problem lead for something that needs to be made.",
    "Bias toward approving genuine 3D-printing, CNC, or fabrication opportunities where someone likely needs a physical part made, replaced, prototyped, repaired, or reverse-engineered.",
    "Prefer manufacturing_type=3d_print when the part seems plastic, small/simple, hobby/DIY, or the post mentions STL/CAD/model files, printers, resin, PLA, ABS, or printing directly.",
    "Prefer manufacturing_type=cnc when the context suggests metal, precision, tolerances, machining, automotive, engineering, aluminium, steel, stainless, milling, turning, or lathe work.",
    "Use manufacturing_type=fabrication for broader make/build/fabricate jobs that are not clearly CNC or 3D print.",
    "Reject mattresses, beds, sofas, furniture, clothing, upholstery, home decor, print-on-demand, service-provider ads, supplier SEO pages, companies saying they offer services, job/career/salary posts, machine-purchase advice, tutorials/courses/training, generic supplier lists, generic business advice, and generic custom-product posts.",
    "Return strict JSON only.",
    "",
    `Title: ${candidate.title}`,
    `Snippet: ${candidate.snippet}`,
    `Source URL: ${candidate.source_url}`,
    `Query used: ${candidate.query_used ?? "unknown"}`,
    `Has file: ${candidate.has_file ? "yes" : "no"}`,
    `Has photos: ${candidate.has_photos ? "yes" : "no"}`,
    `Stage: ${candidate.stage ?? "unknown"}`,
    `Measurements: ${candidate.measurements ?? "none"}`,
    `Description: ${candidate.description ?? "none"}`,
    `Detected keywords: ${candidate.detected_keywords.join(", ") || "none"}`,
    `Detected materials: ${candidate.detected_materials.join(", ") || "none"}`,
    `Location signal: ${candidate.location_signal}`,
    `Location confidence: ${candidate.location_confidence}`,
    `Location reasons: ${candidate.location_reasons.join(", ") || "none"}`,
    `Lead score: ${candidate.lead_score}`,
  ].join("\n");
}

async function classifyOneCandidate(
  candidate: AiPreleadCandidateInput,
  config: AiClassifierConfig
): Promise<AiPreleadClassification> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_completion_tokens: 220,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "prelead_classification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              is_lead: { type: "boolean" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string", minLength: 1, maxLength: 280 },
              problem_type: {
                type: "string",
                enum: ["replacement_part", "prototype", "custom_part", "repair", "fabrication", "unknown"],
              },
              manufacturing_type: {
                type: "string",
                enum: ["3d_print", "cnc", "fabrication", "unknown"],
              },
              problem_summary: { type: "string", minLength: 1, maxLength: 220 },
              suggested_reply: { type: "string", minLength: 1, maxLength: 400 },
            },
            required: ["is_lead", "confidence", "reason", "problem_type", "manufacturing_type", "problem_summary", "suggested_reply"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You classify manufacturing leads for Flangie. Approve only if the post likely involves someone needing a real physical part made, printed, modified, replaced, prototyped, fabricated, or sourced. Be strict about buyer intent, but do not require CNC specifically. Favor 3D-print leads when the part is simple/plastic/hobby-oriented or the post mentions STL/CAD/model files or printers. Keep suggested replies helpful, specific, non-salesy, and position Flangie as helping connect them with a suitable UK manufacturing partner rather than being the machine shop.",
        },
        {
          role: "user",
          content: buildPrompt(candidate),
        },
      ],
    }),
  });

  const raw = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(`OpenAI prelead classifier failed: HTTP ${response.status}${raw ? ` - ${raw}` : ""}`);
  }

  let parsedResponse: ChatCompletionResponse;

  try {
    parsedResponse = JSON.parse(raw) as ChatCompletionResponse;
  } catch {
    throw new AiParseError(`Classifier response was not valid JSON: ${raw.slice(0, 400)}`);
  }

  const content = parsedResponse?.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("")
      : "";

  if (!text.trim()) {
    throw new AiParseError("Classifier response did not include message content.");
  }

  let classification: AiPreleadClassification | null = null;
  try {
    classification = JSON.parse(text) as AiPreleadClassification;
  } catch {
    throw new AiParseError(`Classifier content was not valid JSON: ${text.slice(0, 400)}`);
  }

  if (
    typeof classification?.is_lead !== "boolean" ||
    typeof classification?.confidence !== "number" ||
    typeof classification?.reason !== "string" ||
    typeof classification?.problem_summary !== "string" ||
    typeof classification?.suggested_reply !== "string" ||
    !["replacement_part", "prototype", "custom_part", "repair", "fabrication", "unknown"].includes(classification?.problem_type) ||
    !["3d_print", "cnc", "fabrication", "unknown"].includes(classification?.manufacturing_type)
  ) {
    throw new AiParseError(`Classifier JSON did not match expected schema: ${text.slice(0, 400)}`);
  }

  return {
    ...classification,
    confidence: Math.max(0, Math.min(1, Number(classification.confidence.toFixed(2)))),
    reason: classification.reason.trim(),
    problem_summary: classification.problem_summary.trim(),
    suggested_reply: classification.suggested_reply.trim(),
  };
}

export async function classifyPreleadCandidatesWithAI(
  candidates: AiPreleadCandidateInput[],
  logger: LoggerLike
): Promise<AiClassifiedCandidate[] | null> {
  const config = getAiPreleadClassifierConfig();

  if (!config.enabled) {
    return null;
  }

  if (!config.apiKey) {
    logger.warn("AI prelead classifier enabled but OPENAI_API_KEY is missing; skipping AI classification.");
    return null;
  }

  const selected = candidates.slice(0, config.maxCandidates);
  const results: AiClassifiedCandidate[] = [];

  for (const candidate of selected) {
    try {
      const classification = await classifyOneCandidate(candidate, config);
      results.push({ candidate, classification });
    } catch (error) {
      if (error instanceof AiParseError) {
        logger.debug(`AI classifier parse failure for ${candidate.source_url}: ${error.message}`);
        results.push({
          candidate,
          classification: {
            is_lead: false,
            confidence: 0,
            reason: `Malformed AI output: ${error.message}`,
            problem_type: "unknown",
            manufacturing_type: "unknown",
            problem_summary: candidate.title,
            suggested_reply: candidate.suggested_reply,
          },
        });
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`AI prelead classifier request failed for ${candidate.source_url}: ${message}`);
      results.push({
        candidate,
        classification: {
            is_lead: false,
            confidence: 0,
            reason: `AI request failed: ${message}`,
            problem_type: "unknown",
            manufacturing_type: "unknown",
            problem_summary: candidate.title,
            suggested_reply: candidate.suggested_reply,
          },
      });
    }
  }

  return results;
}
