import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError } from "./errors";
import { checkOrigin, requestOrigin, type Access } from "./auth";
import { requirePermission, roleSchema, type Permission } from "./permissions";

export function workspaceId(): string {
  return z
    .uuid()
    .parse(process.env.WORKSPACE_ID || "11111111-1111-4111-8111-111111111111");
}
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new ApiError(
      503,
      "A server-side Supabase secret is required for invitations and workflows.",
    );
  return createClient(z.url().parse(process.env.SUPABASE_URL), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function createRequestAuth(request: Request) {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key)
    throw new ApiError(
      503,
      "Configure the Supabase publishable key for individual sign-ins.",
    );
  const jar = new Map(
    parseCookieHeader(request.headers.get("cookie") || "").map((c) => [
      c.name,
      c.value,
    ]),
  );
  const pending = new Map<string, { value: string; options: CookieOptions }>();
  const cacheHeaders = new Headers({
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    Expires: "0",
  });
  const secure = requestOrigin(request).startsWith("https:");
  const client = createServerClient(
    z.url().parse(process.env.SUPABASE_URL),
    key,
    {
      global: { fetch: (...args) => fetch(...args) },
      cookieOptions: { httpOnly: true, sameSite: "lax", secure, path: "/" },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies, headers) => {
          for (const { name, value, options } of cookies) {
            jar.set(name, value);
            pending.set(name, {
              value,
              options: {
                ...options,
                httpOnly: true,
                sameSite: "lax",
                secure,
                path: "/",
              },
            });
          }
          for (const [name, value] of Object.entries(headers))
            cacheHeaders.set(name, value);
        },
      },
    },
  );
  return {
    request,
    client,
    finalize(response: Response): Response {
      for (const [name, value] of cacheHeaders)
        response.headers.set(name, value);
      for (const [name, { value, options }] of pending)
        response.headers.append(
          "Set-Cookie",
          serializeCookieHeader(name, value, options),
        );
      return response;
    },
  };
}
export type RequestAuth = ReturnType<typeof createRequestAuth>;
export async function authorizeConnected(
  auth: RequestAuth,
  permission: Permission = "read",
): Promise<Access> {
  checkOrigin(auth.request);
  const { data, error } = await auth.client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous)
    throw new ApiError(
      401,
      "Sign in with your invited account to view this workspace.",
    );
  const { data: membership, error: memberError } = await auth.client
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId())
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (memberError)
    throw new ApiError(
      503,
      "Workspace permissions could not be checked. Apply the identity migration.",
    );
  if (!membership)
    throw new ApiError(
      403,
      "Your account does not have access to this workspace. Ask an administrator for an invitation.",
    );
  const role = roleSchema.parse(membership.role);
  requirePermission(role, permission);
  return {
    sessionId: data.user.id,
    workflow: false,
    role,
    user: { id: data.user.id, email: data.user.email || "Signed-in user" },
  };
}
