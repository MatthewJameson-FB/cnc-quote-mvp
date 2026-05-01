import { NextResponse } from "next/server";
import { runPreleadMonitor } from "@/lib/preleads";
import { sendCronPreleadSummaryEmail } from "@/lib/notifications";

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

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

export async function handleFindPreleadsCron(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = extractSecret(req);

  if (!expected || provided !== expected) {
    return unauthorized();
  }

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

    return NextResponse.json({
      success: true,
      searches_used: result.searches_used,
      fetched: result.fetched,
      sent_to_ai: result.sent_to_ai,
      accepted: result.accepted,
      inserted: result.inserted,
      duplicates: result.duplicates,
      skipped_budget: result.skipped_budget,
      quota_exhausted: result.quota_exhausted,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error("CRON FIND-PRELEADS ERROR:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Failed to run discovery." }, { status: 500 });
  }
}
