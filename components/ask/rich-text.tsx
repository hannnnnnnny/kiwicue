import { Fragment, type ReactNode } from "react";

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };
const BULLET = /^\s*[-•*]\s+/u;
const NUMBERED = /^\s*\d+[.)]\s+/u;

function blocks(text: string): Block[] {
  const result: Block[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    const last = result.at(-1);
    if (!trimmed) { result.push({ kind: "p", lines: [] }); continue; }
    const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : "p";
    const content = trimmed.replace(BULLET, "").replace(NUMBERED, "");
    if (kind === "p") {
      if (last?.kind === "p") last.lines.push(content); else result.push({ kind: "p", lines: [content] });
    } else if (last?.kind === kind) last.items.push(content);
    else result.push({ kind, items: [content] });
  }
  return result.filter((block) => block.kind !== "p" || block.lines.length > 0);
}

/** Only complete **pairs** become bold, so half-streamed text shows as typed. Everything else is plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/u).map((part, index) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
}

/** The assistant's reply: paragraphs, lists and bold only, built as React elements (never HTML). */
export function RichText({ text }: { text: string }) {
  return (
    <div className="ask-rich">
      {blocks(text).map((block, index) => {
        if (block.kind === "p") return <p key={index}>{block.lines.map((line, at) => <Fragment key={at}>{at > 0 ? <br /> : null}{inline(line)}</Fragment>)}</p>;
        const List = block.kind;
        return <List key={index}>{block.items.map((item, at) => <li key={at}>{inline(item)}</li>)}</List>;
      })}
    </div>
  );
}

/** The same reply as speech: formatting removed, list items read as sentences. */
export function plainText(text: string): string {
  return text.split(/\r?\n/u)
    .map((line) => line.replace(BULLET, "").replace(NUMBERED, "").replace(/\*\*/gu, "").trim())
    .filter(Boolean)
    .map((line, index, lines) => index < lines.length - 1 && !/[.!?。！？:：]$/u.test(line) ? `${line}.` : line)
    .join(" ")
    .replace(/([^.!?。！？])$/u, "$1.");
}
