import type { NextConfig } from "next";
import { ATTACHMENT_CSP } from "./src/lib/helper/csp";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const common = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The nightly reset reads these at runtime (src/lib/demo/seed.ts).
  outputFileTracingIncludes: {
    "/api/demo/reset": ["./sql/schema.sql", "./scripts/seed-data.json", "./data/catalog/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: common },
      // Site CSP everywhere except uploaded files: config headers override the route's own,
      // so attachments must be excluded here and get their strict policy below.
      { source: "/:path((?!api/helper/attachments/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
      { source: "/api/helper/attachments/:id", headers: [{ key: "Content-Security-Policy", value: ATTACHMENT_CSP }] },
    ];
  },
};

export default nextConfig;
