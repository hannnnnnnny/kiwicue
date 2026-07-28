import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LanguageProvider,
  useLanguage,
} from "../components/language-provider";
import { LanguageToggle } from "../components/language-toggle";

function LanguageProbe() {
  const { language } = useLanguage();
  return <p>{language === "en" ? "English active" : "中文已启用"}</p>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  cleanup();
});

describe("shared language state", () => {
  it("starts in English and switches accessibly to Chinese", () => {
    render(
      <LanguageProvider>
        <LanguageProbe />
        <LanguageToggle />
      </LanguageProvider>,
    );

    expect(screen.getByText("English active")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByText("中文已启用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to English" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(localStorage.getItem("kiwicue-language")).toBe("zh");
  });

  it("restores a valid saved language after mounting", async () => {
    localStorage.setItem("kiwicue-language", "zh");

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    expect(await screen.findByText("中文已启用")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("ignores an unsupported saved language", () => {
    localStorage.setItem("kiwicue-language", "fr");

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    expect(screen.getByText("English active")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
