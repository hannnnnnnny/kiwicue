import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "../components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiwiCue — Auckland events, sorted",
  description:
    "Find Auckland concerts, theatre, markets, festivals and community events before they pass you by.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
