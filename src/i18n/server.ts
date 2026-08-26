import { cookies } from "next/headers";
import { getDictionary, defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./index";
import { makeT } from "./translate";

// Read the active locale from the cookie (server components / actions).
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : defaultLocale;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(getDictionary(locale)) };
}
