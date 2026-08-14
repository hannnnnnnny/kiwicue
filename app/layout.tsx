import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiwiCue — Auckland events, sorted",
  description:
    "Find Auckland concerts, theatre, markets, festivals and community events before they pass you by.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LanguageProvider>
          <BookmarkProvider>{children}</BookmarkProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
