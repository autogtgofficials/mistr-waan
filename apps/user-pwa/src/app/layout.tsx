import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Mono, Noto_Naskh_Arabic } from "next/font/google";
import { getLocale } from "@/lib/i18n/server";
import { FloatingCallButton } from "@/components/layout/FloatingCallButton";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const notoNaskh = Noto_Naskh_Arabic({
  variable: "--font-noto-naskh",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AutoGTG",
    template: "%s · AutoGTG",
  },
  description:
    "Book vetted garages in Srinagar for repairs, detailing, and denting & painting. Pay safely, talk privately.",
  applicationName: "AutoGTG",
  appleWebApp: {
    title: "AutoGTG",
    capable: true,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#5C33FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = locale === "ur" ? "rtl" : "ltr";
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${roboto.variable} ${robotoMono.variable} ${notoNaskh.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-page text-foreground">
        {children}
        <FloatingCallButton />
      </body>
    </html>
  );
}
