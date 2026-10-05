import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "../components/language-provider";
import { SiteFooter } from "../components/site-footer";

describe("SiteFooter", () => {
  afterEach(cleanup);

  it("credits the creator under the page tagline", () => {
    render(<LanguageProvider><SiteFooter tagline="Auckland events, easier to find." /></LanguageProvider>);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Auckland events, easier to find.");
    expect(footer).toHaveTextContent(/Created by Yi Han/u);
  });
});
