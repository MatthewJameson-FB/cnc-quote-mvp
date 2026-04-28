import { readFile } from "node:fs/promises";
import { defaultPreleadLearningLogPath, type HumanLabel, type PreleadLearningLogRow } from "@/lib/prelead-learning-log";

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function topEntries(map: Map<string, number>, limit = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function deriveDomain(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    return "unknown";
  }
}

function deriveSubreddit(sourceUrl: string) {
  const match = sourceUrl.match(/reddit\.com\/r\/([^/]+)/i);
  return match?.[1] ?? null;
}

function getOutcomeLabel(row: PreleadLearningLogRow): HumanLabel {
  if (row.human_label) {
    return row.human_label;
  }

  if (row.inserted_to_pre_leads) {
    return "good";
  }

  if (row.ai_is_lead === false || row.rejection_reason) {
    return "bad";
  }

  return "maybe";
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const STOPWORDS = new Set([
  "about", "after", "again", "also", "anyone", "around", "been", "being", "but", "can", "could", "does", "dont",
  "from", "get", "getting", "have", "help", "here", "into", "just", "like", "look", "made", "make", "need", "part",
  "parts", "please", "really", "should", "some", "someone", "that", "their", "them", "they", "this", "trying", "used",
  "using", "want", "what", "when", "where", "which", "with", "would", "your", "reddit", "machined", "machining", "custom",
]);

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  const logPath = defaultPreleadLearningLogPath();
  const raw = await readFile(logPath, "utf8").catch(() => "");

  if (!raw.trim()) {
    console.log(`No learning log data found at ${logPath}`);
    return;
  }

  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as PreleadLearningLogRow];
      } catch {
        return [];
      }
    });

  if (rows.length === 0) {
    console.log(`No parseable learning log rows found at ${logPath}`);
    return;
  }

  const rejectionReasons = new Map<string, number>();
  const queryStats = new Map<string, { good: number; bad: number; maybe: number }>();
  const sourceStats = new Map<string, { good: number; bad: number; maybe: number }>();
  const badTokens = new Map<string, number>();
  const goodTokens = new Map<string, number>();

  for (const row of rows) {
    const outcome = getOutcomeLabel(row);
    const query = row.query_used?.trim() || "(unknown query)";
    const sourceKey = deriveSubreddit(row.source_url) ? `r/${deriveSubreddit(row.source_url)}` : deriveDomain(row.source_url);

    if (!queryStats.has(query)) {
      queryStats.set(query, { good: 0, bad: 0, maybe: 0 });
    }
    if (!sourceStats.has(sourceKey)) {
      sourceStats.set(sourceKey, { good: 0, bad: 0, maybe: 0 });
    }

    queryStats.get(query)![outcome] += 1;
    sourceStats.get(sourceKey)![outcome] += 1;

    if (row.rejection_reason) {
      increment(rejectionReasons, row.rejection_reason);
    }

    const tokens = tokenize(`${row.title} ${row.snippet}`).filter((token) => token.length >= 4 && !STOPWORDS.has(token));
    const tokenMap = outcome === "good" ? goodTokens : outcome === "bad" ? badTokens : null;
    if (tokenMap) {
      for (const token of new Set(tokens)) {
        increment(tokenMap, token);
      }
    }
  }

  const formatStats = ([key, value]: [string, { good: number; bad: number; maybe: number }]) =>
    `${key} -> good:${value.good} bad:${value.bad} maybe:${value.maybe}`;

  const sortedGoodQueries = [...queryStats.entries()]
    .filter(([, stats]) => stats.good > 0)
    .sort((a, b) => b[1].good - a[1].good || a[1].bad - b[1].bad || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const sortedBadQueries = [...queryStats.entries()]
    .filter(([, stats]) => stats.bad > 0)
    .sort((a, b) => b[1].bad - a[1].bad || a[1].good - b[1].good || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const sortedGoodSources = [...sourceStats.entries()]
    .sort((a, b) => b[1].good - a[1].good || a[1].bad - b[1].bad || a[0].localeCompare(b[0]))
    .slice(0, 8);

  const queryChangeSuggestions = [...queryStats.entries()]
    .flatMap(([query, stats]) => {
      if (stats.bad >= 3 && stats.bad >= stats.good * 2) {
        return [`Rewrite or pause query: ${query} (good:${stats.good} bad:${stats.bad})`];
      }
      if (stats.good >= 2 && stats.good >= stats.bad) {
        return [`Expand query family: ${query} (good:${stats.good} bad:${stats.bad})`];
      }
      return [];
    })
    .slice(0, 8);

  const keywordSuggestions = [...badTokens.entries()]
    .map(([token, badCount]) => ({ token, badCount, goodCount: goodTokens.get(token) ?? 0 }))
    .filter(({ token, badCount, goodCount }) => badCount >= 2 && goodCount === 0 && !/^\d+$/.test(token))
    .sort((a, b) => b.badCount - a.badCount || a.token.localeCompare(b.token))
    .slice(0, 12)
    .map(({ token, badCount }) => `${token} (${badCount})`);

  console.log(`Learning log: ${logPath}`);
  console.log(`Rows analyzed: ${rows.length}`);
  console.log("");
  console.log("Common rejection reasons:");
  for (const [reason, count] of topEntries(rejectionReasons, 10)) {
    console.log(`- ${reason}: ${count}`);
  }
  if (rejectionReasons.size === 0) {
    console.log("- None yet.");
  }
  console.log("");
  console.log("Queries producing good candidates:");
  for (const entry of sortedGoodQueries.map(formatStats)) {
    console.log(`- ${entry}`);
  }
  if (sortedGoodQueries.length === 0) {
    console.log("- None yet.");
  }
  console.log("");
  console.log("Queries producing bad candidates:");
  for (const entry of sortedBadQueries.map(formatStats)) {
    console.log(`- ${entry}`);
  }
  if (sortedBadQueries.length === 0) {
    console.log("- None yet.");
  }
  console.log("");
  console.log("Domains/subreddits producing good candidates:");
  for (const entry of sortedGoodSources.map(formatStats)) {
    console.log(`- ${entry}`);
  }
  if (sortedGoodSources.length === 0) {
    console.log("- None yet.");
  }
  console.log("");
  console.log("Suggested query changes:");
  for (const suggestion of queryChangeSuggestions) {
    console.log(`- ${suggestion}`);
  }
  if (queryChangeSuggestions.length === 0) {
    console.log("- Not enough signal yet.");
  }
  console.log("");
  console.log("Suggested bad-keyword updates:");
  for (const suggestion of keywordSuggestions) {
    console.log(`- ${suggestion}`);
  }
  if (keywordSuggestions.length === 0) {
    console.log("- Not enough signal yet.");
  }
}

void main();
