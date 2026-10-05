"use client";

import { useLanguage } from "./language-provider";

const CREATOR = "Yi Han";
const YEAR = new Date().getFullYear();

const credit = {
  en: `Created by ${CREATOR}`,
  zh: `由 ${CREATOR} 创建`,
};

/** The footer every page ends with: the site name, the page's tagline and who made KiwiCue. */
export function SiteFooter({ tagline }: { tagline: string }) {
  const { language } = useLanguage();
  return (
    <footer className="portal-footer">
      <span>KiwiCue / 纽村小报</span>
      <span>{tagline}</span>
      <span className="portal-footer-credit">© {YEAR} · {credit[language]}</span>
    </footer>
  );
}
