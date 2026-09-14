import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  checkOrigin,
  enforceRateLimit,
  getDataMode,
  requestOrigin,
} from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (getDataMode() !== "supabase")
      throw new ApiError(
        400,
        "Password recovery is available for connected accounts.",
      );
    const { email } = z
      .object({ email: z.email().trim().toLowerCase().max(320) })
      .strict()
      .parse(await readJson(request));
    enforceRateLimit("recovery-global", 20, 60000);
    enforceRateLimit(
      `recovery:${createHash("sha256").update(email).digest("hex")}`,
      1,
      60000,
    );
    const client = createClient(
      z.url().parse(process.env.SUPABASE_URL),
      z
        .string()
        .min(1)
        .parse(
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
        ),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          flowType: "implicit",
        },
      },
    );
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${requestOrigin(request)}/auth/reset`,
    });
    // The response never reveals whether an address has an account.
    if (
      error &&
      !["user_not_found", "email_not_confirmed"].includes(error.code || "")
    )
      throw new ApiError(
        error.status === 429 ? 429 : 503,
        "Recovery email is temporarily unavailable. Wait a minute and retry, or contact your administrator.",
      );
    return Response.json(
      {
        message:
          "If this address has an account, you’ll receive a password reset email. Check your inbox and spam folder.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
