import type { Metadata } from "next";
import {cookies} from "next/headers";
import {resolveLocale} from "@/lib/i18n/locale";
import {LanguageProvider} from "@/components/i18n/language-provider";
import "./globals.css";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./public.css";
import "./workspace.css";
import "@fontsource/noto-sans-myanmar/400.css";
import "@fontsource/noto-sans-myanmar/500.css";
import "@fontsource/noto-sans-myanmar/600.css";
import "./language.css";

export const metadata: Metadata = {
  title: { default: "Myanmar Trading | Every shipment. A clearer journey.", template: "%s | Myanmar Trading" },
  description: "Keep shipments, driver updates, border gate alerts and delivery documents together. A shared logistics workspace for Myanmar traders and their teams.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale=resolveLocale((await cookies()).get("logistics-language")?.value);
  return <html lang={locale}><body><LanguageProvider locale={locale}>{children}</LanguageProvider></body></html>;
}
