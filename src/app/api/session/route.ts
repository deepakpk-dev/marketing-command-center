import { z } from "zod";
import { checkOrigin, enforceRateLimit, getDataMode } from "@/lib/auth";
import {
  authorizeConnected,
  createRequestAuth,
  type RequestAuth,
} from "@/lib/supabase-auth";
import { errorResponse, readJson } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  let auth: RequestAuth | undefined;
  try {
    if (getDataMode() === "demo")
      return Response.json(
        { mode: "demo", authenticated: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    auth = createRequestAuth(request);
    try {
      const access = await authorizeConnected(auth);
      return auth.finalize(
        Response.json({
          mode: "supabase",
          authenticated: true,
          user: access.user,
          role: access.role,
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        return auth.finalize(
          Response.json({ mode: "supabase", authenticated: false }),
        );
      throw error;
    }
  } catch (error) {
    const response = errorResponse(error);
    return auth ? auth.finalize(response) : response;
  }
}
export async function POST(request: Request) {
  let auth: RequestAuth | undefined;
  try {
    checkOrigin(request);
    enforceRateLimit("workspace-login", 20, 60000);
    const input = z
      .object({
        email: z.email().trim().max(320),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(await readJson(request));
    auth = createRequestAuth(request);
    const { error } = await auth.client.auth.signInWithPassword(input);
    if (error)
      throw new ApiError(
        401,
        "Could not sign in. Check your invited email address and password.",
      );
    const access = await authorizeConnected(auth);
    return auth.finalize(
      Response.json({
        authenticated: true,
        user: access.user,
        role: access.role,
        message: "Signed in to your workspace.",
      }),
    );
  } catch (error) {
    const response = errorResponse(error);
    return auth ? auth.finalize(response) : response;
  }
}
export async function PUT(request: Request) {
  let auth: RequestAuth | undefined;
  try {
    checkOrigin(request);
    const input = z
      .object({ password: z.string().min(12).max(200) })
      .strict()
      .parse(await readJson(request));
    auth = createRequestAuth(request);
    const access = await authorizeConnected(auth);
    enforceRateLimit(`password:${access.sessionId}`, 5, 60000);
    const { error } = await auth.client.auth.updateUser({
      password: input.password,
    });
    if (error)
      throw new ApiError(
        400,
        "Password could not be updated. Use at least 12 characters and sign in again if necessary.",
      );
    return auth.finalize(
      Response.json({ message: "Your individual password has been updated." }),
    );
  } catch (error) {
    const response = errorResponse(error);
    return auth ? auth.finalize(response) : response;
  }
}
export async function DELETE(request: Request) {
  let auth: RequestAuth | undefined;
  try {
    checkOrigin(request);
    auth = createRequestAuth(request);
    const { error } = await auth.client.auth.signOut({ scope: "local" });
    if (error)
      throw new ApiError(503, "Sign-out could not be confirmed. Please retry.");
    return auth.finalize(
      Response.json({ authenticated: false, message: "Signed out." }),
    );
  } catch (error) {
    const response = errorResponse(error);
    return auth ? auth.finalize(response) : response;
  }
}
