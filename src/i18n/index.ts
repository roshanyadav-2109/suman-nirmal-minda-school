import en from "./messages/en";
import hi from "./messages/hi";
import bn from "./messages/bn";
import gu from "./messages/gu";
import pa from "./messages/pa";

export const locales = ["en", "hi", "bn", "gu", "pa"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "kv_locale";

export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
};

const dictionaries: Record<Locale, PartialMessages> = { en, hi, bn, gu, pa };

// Deep-widen the English literal types to `string` so translations type-check
// while preserving the exact key structure.
export type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Messages = DeepString<typeof en>;

// A translation may lag English. Rather than force a translator to ship a
// placeholder for every new key — or worse, invent one — a dictionary may omit
// keys, and makeT falls back to English for anything missing.
export type PartialMessages = { [K in keyof Messages]?: Messages[K] extends string ? string : Partial<Messages[K]> };

export function getDictionary(locale: string | undefined): PartialMessages {
  if (locale && locales.includes(locale as Locale)) return dictionaries[locale as Locale];
  return en;
}

export const englishMessages: Messages = en;

export function isLocale(v: string | undefined): v is Locale {
  return !!v && locales.includes(v as Locale);
}

// Intl locale tag for number/date formatting.
export const intlTag: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
};
