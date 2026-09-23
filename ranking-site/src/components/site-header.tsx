"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { MAIN_BOARD_IDS, SEGMENT_BOARD_IDS } from "@/lib/boards";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="group flex flex-col">
            <span className="text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-teal-600 dark:text-zinc-50 dark:group-hover:text-teal-400">
              {t("meta.siteName")}
            </span>
            <span className="text-xs text-zinc-500">{t("meta.siteSubtitle")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
          <NavLink href="/" active={pathname === "/"}>
            {t("nav.home")}
          </NavLink>
          {MAIN_BOARD_IDS.map((id) => (
            <NavLink
              key={id}
              href={`/rankings/${id}`}
              active={pathname === `/rankings/${id}`}
            >
              {t(`boards.${id}`)}
            </NavLink>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-zinc-300 sm:inline dark:bg-zinc-700" />
          {SEGMENT_BOARD_IDS.slice(0, 3).map((id) => (
            <NavLink
              key={id}
              href={`/rankings/${id}`}
              active={pathname === `/rankings/${id}`}
              className="text-zinc-500"
            >
              {t(`boards.${id}`)}
            </NavLink>
          ))}
          <NavLink href="/about" active={pathname === "/about"}>
            {t("nav.about")}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  active,
  className,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900",
        active && "bg-teal-600/10 font-medium text-teal-700 dark:text-teal-300",
        className,
      )}
    >
      {children}
    </Link>
  );
}
