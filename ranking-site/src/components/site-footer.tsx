import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-auto border-t border-zinc-200 py-8 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-zinc-500">
        <p>{t("tagline")}</p>
        <div className="flex gap-4">
          <Link href="/methodology" className="hover:text-teal-600">
            {t("methodology")}
          </Link>
          <Link href="/about" className="hover:text-teal-600">
            {t("about")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
