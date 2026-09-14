import { z } from "zod";
import { checkOrigin, enforceRateLimit, requestOrigin } from "@/lib/auth";
import {
  authorizeConnected,
  createRequestAuth,
  workspaceId,
  type RequestAuth,
} from "@/lib/supabase-auth";
import { errorResponse, readJson } from "@/lib/http";
import { memberInput, inviteMember } from "@/lib/members";
import { roleSchema } from "@/lib/permissions";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
async function handle(
  request: Request,
  action: (auth: RequestAuth) => Promise<unknown>,
) {
  let auth: RequestAuth | undefined;
  try {
    checkOrigin(request);
    auth = createRequestAuth(request);
    await authorizeConnected(auth, "manageMembers");
    return auth.finalize(Response.json(await action(auth)));
  } catch (error) {
    const response = errorResponse(error);
    return auth ? auth.finalize(response) : response;
  }
}
export async function GET(request: Request) {
  return handle(request, async (auth) => {
    const { data, error } = await auth.client.rpc("list_members", {
      p_workspace: workspaceId(),
    });
    if (error) throw new ApiError(403, "Administrator access is required.");
    return { members: data };
  });
}
export async function POST(request: Request) {
  return handle(request, async (auth) => {
    const { email, role } = memberInput.parse(await readJson(request));
    const access = await authorizeConnected(auth, "manageMembers");
    enforceRateLimit(`invite:${access.sessionId}`, 10, 3600000);
    return inviteMember(auth.client, email, role, requestOrigin(request));
  });
}
export async function PATCH(request: Request) {
  return handle(request, async (auth) => {
    const input = z
      .object({ userId: z.uuid(), role: roleSchema.nullable() })
      .strict()
      .parse(await readJson(request));
    const { error } = await auth.client.rpc("set_member", {
      p_workspace: workspaceId(),
      p_user: input.userId,
      p_role: input.role,
    });
    if (error)
      throw new ApiError(
        error.message.includes("last administrator") ? 409 : 403,
        error.message.includes("last administrator")
          ? "The last administrator cannot be removed or demoted."
          : "Membership update denied. Refresh and check your administrator permissions.",
      );
    return {
      message: input.role
        ? "Workspace role updated."
        : "Workspace access removed.",
    };
  });
}
