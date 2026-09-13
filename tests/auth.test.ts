import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  authorizeRequest,
} from "../src/lib/auth";
afterEach(() => vi.unstubAllEnvs());
describe("server authorization", () => {
  it("accepts the browser origin when Next normalizes the internal request hostname", () => {
    vi.stubEnv("DATA_MODE", "demo");
    const request = new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    });
    expect(() => authorizeRequest(request)).not.toThrow();
  });
  it("rejects tampered and expired signed sessions", () => {
    const key = "x".repeat(40);
    const token = createSessionToken(key, 1000);
    expect(verifySessionToken(token, key, 1100)).toBe(true);
    expect(verifySessionToken(token + "x", key, 1100)).toBe(false);
    expect(verifySessionToken(token, key, 1000 + 8 * 86400)).toBe(false);
  });
  it("requires authentication for every connected data request", () => {
    vi.stubEnv("DATA_MODE", "supabase");
    vi.stubEnv("APP_PASSWORD", "a-strong-reviewer-password");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    expect(() =>
      authorizeRequest(new Request("https://app.test/api/dashboard")),
    ).toThrow(/sign in/i);
  });
  it("rejects cross-origin cookie mutations", () => {
    vi.stubEnv("DATA_MODE", "demo");
    expect(() =>
      authorizeRequest(
        new Request("https://app.test/api/analyze", {
          method: "POST",
          headers: { origin: "https://evil.test" },
        }),
      ),
    ).toThrow(/origin/i);
  });
  it("does not accept workflow tokens on approval endpoints", () => {
    vi.stubEnv("DATA_MODE", "supabase");
    vi.stubEnv("APP_PASSWORD", "a-strong-reviewer-password");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    vi.stubEnv("WORKFLOW_TOKEN", "w".repeat(40));
    const req = new Request("https://app.test/api/approve", {
      method: "POST",
      headers: { authorization: "Bearer " + "w".repeat(40) },
    });
    expect(() => authorizeRequest(req, true)).not.toThrow();
    expect(() => authorizeRequest(req, false)).toThrow(/sign in/i);
  });
});
