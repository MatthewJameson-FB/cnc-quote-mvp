import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * Pre-lead finder.
 *
 * Respect robots.txt, site terms, and rate limits. Only add public URLs you’re
 * allowed to fetch, and keep request volume low.
 *
 * This script never contacts anyone. It only writes candidate leads to
 * data/preleads.json for manual review.
 */

async function main() {
  const { runPreleadMonitor, defaultPreleadOutputPath } = await import("@/lib/preleads");

  const result = await runPreleadMonitor({
    persistJson: true,
    persistSupabase: true,
    sendEmail: true,
    minScore: 6,
    outputPath: defaultPreleadOutputPath(),
  });

  console.log(
    `Scanned ${result.scanned} sources, found ${result.qualifying} qualifying preleads, saved ${result.savedToSupabase} to Supabase, wrote JSON: ${result.savedToJson ? "yes" : "no"}, emailed: ${result.emailed ? "yes" : "no"}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
