import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import AccountMenu from "./AccountMenu";
import NavLinks, { type NavItem } from "./NavLinks";

export default function TopNav({ user }: { user: SessionUser }) {
  const items: NavItem[] = [
    { label: "Обзор", href: "/" },
    { label: "Реестр", href: "/registry" },
    { label: "Помощник", href: "/helper" },
    ...(user.role !== "viewer"
      ? [
          { label: "Акты ТМЦ", href: "/acts" },
          { label: "Картриджи", href: "/cartridges" },
          { label: "Журнал", href: "/audit" },
        ]
      : []),
    ...(user.role === "admin" ? [{ label: "Пользователи", href: "/users" }] : []),
  ];
  return (
    <header className="topnav">
      <div className="in">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>Pingfield</span>
        </Link>
        <NavLinks items={items} />
        <div className="who">
          <AccountMenu name={user.fullName || user.username} username={user.username} role={user.role} />
        </div>
      </div>
    </header>
  );
}
