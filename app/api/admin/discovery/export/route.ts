import { NextResponse } from "next/server";
import { getAuthenticatedAdminUser, isAllowedAdminEmail } from "@/lib/admin-auth";
import { loadDiscoveryExportData } from "@/lib/discovery-optimisation";
import { toDiscoverySafeError } from "@/lib/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedAdminUser();
  if (!user || !isAllowedAdminEmail(user.email)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await loadDiscoveryExportData();
    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      runs: data.runs,
      query_stats: data.query_stats,
      aggregated_query_performance: data.aggregated_query_performance,
      error,
    });
  } catch (error) {
    const safeError = toDiscoverySafeError(error);
    console.error("[discovery-export] Supabase error", safeError);
    return NextResponse.json(
      {
        success: false,
        error: safeError.message,
        code: safeError.code,
        details: safeError.details,
        hint: safeError.hint,
        runs: [],
        query_stats: [],
        aggregated_query_performance: [],
      },
      { status: 500 }
    );
  }
}
