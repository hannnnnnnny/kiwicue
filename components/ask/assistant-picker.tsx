"use client";

import { ASSISTANT_IDS, ASSISTANTS, type Assistant, type AssistantId } from "../../lib/assistants";
import { AssistantOrb } from "./assistant-orb";

type Language = "en" | "zh";
const LABEL = { en: "Choose your assistant", zh: "选择你的助手" } as const;

/** Five assistants to choose from; the choice re-themes the whole site. Native radios give arrow keys for free. */
export function AssistantPicker({ current, language, onPick }: { current: Assistant; language: Language; onPick(id: AssistantId): void }) {
  return (
    <fieldset className="ask-picker" role="radiogroup" aria-label={LABEL[language]}>
      {ASSISTANT_IDS.map((id) => {
        const assistant = ASSISTANTS[id];
        return (
          <label key={id} data-assistant-option={id}>
            <input type="radio" name="kiwicue-assistant" value={id} checked={id === current.id} onChange={() => onPick(id)} />
            <AssistantOrb assistant={assistant} state="idle" size="small" />
            <strong>{assistant.name}</strong>
            <span>{assistant.role[language]}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
