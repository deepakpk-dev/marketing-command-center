import { afterEach, describe, expect, it, vi } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import config from "../next.config";

afterEach(() => vi.unstubAllEnvs());

describe("canonical account domain", () => {
  it.each(["/", "/auth/recover", "/auth/reset?source=email", "/auth/accept"])(
    "routes alias page %s to the configured account domain",
    async (path) => {
      vi.stubEnv("APP_ORIGIN", "https://accounts.test");
      const response = await unstable_getResponseFromNextConfig({
        url: `https://alias.test${path}`, nextConfig: config,
      });
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://accounts.test${path}`);
    },
  );
  it.each(["https://accounts.test/", "https://alias.test/api/session", "https://alias.test/api/session/exchange"])(
    "does not redirect the canonical page or API request %s", async (url) => {
      vi.stubEnv("APP_ORIGIN", "https://accounts.test");
      const response = await unstable_getResponseFromNextConfig({ url, nextConfig: config });
      expect(response.headers.get("location")).toBeNull();
    },
  );
  it("leaves unconfigured demo installations on their current domain", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    const response = await unstable_getResponseFromNextConfig({ url: "http://localhost:3000/", nextConfig: config });
    expect(response.headers.get("location")).toBeNull();
  });
});
