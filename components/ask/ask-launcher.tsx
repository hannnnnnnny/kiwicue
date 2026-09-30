"use client";

import { useRef, useState } from "react";
import { useLanguage } from "../language-provider";
import { AskOverlay } from "./ask-overlay";

export function AskLauncher({ enabled }: { enabled: boolean }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!enabled) return null;
  // The button stays mounted while the overlay unmounts, so focus can return synchronously.
  function close() {
    setOpen(false);
    button.current?.focus();
  }
  return (
    <>
      <button ref={button} type="button" className="ask-launcher" aria-label={language === "zh" ? "问问 KiwiCue" : "Ask KiwiCue"}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" fill="currentColor" /></svg>
      </button>
      {open ? <AskOverlay onClose={close} /> : null}
    </>
  );
}
