"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { label: string; href: string };

// "/" is active only on the registry itself; other sections also on their subpages.
const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export default function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Разделы">
      {items.map((it) => {
        const active = isActive(path, it.href);
        return (
          <Link key={it.href} href={it.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
