import { handleFindPreleadsCron } from "@/lib/cron-find-preleads";

export const dynamic = "force-dynamic";

// curl -H "Authorization: Bearer $CRON_SECRET" https://www.flangie.co.uk/api/cron/find-preleads
export async function GET(req: Request) {
  return handleFindPreleadsCron(req);
}
