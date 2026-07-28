"use client";

import { useLanguage } from "./language-provider";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === "en" ? "zh" : "en";

  return (
    <button
      className="language-toggle"
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={language === "en" ? "切换到中文" : "Switch to English"}
    >
      {language === "en" ? "中文" : "English"}
      <span aria-hidden="true">↗</span>
    </button>
  );
}
