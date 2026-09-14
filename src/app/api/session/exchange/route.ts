import { z } from "zod";
import { checkOrigin, enforceRateLimit } from "@/lib/auth";
import {
  authorizeConnected,
  createRequestAuth,
  type RequestAuth,
} from "@/lib/supabase-auth";
import { errorResponse, readJson } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let auth: RequestAuth | undefined;
  try {
    checkOrigin(request);
    enforceRateLimit("invitation-exchange", 30, 60000);
    const legacyInput = z
      .object({
        access_token: z.string().min(20).max(16000),
        refresh_token: z.string().min(5).max(16000),
      })
      .strict();
    const input = z
      .union([
        legacyInput,
        z
          .object({
            token_hash: z.string().min(20).max(512),
            type: z.enum(["invite", "recovery"]),
          })
          .strict(),
      ])
      .parse(await readJson(request));
    auth = createRequestAuth(request);
    const { error } =
      "token_hash" in input
        ? await auth.client.auth.verifyOtp(input)
        : await auth.client.auth.setSession(input);
    if (error)
      throw new ApiError(
        401,
        "This email link has expired or is invalid. Request a new reset link or ask your administrator to resend your invitation.",
      );
    await authorizeConnected(auth);
    return auth.finalize(
      Response.json({
        message: "Invitation verified. Set your individual password.",
      }),
    );
  } catch (error) {
    const response = errorResponse(error);
    return auth ? auth.finalize(response) : response;
  }
}
