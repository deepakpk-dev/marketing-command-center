import { queryFilters, withRepository } from "@/lib/http";
import { buildEvidence } from "@/lib/analyst";
import { exportCsv } from "@/lib/csv";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return withRepository(request, async (repo) => {
    const { days, channel } = queryFilters(request),
      evidence = buildEvidence(await repo.read(), days, channel);
    return new Response(exportCsv(evidence.campaigns), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="signal-${channel}-${evidence.end}-${days}d.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
