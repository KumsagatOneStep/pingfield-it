// Keeps the public demo usable: visitors (including the demo admin) cannot lock others out of the demo accounts.
import { isDemoUsername } from "./accounts.ts";

export const DEMO_LOCKED = "Демо-аккаунт нельзя отключить, сменить ему роль или пароль";
export const DEMO_PASSWORD_LOCKED = "В демо-версии пароль не меняется";

type Target = { username: string; role: string; active: boolean };
type Change = { role?: unknown; active?: unknown; password?: unknown; [k: string]: unknown };

/** Error text when the change would alter a demo account's access, otherwise null. */
export function demoUserChangeError(target: Target, change: Change): string | null {
  if (!isDemoUsername(target.username)) return null;
  if (change.password !== undefined) return DEMO_LOCKED;
  if (change.role !== undefined && change.role !== target.role) return DEMO_LOCKED;
  if (change.active !== undefined && change.active !== target.active) return DEMO_LOCKED;
  return null;
}
