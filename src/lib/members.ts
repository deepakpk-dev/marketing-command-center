import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError } from "./errors";
import { roleSchema, type WorkspaceRole } from "./permissions";
import { createAdminClient, workspaceId } from "./supabase-auth";
export const memberInput = z
  .object({ email: z.email().trim().toLowerCase().max(320), role: roleSchema })
  .strict();
export async function findAuthUser(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error)
      throw new ApiError(
        503,
        "Account lookup failed. Check the Supabase server secret.",
      );
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new ApiError(
    503,
    "Account directory exceeds the MVP lookup limit. Add indexed account lookup before expanding.",
  );
}
export async function inviteMember(
  client: SupabaseClient,
  email: string,
  role: WorkspaceRole,
  origin: string,
) {
  const { error: permissionError } = await client.rpc("list_members", {
    p_workspace: workspaceId(),
  });
  if (permissionError)
    throw new ApiError(
      403,
      "Administrator permission is required to invite members.",
    );
  const admin = createAdminClient();
  let user = await findAuthUser(admin, email);
  let invited = false;
  if (!user || !user.email_confirmed_at) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/accept`,
    });
    if (error || !data.user)
      throw new ApiError(
        503,
        "Invitation could not be sent. Check Supabase email/SMTP settings and rate limits.",
      );
    user = data.user;
    invited = true;
  }
  const { error } = await client.rpc("set_member", {
    p_workspace: workspaceId(),
    p_user: z.uuid().parse(user.id),
    p_role: role,
  });
  if (error)
    throw new ApiError(
      403,
      "Workspace membership was not saved. An invitation may have been sent; retry granting access after checking your administrator role.",
    );
  return {
    userId: user.id,
    invited,
    message: invited
      ? "Invitation accepted by the email service and workspace access granted. Ask the recipient to check their inbox and spam folder."
      : "Existing account granted workspace access. The member can use their individual password.",
  };
}
