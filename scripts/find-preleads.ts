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
  const { runDiscoveryPreleadWorkflow } = await import("@/lib/cron-find-preleads");

  const result = await runDiscoveryPreleadWorkflow("local");

  if (result.success) {
    console.log(
      `Scanned discovery pipeline, searches_used=${result.searches_used}, fetched=${result.fetched}, sent_to_ai=${result.sent_to_ai}, accepted=${result.accepted}, inserted=${result.inserted}, duplicates=${result.duplicates}, quota_exhausted=${result.quota_exhausted ? "yes" : "no"}`
    );
  } else {
    console.log(result.error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
