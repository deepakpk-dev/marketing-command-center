import { z } from "zod";
import {
  checkOrigin,
  cookieValue,
  createSessionToken,
  enforceRateLimit,
  getDataMode,
  requestOrigin,
  secureEqual,
  sessionConfig,
  verifySessionToken,
} from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const mode = getDataMode();
    return Response.json(
      {
        mode,
        authenticated:
          mode === "demo" ||
          verifySessionToken(
            cookieValue(request, "signal_auth") || "",
            sessionConfig().secret,
          ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    enforceRateLimit("workspace-login", 20, 60000);
    const input = z
        .object({ password: z.string().max(200) })
        .strict()
        .parse(await readJson(request)),
      config = sessionConfig();
    if (!secureEqual(input.password, config.password))
      throw new ApiError(401, "Incorrect workspace password.");
    return Response.json(
      { authenticated: true },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": `signal_auth=${createSessionToken(config.secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${requestOrigin(request).startsWith("https:") ? "; Secure" : ""}`,
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    return Response.json(
      { authenticated: false },
      {
        headers: {
          "Set-Cookie":
            "signal_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
