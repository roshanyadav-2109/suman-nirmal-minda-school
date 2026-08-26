"use client";
import { useTransition } from "react";
import { LanguageIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { locales, localeNames } from "@/i18n/index";
import { useI18n } from "@/i18n/provider";
import { setLocale } from "@/lib/actions";

export function LocaleSwitcher() {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-1.5 rounded-sm border border-hair bg-surface px-2 py-1 text-[13px] text-ink-700">
      <LanguageIcon size={16} className="text-muted" />
      <select
        aria-label="Language"
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className="cursor-pointer bg-transparent pr-1 font-medium focus:outline-none"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
