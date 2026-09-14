import { randomUUID, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors";
export function getDataMode(): "demo" | "supabase" {
  const mode = process.env.DATA_MODE || "demo";
  if (mode !== "demo" && mode !== "supabase")
    throw new ApiError(503, "DATA_MODE must be demo or supabase.");
  return mode;
}
export function getAIProvider(): "demo" | "openai" {
  const provider = process.env.AI_PROVIDER || "demo";
  if (provider !== "demo" && provider !== "openai")
    throw new ApiError(503, "AI_PROVIDER must be demo or openai.");
  if (provider === "openai" && getDataMode() === "demo")
    throw new ApiError(503, "Live AI requires authenticated Supabase mode.");
  return provider;
}
export const secureEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function cookieValue(
  request: Request,
  name: string,
): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export function requestOrigin(request: Request): string {
  if (process.env.APP_ORIGIN) {
    try {
      const configured = new URL(process.env.APP_ORIGIN);
      if (["https:", "http:"].includes(configured.protocol))
        return configured.origin;
    } catch {
      /* Return a configuration error below. */
    }
    throw new ApiError(503, "APP_ORIGIN must be a valid HTTP or HTTPS origin.");
  }
  const url = new URL(request.url),
    host = request.headers.get("host");
  if (!host) return url.origin;
  if (!/^[a-zA-Z0-9.\-:\[\]]+$/.test(host))
    throw new ApiError(403, "Invalid request host.");
  const forwarded = request.headers.get("x-forwarded-proto");
  const protocol =
    forwarded === "https" || forwarded === "http"
      ? `${forwarded}:`
      : url.protocol;
  return new URL(`${protocol}//${host}`).origin;
}
export function checkOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== requestOrigin(request)) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError(403, "Cross-origin writes are not allowed.");
}
export interface Access {
  sessionId: string;
  cookie?: string;
  workflow: boolean;
  role?: import("./permissions").WorkspaceRole;
  user?: { id: string; email: string };
}
export function authorizeRequest(
  request: Request,
  allowWorkflow = false,
): Access {
  const bearer = request.headers.get("authorization"),
    configured = process.env.WORKFLOW_TOKEN;
  if (
    allowWorkflow &&
    configured &&
    configured.length >= 32 &&
    bearer &&
    secureEqual(bearer, `Bearer ${configured}`)
  )
    return { sessionId: "workflow", workflow: true };
  checkOrigin(request);
  if (getDataMode() === "supabase") {
    // Connected user access is asynchronous and verified by Supabase Auth.
    // Legacy shared-password cookies never grant access.
    throw new ApiError(401, "Sign in to view this workspace.");
  }
  const existing = cookieValue(request, "signal_demo");
  if (existing && /^[a-f0-9-]{36}$/.test(existing))
    return { sessionId: existing, workflow: false };
  const sessionId = randomUUID();
  return {
    sessionId,
    workflow: false,
    cookie: `signal_demo=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${requestOrigin(request).startsWith("https:") ? "; Secure" : ""}`,
  };
}
const limits = new Map<string, { count: number; reset: number }>();
export function enforceRateLimit(
  key: string,
  max: number,
  interval: number,
): void {
  const now = Date.now();
  for (const [id, limit] of limits) if (limit.reset <= now) limits.delete(id);
  if (!limits.has(key) && limits.size >= 1000)
    throw new ApiError(429, "Server is busy. Try again shortly.");
  const limit = limits.get(key) ?? { count: 0, reset: now + interval };
  if (limit.count >= max)
    throw new ApiError(429, "Too many requests. Try again later.");
  limit.count++;
  limits.set(key, limit);
}
