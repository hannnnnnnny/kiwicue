export type AskFailureStep = "jev" | "deepseek" | "reply" | "quota" | "source" | "stream";

function field(error: unknown, key: string): unknown {
  return error && typeof error === "object" && key in error ? (error as Record<string, unknown>)[key] : undefined;
}

/** Records why an ask step failed. User text never reaches the log, only the error's shape. */
export function logAskFailure(step: AskFailureStep, error: unknown): void {
  const status = field(error, "statusCode") ?? field(error, "status");
  const code = field(error, "code");
  console.error(JSON.stringify({
    event: "ask_failure",
    step,
    status: typeof status === "number" ? status : undefined,
    code: typeof code === "string" ? code.slice(0, 60) : undefined,
    name: error instanceof Error ? error.name : undefined,
  }));
}
