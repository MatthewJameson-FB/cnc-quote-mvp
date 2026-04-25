import { NextResponse } from "next/server";
import { runPreleadMonitor } from "@/lib/preleads";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return unauthorized();
  }

  const result = await runPreleadMonitor({
    persistJson: false,
    persistSupabase: true,
    sendEmail: true,
    minScore: Number(process.env.PRELEAD_MIN_SCORE ?? 6),
    maxResults: Number(process.env.PRELEAD_MAX_RESULTS ?? 10),
  });

  if (result.qualifying === 0) {
    return NextResponse.json({
      success: true,
      qualifying: 0,
      savedToSupabase: 0,
      emailed: false,
    });
  }

  return NextResponse.json({
    success: true,
    qualifying: result.qualifying,
    savedToSupabase: result.savedToSupabase,
    emailed: result.emailed,
  });
}
