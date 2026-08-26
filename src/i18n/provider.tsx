"use client";
import { createContext, useContext, useMemo } from "react";
import { getDictionary, type Locale } from "./index";
import { makeT, type TFunction } from "./translate";

type Ctx = { locale: Locale; t: TFunction };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: makeT(getDictionary(locale)) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
