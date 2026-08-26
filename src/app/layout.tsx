import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import { SCHOOL } from "@/lib/school";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Distinctive display serif — used for the sign-in hero and headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${SCHOOL.shortName} — Student Progress & School Portal`,
  description: `Continuous student progress and analytics for ${SCHOOL.fullName}.`,
};

// Colocate server rendering with the Supabase project (ap-southeast-1 / Singapore)
// so DB queries don't cross regions.
export const preferredRegion = "sin1";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
