import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientIp,
  loginDecision,
  PAIR_MAX_FAILS,
  IP_MAX_FAILS,
  USER_SOFT_FAILS,
  USER_DELAY_MS,
  USERNAME_MAX,
} from "../src/lib/login-policy.ts";
import { USERNAME_RE } from "../src/lib/validate.ts";

test("USERNAME_MAX matches the longest login USERNAME_RE accepts", () => {
  assert.equal(USERNAME_RE.test("a".repeat(USERNAME_MAX)), true);
  assert.equal(USERNAME_RE.test("a".repeat(USERNAME_MAX + 1)), false);
});

const h = (o: Record<string, string>) => new Headers(o);

test("clientIp ignores a client-supplied X-Forwarded-For", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "1.2.3.4" })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-forwarded-for": "6.6.6.6" })), "unknown");
});

test("clientIp takes x-real-ip, then the first x-vercel-forwarded-for value", () => {
  assert.equal(clientIp(h({ "x-real-ip": " 1.2.3.4 " })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-vercel-forwarded-for": "5.6.7.8, 10.0.0.1" })), "5.6.7.8");
  assert.equal(clientIp(h({})), "unknown");
});

test("the (login, IP) pair is blocked after PAIR_MAX_FAILS failures", () => {
  assert.equal(PAIR_MAX_FAILS, 5);
  assert.deepEqual(loginDecision({ pairFails: 4, ipFails: 4, userFails: 4 }), { blocked: false, delayMs: 0 });
  assert.equal(loginDecision({ pairFails: 5, ipFails: 5, userFails: 5 }).blocked, true);
});

test("one IP is blocked after IP_MAX_FAILS failures across any logins", () => {
  assert.equal(IP_MAX_FAILS, 20);
  assert.equal(loginDecision({ pairFails: 0, ipFails: 19, userFails: 0 }).blocked, false);
  assert.equal(loginDecision({ pairFails: 0, ipFails: 20, userFails: 0 }).blocked, true);
});

test("many failures on one login from many IPs only slow it down, never block", () => {
  assert.equal(USER_SOFT_FAILS, 50);
  assert.equal(USER_DELAY_MS, 2000);
  assert.deepEqual(loginDecision({ pairFails: 0, ipFails: 0, userFails: 49 }), { blocked: false, delayMs: 0 });
  assert.deepEqual(loginDecision({ pairFails: 0, ipFails: 0, userFails: 50 }), { blocked: false, delayMs: 2000 });
  assert.deepEqual(loginDecision({ pairFails: 0, ipFails: 0, userFails: 100000 }), { blocked: false, delayMs: 2000 });
});
