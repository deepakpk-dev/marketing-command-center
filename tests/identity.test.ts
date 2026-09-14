import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeConnected,
  createRequestAuth,
} from "../src/lib/supabase-auth";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("connected route identity", () => {
  it("does not accept the old shared-password cookie as a user identity", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const request = new Request("https://app.test/api/dashboard", {
      headers: { cookie: "signal_auth=123.spoofed" },
    });
    const auth = createRequestAuth(request);
    await expect(authorizeConnected(auth, "read")).rejects.toMatchObject({
      status: 401,
    });
  });
  it("validates server identity and current membership before granting access", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const auth = createRequestAuth(new Request("https://app.test/api/ingest"));
    // Only external Auth and REST calls are substituted; authorization logic stays real.
    vi.spyOn(auth.client.auth, "getUser").mockResolvedValue({
      data: {
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          email: "viewer@test.invalid",
          app_metadata: {},
          user_metadata: { role: "admin" },
          aud: "authenticated",
          created_at: "2026-09-13T00:00:00Z",
        },
      },
      error: null,
    });
    vi.stubGlobal("fetch", async () => Response.json([{ role: "viewer" }]));
    await expect(authorizeConnected(auth, "ingest")).rejects.toMatchObject({
      status: 403,
    });
    const access = await authorizeConnected(auth, "read");
    expect(access.role).toBe("viewer");
    expect(access.user?.email).toBe("viewer@test.invalid");
  });
  it("keeps all refreshed cookies and private cache headers on error responses", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const auth = createRequestAuth(new Request("https://app.test/api/session"));
    vi.stubGlobal("fetch", async () =>
      Response.json({
        access_token: "not-a-jwt",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-09-13T00:00:00Z",
        },
      }),
    );
    await auth.client.auth.signInWithPassword({
      email: "test@test.invalid",
      password: "test-password",
    });
    const response = auth.finalize(
      Response.json({ error: "Permission denied" }, { status: 403 }),
    );
    expect(response.headers.get("cache-control")).toMatch(/private.*no-store/);
    expect(
      response.headers
        .getSetCookie()
        .some(
          (cookie) => cookie.includes("HttpOnly") && cookie.includes("Secure"),
        ),
    ).toBe(true);
    expect(response.status).toBe(403);
  });
});
