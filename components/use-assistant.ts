"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ASSISTANT_STORAGE_KEY, ASSISTANTS, DEFAULT_ASSISTANT, parseAssistantId, type Assistant, type AssistantId } from "../lib/assistants";

const CHANGE_EVENT = "kiwicue-assistant-change";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === ASSISTANT_STORAGE_KEY || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function stored(): AssistantId {
  try {
    return parseAssistantId(localStorage.getItem(ASSISTANT_STORAGE_KEY)) ?? DEFAULT_ASSISTANT;
  } catch {
    return DEFAULT_ASSISTANT; // Blocked storage just means the default assistant.
  }
}

/** The visitor's chosen assistant, shared by every component and kept in sync across tabs. */
export function useAssistant(): { assistant: Assistant; setAssistant(id: AssistantId): void } {
  const id = useSyncExternalStore(subscribe, stored, () => DEFAULT_ASSISTANT);
  const setAssistant = useCallback((next: AssistantId) => {
    document.documentElement.dataset.assistant = next;
    try {
      localStorage.setItem(ASSISTANT_STORAGE_KEY, next);
    } catch (error) {
      if (!(error instanceof DOMException)) throw error; // Blocked storage only loses the remembered choice.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return { assistant: ASSISTANTS[id], setAssistant };
}
