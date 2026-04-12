"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/issuer", label: "Issuer" },
  { href: "/join", label: "Join" },
  { href: "/admit", label: "Admit" },
  { href: "/wallet", label: "Wallet" },
  { href: "/compare", label: "Compare" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`nav-link${active ? " nav-link--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
