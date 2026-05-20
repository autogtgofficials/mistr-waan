import type { Metadata } from "next";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mister Waan — Ops",
  description: "Internal supply-side dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ReadOnlyBanner />
        {children}
      </body>
    </html>
  );
}
