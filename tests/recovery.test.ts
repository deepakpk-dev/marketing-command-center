import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/session/recovery/route";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function request(email: string, origin = "https://app.test") {
  return new Request("https://app.test/api/session/recovery", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
function setup() {
  vi.stubEnv("DATA_MODE", "supabase");
  vi.stubEnv("APP_ORIGIN", "https://app.test");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-public-key");
}
describe("password recovery", () => {
  it("uses the configured return address and returns a generic message", async () => {
    setup();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const response = await POST(request("known@test.invalid"));
    expect(response.status).toBe(200);
    expect((await response.json()).message).toMatch(/If this address/);
    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      encodeURIComponent("https://app.test/auth/reset"),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects cross-origin requests before contacting email service", async () => {
    setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (await POST(request("cross@test.invalid", "https://evil.test"))).status,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports provider outages without exposing provider details", async () => {
    setup();
    vi.stubGlobal("fetch", async () =>
      Response.json(
        { msg: "private provider detail", code: "unexpected_failure" },
        { status: 500 },
      ),
    );
    const response = await POST(request("outage@test.invalid"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider detail");
  });
});
