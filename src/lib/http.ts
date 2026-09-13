import { z, ZodError } from "zod";
import {
  authorizeRequest,
  getAIProvider,
  getDataMode,
  type Access,
} from "./auth";
import { getRepository, type Repository } from "./repository";
import { ApiError } from "./errors";
export const filterSchema = z
  .object({
    days: z.coerce
      .number()
      .pipe(z.union([z.literal(7), z.literal(14), z.literal(28)]))
      .default(7),
    channel: z.enum(["all", "google", "meta"]).default("all"),
  })
  .strict();
export const queryFilters = (request: Request) =>
  filterSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
export async function readJson(request: Request): Promise<unknown> {
  const cap = 2 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > cap)
    throw new ApiError(413, "Upload exceeds 2 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > cap) {
      await reader.cancel();
      throw new ApiError(413, "Upload exceeds 2 MB.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Body must be valid JSON.");
  }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: `Invalid input at ${error.issues[0]?.path.join(".") || "request"}: ${error.issues[0]?.message}`,
      },
      { status: 400 },
    );
  return Response.json(
    {
      error:
        "Request failed. Check the application configuration or try again.",
    },
    { status: 500 },
  );
}
export async function withRepository(
  request: Request,
  handler: (repo: Repository, access: Access) => Promise<unknown>,
  workflow = false,
): Promise<Response> {
  try {
    const access = authorizeRequest(request, workflow),
      repo = getRepository(access.sessionId);
    const data = await handler(repo, access);
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (access.cookie) headers.set("Set-Cookie", access.cookie);
    if (data instanceof Response) {
      for (const [key, value] of headers) data.headers.set(key, value);
      return data;
    }
    return Response.json(data, { headers });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
export function publicConfig() {
  return { mode: getDataMode(), aiProvider: getAIProvider() };
}
