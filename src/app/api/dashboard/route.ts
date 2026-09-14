import { queryFilters, withRepository } from "@/lib/http";
import { buildDashboard } from "@/lib/dashboard-data";
import { permissionsFor } from "@/lib/permissions";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return withRepository(request, async (repo, access) => {
    const { days, channel } = queryFilters(request);
    return {
      ...buildDashboard(await repo.read(), days, channel),
      ...(access.user && access.role
        ? {
            access: {
              user: access.user,
              role: access.role,
              permissions: permissionsFor(access.role),
            },
          }
        : {}),
    };
  });
}
