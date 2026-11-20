// Login throttling rules. Pure functions: the route counts failures, this decides.
//
// - A (login, IP) pair is blocked after PAIR_MAX_FAILS failures, so someone guessing
//   from one address cannot lock the real owner out from another one.
// - One IP is blocked after IP_MAX_FAILS failures across any logins (password spraying).
// - A login under attack from many addresses is only slowed down, never blocked.
// Counts are kept by the login string whether or not such a user exists, so an
// existing and a non-existing login answer exactly the same.

export const WINDOW_MINUTES = 15;
export const PAIR_MAX_FAILS = 5;
export const IP_MAX_FAILS = 20;
export const USER_WINDOW_MINUTES = 60;
export const USER_SOFT_FAILS = 50;
export const USER_DELAY_MS = 2000;
// Same upper bound as USERNAME_RE in src/lib/validate.ts.
export const USERNAME_MAX = 32;

// On Vercel both headers are set by the platform to the real client address and
// cannot be forged by the client, unlike the first value of X-Forwarded-For.
// Off Vercel, put the app behind a proxy that overwrites x-real-ip.
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  return vercel || "unknown";
}

export type FailureCounts = { pairFails: number; ipFails: number; userFails: number };

export function loginDecision(c: FailureCounts): { blocked: boolean; delayMs: number } {
  return {
    blocked: c.pairFails >= PAIR_MAX_FAILS || c.ipFails >= IP_MAX_FAILS,
    delayMs: c.userFails >= USER_SOFT_FAILS ? USER_DELAY_MS : 0,
  };
}
