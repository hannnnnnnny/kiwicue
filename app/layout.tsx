import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AskLauncher } from "../components/ask/ask-launcher";
import { BookmarkProvider } from "../components/bookmark-provider";
import { AuthProvider } from "../components/auth-provider";
import { LanguageProvider } from "../components/language-provider";
import { DiscoveryMotion } from "../components/discovery-motion";
import { isAskConfigured } from "../lib/ask/config";
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
          <AuthProvider><BookmarkProvider>{children}</BookmarkProvider></AuthProvider>
          <DiscoveryMotion />
          <AskLauncher enabled={isAskConfigured()} />
        </LanguageProvider>
      </body>
    </html>
  );
}
