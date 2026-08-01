"use client";

import Link from "next/link";
import { LanguageToggle } from "./language-toggle";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    skip: "Skip to event results",
    skipDetail: "Skip to event details",
    homeLabel: "KiwiCue Auckland events home",
    descriptor: "Auckland event finder",
  },
  zh: {
    skip: "跳到活动结果",
    skipDetail: "跳到活动详情",
    homeLabel: "KiwiCue 奥克兰活动首页",
    descriptor: "奥克兰活动检索",
  },
} as const;

export function PortalHeader({ skipTarget = "event-results" }: {
  skipTarget?: "event-results" | "event-detail";
} = {}) {
  const { language } = useLanguage();
  const content = copy[language];

  return (
    <>
      <a className="skip-link" href={`#${skipTarget}`}>
        {skipTarget === "event-detail" ? content.skipDetail : content.skip}
      </a>
      <header className="portal-header">
        <Link className="portal-brand" href="/events" aria-label={content.homeLabel}>
          <span className="portal-brand-mark" aria-hidden="true">K</span>
          <span className="portal-brand-copy">
            <strong>KiwiCue</strong>
            <small>{content.descriptor}</small>
          </span>
        </Link>
        <LanguageToggle />
      </header>
    </>
  );
}
