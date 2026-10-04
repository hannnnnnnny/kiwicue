import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AskLauncher } from "../components/ask/ask-launcher";
import { NavigationTracker } from "../components/back-link";
import { BookmarkProvider } from "../components/bookmark-provider";
import { AuthProvider } from "../components/auth-provider";
import { LanguageProvider } from "../components/language-provider";
import { DiscoveryMotion } from "../components/discovery-motion";
import { isAskConfigured } from "../lib/ask/config";
import { DEFAULT_ASSISTANT, themeInitScript } from "../lib/assistants";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiwiCue — Auckland events, sorted",
  description:
    "Find Auckland concerts, theatre, markets, festivals and community events before they pass you by.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The inline script swaps data-assistant for the saved choice before paint, so React must
    // not treat that attribute as a hydration mismatch.
    <html lang="en" data-scroll-behavior="smooth" data-assistant={DEFAULT_ASSISTANT} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider><BookmarkProvider>{children}</BookmarkProvider></AuthProvider>
          <DiscoveryMotion />
          <NavigationTracker />
          <AskLauncher enabled={isAskConfigured()} />
        </LanguageProvider>
      </body>
    </html>
  );
}
