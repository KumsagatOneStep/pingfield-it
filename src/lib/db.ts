import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

// Local testing only: route queries through a local Neon HTTP proxy
// (e.g. ghcr.io/timowilhelm/local-neon-http-proxy) instead of Neon cloud.
if (process.env.NEON_LOCAL_PROXY) {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
}

let client: NeonQueryFunction<false, false> | null = null;

// Created lazily so `next build` works without DATABASE_URL.
export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}
