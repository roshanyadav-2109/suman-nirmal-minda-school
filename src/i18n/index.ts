import en from "./messages/en";
import hi from "./messages/hi";
import bn from "./messages/bn";

export const locales = ["en", "hi", "bn"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "kv_locale";

export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
};

const dictionaries = { en, hi, bn } as const;

// Deep-widen the English literal types to `string` so translations type-check
// while preserving the exact key structure.
export type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Messages = DeepString<typeof en>;

export function getDictionary(locale: string | undefined): Messages {
  if (locale && locales.includes(locale as Locale)) return dictionaries[locale as Locale];
  return en;
}

export function isLocale(v: string | undefined): v is Locale {
  return !!v && locales.includes(v as Locale);
}

// Intl locale tag for number/date formatting.
export const intlTag: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
};
