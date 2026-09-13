import { queryFilters, withRepository } from "@/lib/http";
import { buildDashboard } from "@/lib/dashboard-data";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return withRepository(request, async (repo) => {
    const { days, channel } = queryFilters(request);
    return buildDashboard(await repo.read(), days, channel);
  });
}
