export const ASSISTANT_IDS = ["iris", "rua", "sunny", "fern", "kai"] as const;
export type AssistantId = (typeof ASSISTANT_IDS)[number];
export const DEFAULT_ASSISTANT: AssistantId = "fern";
export const ASSISTANT_STORAGE_KEY = "kiwicue.assistant";

type Localized = { en: string; zh: string };
export type Assistant = {
  id: AssistantId;
  name: string;
  personality: string;
  role: Localized;
  /** One line added to the reply prompt, so each assistant sounds like itself. */
  style: Localized;
  voice: { pitch: number; rate: number };
  /** Site theme. Every value keeps 4.5:1 against white and against `soft`. */
  colors: { brand: string; hover: string; soft: string };
  model: string;
  poster: string;
};

function assistant(id: AssistantId, rest: Omit<Assistant, "id" | "model" | "poster">): Assistant {
  return { id, ...rest, model: `/assistants/${id}.glb`, poster: `/assistants/${id}.webp` };
}

export const ASSISTANTS: Record<AssistantId, Assistant> = {
  iris: assistant("iris", {
    name: "Iris", personality: "INTJ", role: { en: "Strategist", zh: "策略家" },
    style: { en: "Calm and concise; give the single best reason.", zh: "冷静简洁，只说最关键的理由。" },
    voice: { pitch: 0.9, rate: 0.95 },
    colors: { brand: "#6a4bb0", hover: "#553a93", soft: "#efeafa" },
  }),
  rua: assistant("rua", {
    name: "Rua", personality: "ENTJ", role: { en: "Commander", zh: "指挥官" },
    style: { en: "Decisive and upbeat; lead with the pick.", zh: "果断有活力，开门见山先给推荐。" },
    voice: { pitch: 1, rate: 1.12 },
    colors: { brand: "#b2402c", hover: "#94331f", soft: "#fbe8e3" },
  }),
  sunny: assistant("sunny", {
    name: "Sunny", personality: "ENTP", role: { en: "Inventor", zh: "发明家" },
    style: { en: "Playful and a little witty, still clear.", zh: "俏皮幽默一点，但要说清楚。" },
    voice: { pitch: 1.2, rate: 1.08 },
    colors: { brand: "#83600f", hover: "#6f4f08", soft: "#fbf2d9" },
  }),
  fern: assistant("fern", {
    name: "Fern", personality: "ISFJ", role: { en: "Guardian", zh: "守护者" },
    style: { en: "Warm and reassuring; mention one practical detail.", zh: "温暖贴心，顺带一个实用细节。" },
    voice: { pitch: 1.05, rate: 1 },
    colors: { brand: "#2a7457", hover: "#215e46", soft: "#e3f2eb" },
  }),
  kai: assistant("kai", {
    name: "Kai", personality: "ISTP", role: { en: "Maker", zh: "实干家" },
    style: { en: "Relaxed and plain; straight to the point.", zh: "轻松直白，直奔重点。" },
    voice: { pitch: 0.95, rate: 1.02 },
    colors: { brand: "#2a6aa3", hover: "#215686", soft: "#e4eef8" },
  }),
};

export function parseAssistantId(value: unknown): AssistantId | null {
  return ASSISTANT_IDS.find((id) => id === value) ?? null;
}

/**
 * Runs inline in <head> before first paint so the saved assistant's colours apply without a
 * flash. Only known ids reach the DOM.
 */
export const themeInitScript = `try{var a=localStorage.getItem(${JSON.stringify(ASSISTANT_STORAGE_KEY)});document.documentElement.dataset.assistant=${JSON.stringify(ASSISTANT_IDS)}.indexOf(a)>-1?a:${JSON.stringify(DEFAULT_ASSISTANT)}}catch(e){document.documentElement.dataset.assistant=${JSON.stringify(DEFAULT_ASSISTANT)}}`;
