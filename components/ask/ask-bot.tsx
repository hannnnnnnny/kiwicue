export type BotState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Kiwi: a round face whose eyes, mouth and rings show what it is doing. Purely decorative —
 * the overlay announces the same state in text for screen readers.
 */
export function AskBot({ state, size = "large" }: { state: BotState; size?: "large" | "small" }) {
  return (
    <span className="ask-bot" data-state={state} data-size={size} aria-hidden="true">
      <span className="ask-bot-face">
        <span className="ask-bot-eyes"><span className="ask-bot-eye" /><span className="ask-bot-eye" /></span>
        <span className="ask-bot-mouth" />
      </span>
      <span className="ask-bot-dots"><i /><i /><i /></span>
    </span>
  );
}
