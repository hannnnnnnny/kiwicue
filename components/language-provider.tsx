"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Language = "en" | "zh";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const STORAGE_KEY = "kiwicue-language";
const LANGUAGE_CHANGE_EVENT = "kiwicue-language-change";
const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
});

function setDocumentLanguage(language: Language) {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
}

function subscribeToLanguage(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

function getServerLanguage(): Language {
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getStoredLanguage,
    getServerLanguage,
  );

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem(STORAGE_KEY);
      if (savedLanguage !== null && savedLanguage !== "en" && savedLanguage !== "zh") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Language remains usable in English when browser storage is unavailable.
    }
    setDocumentLanguage(language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      try {
        localStorage.setItem(STORAGE_KEY, nextLanguage);
      } catch {
        // Keep the current language without making the rest of the portal fail.
      }
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
