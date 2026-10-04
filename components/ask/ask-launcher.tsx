"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useLanguage } from "../language-provider";
import { useAssistant } from "../use-assistant";
import { AssistantOrb } from "./assistant-orb";
import { AskOverlay } from "./ask-overlay";

export function AskLauncher({ enabled }: { enabled: boolean }) {
  const { language } = useLanguage();
  const { assistant } = useAssistant();
  const pathname = usePathname();
  // The launcher lives in the root layout, so it survives navigation. Remembering the page it
  // was opened on closes the overlay as soon as a result or "Sign in" link moves elsewhere.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  if (!enabled) return null;
  const open = openOn !== null && openOn === pathname;
  // The button stays mounted while the overlay unmounts, so focus can return synchronously.
  function close() {
    setOpenOn(null);
    button.current?.focus();
  }
  return (
    <>
      <button ref={button} type="button" className="ask-launcher" aria-label={language === "zh" ? "问问 KiwiCue" : "Ask KiwiCue"}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpenOn(pathname)}>
        <AssistantOrb assistant={assistant} state="idle" size="small" />
      </button>
      <div hidden={!open}><AskOverlay onClose={close} active={open} /></div>
    </>
  );
}
