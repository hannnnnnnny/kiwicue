"use client";

import Link from "next/link";
import { useLanguage } from "./language-provider";

export type MineTab = "saved" | "plans" | "collections";

const TABS: { id: MineTab; href: string; en: string; zh: string }[] = [
  { id: "saved", href: "/saved", en: "Saved", zh: "收藏" },
  { id: "plans", href: "/plans", en: "Plans", zh: "行程" },
  { id: "collections", href: "/collections", en: "Collections", zh: "清单" },
];

/** Everything the visitor keeps, side by side, so moving between them is one tap and Back still leaves "Mine". */
export function MineTabs({ current }: { current: MineTab }) {
  const { language } = useLanguage();
  return (
    <nav className="mine-tabs" aria-label={language === "zh" ? "我的" : "Mine"}>
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} replace aria-current={tab.id === current ? "page" : undefined}>{tab[language]}</Link>
      ))}
    </nav>
  );
}
