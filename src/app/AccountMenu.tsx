"use client";
// Account button in the top bar: name, login and role, password change, day/night, log out.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initials } from "@/lib/initials";
import { applyTheme, currentTheme, type Theme } from "./theme";

const ROLE_LABEL = { viewer: "просмотр", editor: "редактор", admin: "админ" } as const;
const SPRING = { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.95 };

export default function AccountMenu({ name, username, role }: { name: string; username: string; role: keyof typeof ROLE_LABEL }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(currentTheme()), []);
  const next: Theme = theme === "dark" ? "light" : "dark";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

  return (
    <Menu.Root modal={false} open={open} onOpenChange={setOpen}>
      <Menu.Trigger asChild>
        <button type="button" className="acct-trigger" aria-label={`Аккаунт: ${name}`}>
          <span className="acct-avatar acct-avatar-sm" aria-hidden>{initials(name)}</span>
          <span className="acct-name">{name}</span>
          <motion.span className="acct-chevron" animate={{ rotate: open ? 180 : 0 }} transition={SPRING}>
            <ChevronDown size={14} aria-hidden />
          </motion.span>
        </button>
      </Menu.Trigger>
      <AnimatePresence>
        {open && (
          <Menu.Portal forceMount>
            <Menu.Content forceMount align="end" sideOffset={8} collisionPadding={12} className="acct-content">
              <motion.div
                className="acct-panel"
                style={{ transformOrigin: "top right" }}
                initial={{ opacity: 0, scale: 0.985, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { opacity: { duration: 0.3 }, scale: SPRING, y: SPRING } }}
                exit={{ opacity: 0, scale: 0.985, y: -5, transition: { duration: 0.18 } }}
              >
                <div className="acct-head">
                  <span className="acct-avatar" aria-hidden>{initials(name)}</span>
                  <span className="acct-id">
                    <b>{name}</b>
                    <span className="mono">{username} · {ROLE_LABEL[role]}</span>
                  </span>
                </div>
                <Menu.Separator className="acct-sep" />
                <Menu.Item className="acct-item" onSelect={() => router.push("/account")}>
                  <KeyRound size={18} aria-hidden /> Сменить пароль
                </Menu.Item>
                <Menu.Item
                  className="acct-item"
                  onSelect={(e) => {
                    e.preventDefault(); // keep the menu open so the new label is visible
                    applyTheme(next);
                    setTheme(next);
                  }}
                >
                  {next === "light" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
                  {next === "light" ? "Дневной режим" : "Ночной режим"}
                </Menu.Item>
                <Menu.Item className="acct-item acct-danger" onSelect={logout}>
                  <LogOut size={18} aria-hidden /> Выйти
                </Menu.Item>
              </motion.div>
            </Menu.Content>
          </Menu.Portal>
        )}
      </AnimatePresence>
    </Menu.Root>
  );
}
