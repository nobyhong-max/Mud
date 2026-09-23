"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const LOCALE_KEY = "duzao-locale";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("lang");

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* ignore */
    }
    router.replace(pathname, { locale: next });
  };

  return (
    <div
      className="flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700"
      role="group"
      aria-label={t("switch")}
    >
      {routing.locales.map((loc) => (
        <Button
          key={loc}
          type="button"
          variant={loc === locale ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2.5"
          onClick={() => switchTo(loc)}
        >
          {t(loc)}
        </Button>
      ))}
    </div>
  );
}
