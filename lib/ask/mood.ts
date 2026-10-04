export const ASK_MOODS = ["happy", "excited", "curious", "sorry", "surprised", "calm"] as const;
export type AskMood = (typeof ASK_MOODS)[number];

const OPEN = "[[";
const CLOSE = "]]";
// Longest tag worth waiting for: "[[surprised]]" plus a little slack.
const MAX_TAG = 16;

function isMood(word: string): word is AskMood {
  return (ASK_MOODS as readonly string[]).includes(word);
}

/**
 * Takes the assistant's `[[mood]]` tags out of a streamed reply. A tag can arrive split across
 * deltas, so text that might start one is held back until it is complete or clearly isn't a tag.
 */
export function moodFilter(onText: (delta: string) => void, onMood: (mood: AskMood) => void) {
  let pending = "";
  let trimNext = false;

  function push(delta: string) {
    let rest = pending + delta;
    pending = "";
    let out = "";
    for (;;) {
      if (trimNext && rest) { rest = rest.trimStart(); trimNext = rest.length === 0; }
      const open = rest.indexOf(OPEN);
      if (open === -1) {
        const keep = rest.endsWith("[") ? 1 : 0;
        out += rest.slice(0, rest.length - keep);
        pending = rest.slice(rest.length - keep);
        break;
      }
      out += rest.slice(0, open);
      rest = rest.slice(open);
      const close = rest.indexOf(CLOSE);
      if (close === -1) {
        if (rest.length <= MAX_TAG) { pending = rest; break; }
        out += OPEN;
        rest = rest.slice(OPEN.length);
        continue;
      }
      const word = rest.slice(OPEN.length, close);
      if (isMood(word)) { onMood(word); trimNext = true; } else out += rest.slice(0, close + CLOSE.length);
      rest = rest.slice(close + CLOSE.length);
    }
    if (out) onText(out);
  }

  return {
    push,
    flush() { if (pending) onText(pending); pending = ""; },
  };
}
