import { NextResponse } from "next/server";
import { runPreleadMonitor } from "@/lib/preleads";
import { sendCronPreleadSummaryEmail } from "@/lib/notifications";
import {
  finalizeDiscoveryRun,
  safeDiscoveryErrorMessage,
  startDiscoveryRun,
  type DiscoveryTriggerType,
} from "@/lib/discovery-runs";
import { generateDiscoveryOptimisationReport } from "@/lib/discovery-optimisation";

function extractSecret(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const secret = new URL(req.url).searchParams.get("secret") ?? "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return (secret || headerSecret).trim();
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.flangie.co.uk";
}

function getTriggerType(req: Request): DiscoveryTriggerType {
  const url = new URL(req.url);
  const requested = (url.searchParams.get("trigger_type") ?? url.searchParams.get("trigger") ?? req.headers.get("x-trigger-type") ?? "cron").trim().toLowerCase();

  if (requested === "manual" || requested === "local") return requested;
  return "cron";
}

export async function runDiscoveryPreleadWorkflow(triggerType: DiscoveryTriggerType) {
  const runId = await startDiscoveryRun(triggerType);

  try {
    const result = await runPreleadMonitor({
      persistJson: false,
      persistSupabase: true,
      sendEmail: false,
      minScore: Number(process.env.PRELEAD_MIN_SCORE ?? 6),
      maxResults: Number(process.env.PRELEAD_MAX_RESULTS ?? 10),
    });

    if (result.inserted > 0) {
      await sendCronPreleadSummaryEmail({
        inserted: result.inserted,
        accepted: result.accepted,
        topAcceptedTitles: result.top_accepted_titles,
        adminLink: `${getAppBaseUrl()}/admin/preleads?value=high`,
      });
    }

    await finalizeDiscoveryRun({
      runId,
      triggerType,
      status: "success",
      result,
      errorMessage: null,
    });

    if (runId) {
      const optimisation = await generateDiscoveryOptimisationReport(runId);
      if (optimisation.success) {
        console.log(`[discovery] optimisation report saved${optimisation.report_id ? ` id=${optimisation.report_id}` : ""}`);
      } else if (optimisation.error) {
        console.warn(`[discovery] optimisation report skipped: ${optimisation.error.message}`);
      }
    }

    return {
      success: true,
      run_id: runId,
      trigger_type: triggerType,
      searches_used: result.searches_used,
      fetched: result.fetched,
      sent_to_ai: result.sent_to_ai,
      accepted: result.accepted,
      inserted: result.inserted,
      duplicates: result.duplicates,
      skipped_budget: result.skipped_budget,
      quota_exhausted: result.quota_exhausted,
      timestamp: result.timestamp,
    };
  } catch (error) {
    const safeError = safeDiscoveryErrorMessage(error);
    console.error("CRON FIND-PRELEADS ERROR:", safeError);

    try {
      await finalizeDiscoveryRun({
        runId,
        triggerType,
        status: "error",
        result: {
          searches_used: 0,
          fetched: 0,
          sent_to_ai: 0,
          accepted: 0,
          inserted: 0,
          duplicates: 0,
          skipped_budget: 0,
          quota_exhausted: false,
          timestamp: new Date().toISOString(),
          top_accepted_titles: [],
          query_stats: [],
        },
        errorMessage: safeError,
      });
    } catch (persistError) {
      console.error("CRON FIND-PRELEADS HISTORY ERROR:", safeDiscoveryErrorMessage(persistError));
    }

    return { success: false, error: "Failed to run discovery." };
  }
}

export async function runDiscoveryPreleadMonitor(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = extractSecret(req);
  const triggerType = getTriggerType(req);

  if (!expected || provided !== expected) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDiscoveryPreleadWorkflow(triggerType);
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

export async function handleFindPreleadsCron(req: Request) {
  return runDiscoveryPreleadMonitor(req);
}
