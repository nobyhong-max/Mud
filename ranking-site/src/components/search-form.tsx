"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

export function SearchForm({
  defaultBoard = "buzz",
}: {
  defaultBoard?: string;
}) {
  const t = useTranslations("home");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (pathname.startsWith("/rankings")) {
      const sp = new URLSearchParams(searchParams.toString());
      if (trimmed) sp.set("q", trimmed);
      else sp.delete("q");
      router.replace(
        sp.toString() ? `${pathname}?${sp}` : pathname,
      );
    } else {
      const sp = new URLSearchParams();
      if (trimmed) sp.set("q", trimmed);
      const qs = sp.toString();
      router.push(
        `/rankings/${defaultBoard}${qs ? `?${qs}` : ""}`,
      );
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <Button type="submit">{t("searchButton")}</Button>
    </form>
  );
}
