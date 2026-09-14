import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    if (!process.env.APP_ORIGIN) return [];
    const canonical = new URL(process.env.APP_ORIGIN);
    if (!["https:", "http:"].includes(canonical.protocol))
      throw new Error("APP_ORIGIN must be an HTTP or HTTPS origin.");
    const hostname = canonical.hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Account pages share the same domain as Auth redirects and session cookies.
    // API endpoints are never redirected across domains with request bodies.
    return ["/", "/auth/:path*"].map((source) => ({
      source,
      destination: `${canonical.origin}${source}`,
      missing: [{ type: "host" as const, value: hostname }],
      permanent: false,
    }));
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
