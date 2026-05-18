"use client";

import { useTranslations } from "next-intl";
import { Menu, X, LogIn } from "lucide-react";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import Logo from "@/components/brand/Logo";
import LocaleSwitcher from "./LocaleSwitcher";
import UserMenu from "./UserMenu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/kesintiler", key: "outages" },
  { href: "/novbeler", key: "queues" },
  { href: "/tehlukesizlik", key: "safety" },
  { href: "/haqqinda", key: "about" },
] as const;

export default function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/75">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center" aria-label="NarPulse">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 h-9 inline-flex items-center rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "text-[var(--text)]"
                      : "text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  {t(item.key)}
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-[1px] h-0.5 rounded-full bg-[var(--accent)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <UserMenu />
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menyu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-[var(--border)] bg-[var(--surface)]">
          <ul className="px-3 py-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-lg text-sm font-medium",
                    pathname === item.href
                      ? "text-[var(--text)] bg-[var(--surface-2)]"
                      : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/giris"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[var(--text)] bg-[var(--accent)]/15"
              >
                <LogIn className="h-3.5 w-3.5" /> {t("login")}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
