import { askStreamEventSchema, type AskStreamEvent } from "./schema";

const encoder = new TextEncoder();
const MAX_LINE_LENGTH = 16_384;

export function encodeEvent(event: AskStreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

function parseLine(line: string): AskStreamEvent | null {
  if (!line.trim() || line.length > MAX_LINE_LENGTH) return null;
  try {
    const parsed = askStreamEventSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null; // A broken line is skipped; the rest of the stream is still useful.
    throw error;
  }
}

/** Reads an NDJSON body into validated events, ignoring anything that does not match the schema. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AskStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const event = parseLine(line);
      if (event) yield event;
    }
  }
  const last = parseLine(buffer);
  if (last) yield last;
}
