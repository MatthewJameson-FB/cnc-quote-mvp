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
    persistJson: true,
    persistSupabase: true,
    sendEmail: true,
    minScore: 6,
  });

  return NextResponse.json({
    success: true,
    scanned: result.scanned,
    qualifying: result.qualifying,
    savedToSupabase: result.savedToSupabase,
    emailed: result.emailed,
  });
}
