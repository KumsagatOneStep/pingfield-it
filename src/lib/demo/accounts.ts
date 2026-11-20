// Public demo accounts. The passwords are shown on the login page on purpose.
import type { Role } from "../validate.ts";

export type DemoAccount = {
  username: "demo_editor" | "demo_admin";
  password: string;
  role: Role;
  fullName: string;
  actName: string;
  position: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { username: "demo_editor", password: "demo-editor-2026", role: "editor", fullName: "Иван Иванов", actName: "Иванов И. И.", position: "Системный администратор" },
  { username: "demo_admin", password: "demo-admin-2026", role: "admin", fullName: "Елена Смирнова", actName: "Смирнова Е. В.", position: "Руководитель IT-отдела" },
];

export const isDemoUsername = (u: string): boolean => DEMO_ACCOUNTS.some((a) => a.username === u);
