import type { AskChatTurn, AskFilters, AskShown } from "../../lib/ask/schema";
import { EMPTY_FILTERS } from "../../lib/ask/schema";
import type { AssistantId } from "../../lib/assistants";

/** What the search tool hands the model, in the same shape the live pipeline returns. */
export type SearchResult = {
  found: number;
  loosened: string[];
  options: Array<{
    n: number; kind: "event" | "movie" | "market"; title: string; when: string; venue: string | null; price: string | null;
    sessions: number; bookingUrl: string | null; href: string; budgetStatus: "unknown" | "within" | "over" | "free";
    minPartyCost: number | null; durationMinutes: number | null; indoor: boolean;
  }>;
};

export type Scenario = {
  id: string;
  language: "en" | "zh";
  assistant: AssistantId;
  history: AskChatTurn[];
  message: string;
  filters: AskFilters | null;
  shown: AskShown[];
  /** Returned for every search the model makes in this scenario; null means the model shouldn't need to search. */
  search: SearchResult | null;
};

type Option = SearchResult["options"][number];
const option = (n: number, title: string, when: string, venue: string, extra: Partial<Option> = {}): Option => ({
  n, kind: "event", title, when, venue, price: null, sessions: 1, bookingUrl: null, href: `/events/e${n}`,
  budgetStatus: "unknown", minPartyCost: null, durationMinutes: null, indoor: true, ...extra,
});
const results = (options: Option[], loosened: string[] = []): SearchResult => ({ found: options.length, loosened, options });
const shownOf = (search: SearchResult): AskShown[] => search.options.map(({ kind, title, when, venue, price, href }) => ({ kind, title, when, venue, price, href }));

const saturday = results([
  option(1, "Noah Kahan - The Great Divide Tour", "Sat 10 Oct, 6:30 pm", "Spark Arena"),
  option(2, "Cabaret - NZSL-Interpreted", "Sat 10 Oct, 2:00 pm", "ASB Waterfront Theatre", { sessions: 2 }),
  option(3, "Aaron Chen - Technology", "Sat 10 Oct, 8:00 pm", "Kiri Te Kanawa Theatre"),
  option(4, "Eatropolis", "Sat 10 Oct, 12:00 pm", "Shed 10, Queens Wharf", { indoor: false }),
  option(5, "Auckland Night Market — Albany", "Sat 10 Oct, 5:00 pm", "Albany Mega Centre", { kind: "market", price: "Free entry", budgetStatus: "free", indoor: false }),
]);
const kids = results([
  option(1, "Wonderverse", "Sun 11 Oct, 1:20 pm", "Aotea Centre", { price: "From $25", sessions: 3, minPartyCost: 75, budgetStatus: "within" }),
  option(2, "Motuhake", "Sun 11 Oct, 2:00 pm", "Q Theatre", { price: "From $18", minPartyCost: 54, budgetStatus: "within" }),
  option(3, "The Imaginarium", "Sun 11 Oct, 11:30 am", "Auckland Museum", { sessions: 6 }),
]);
const comedyLoosened = results([
  option(1, "Aaron Chen - Technology", "Fri 9 Oct, 8:00 pm", "Kiri Te Kanawa Theatre"),
  option(2, "The Classic Comedy Club Late Show", "Fri 9 Oct, 9:30 pm", "Classic Comedy Club", { price: "From $20" }),
], ["area"]);
const zhKids = results([
  option(1, "Wonderverse", "10月10日 周六 上午10:40", "Aotea Centre", { price: "From $25", sessions: 4 }),
  option(2, "The Imaginarium", "10月10日 周六 上午10:00", "Auckland Museum", { sessions: 6 }),
  option(3, "Motuhake", "10月10日 周六 上午11:00", "Q Theatre", { price: "From $18" }),
  option(4, "Auckland Night Market — Botany", "10月11日 周日 下午5:00", "Botany Town Centre", { kind: "market", price: "Free entry", budgetStatus: "free", indoor: false }),
]);
const movies = results([
  option(1, "Zootopia 2", "今天 晚上6:15", "Hoyts Sylvia Park", { kind: "movie", sessions: 3 }),
  option(2, "Zootopia 2", "今天 晚上7:00", "Event Cinemas Queen Street", { kind: "movie", sessions: 2 }),
  option(3, "The Running Man", "今天 晚上8:40", "Event Cinemas Queen Street", { kind: "movie" }),
]);
const budget = results([
  option(1, "Aaron Chen - Technology", "10月10日 周六 晚上8:00", "Kiri Te Kanawa Theatre", { price: "From $59", minPartyCost: 118, budgetStatus: "over" }),
  option(2, "The Classic Comedy Club Late Show", "10月10日 周六 晚上9:30", "Classic Comedy Club", { price: "From $20", minPartyCost: 40, budgetStatus: "within" }),
  option(3, "Auckland Night Market — Henderson", "10月10日 周六 下午5:00", "Henderson", { kind: "market", price: "Free entry", budgetStatus: "free", indoor: false }),
]);
const different = results([
  option(1, "Auckland Zoo Night Safari", "10月10日 周六 晚上6:00", "Auckland Zoo", { indoor: false, price: "From $35" }),
  option(2, "Silo Park Outdoor Cinema", "10月10日 周六 晚上8:00", "Silo Park", { indoor: false, price: "Free entry", budgetStatus: "free" }),
]);
const date = results([
  option(1, "Cabaret", "Sat 10 Oct, 8:00 pm", "ASB Waterfront Theatre", { price: "From $65", sessions: 7, durationMinutes: 150 }),
  option(2, "Jazz at the Wynyard", "Sat 10 Oct, 7:00 pm", "Wynyard Pavilion", { price: "From $30" }),
  option(3, "Silo Park Outdoor Cinema", "Sat 10 Oct, 8:00 pm", "Silo Park", { price: "Free entry", budgetStatus: "free", indoor: false }),
]);

const hi = (text: string): AskChatTurn => ({ role: "assistant", text });

export const SCENARIOS: Scenario[] = [
  { id: "en-saturday", language: "en", assistant: "fern", history: [hi("Hi, I'm Fern! What are you in the mood for in Auckland?")], message: "what's on this saturday?", filters: null, shown: [], search: saturday },
  { id: "en-kids-cheap", language: "en", assistant: "fern", history: [], message: "something not too pricey for me and two kids on Sunday afternoon", filters: null, shown: [], search: kids },
  { id: "en-nothing", language: "en", assistant: "kai", history: [], message: "any live jazz tonight in Devonport?", filters: null, shown: [], search: results([]) },
  { id: "en-followup", language: "en", assistant: "iris", history: [{ role: "user", text: "what's on this saturday?" }, hi("Noah Kahan at Spark Arena is the big one.")], message: "is the market free?", filters: { ...EMPTY_FILTERS, dates: ["2026-10-10"] }, shown: shownOf(saturday), search: null },
  { id: "en-thanks", language: "en", assistant: "sunny", history: [{ role: "user", text: "comedy friday?" }, hi("Aaron Chen at the Kiri Te Kanawa is your best bet.")], message: "perfect thanks!", filters: { ...EMPTY_FILTERS, category: "theatre" }, shown: shownOf(comedyLoosened), search: null },
  { id: "en-loosened", language: "en", assistant: "rua", history: [], message: "comedy on friday night in Ponsonby", filters: null, shown: [], search: comedyLoosened },
  { id: "en-date", language: "en", assistant: "iris", history: [], message: "planning a date night saturday, ideas?", filters: null, shown: [], search: date },
  { id: "zh-kids", language: "zh", assistant: "fern", history: [hi("嗨，我是 Fern！想在奥克兰找点什么好玩的？")], message: "这个周末有什么适合带小孩的？", filters: null, shown: [], search: zhKids },
  { id: "zh-movies", language: "zh", assistant: "kai", history: [], message: "今晚市中心有什么电影", filters: null, shown: [], search: movies },
  { id: "zh-followup", language: "zh", assistant: "iris", history: [{ role: "user", text: "这个周末有什么适合带小孩的？" }, hi("Wonderverse 很适合小朋友。")], message: "博物馆那个几点开始？", filters: { ...EMPTY_FILTERS, kids: true }, shown: shownOf(zhKids), search: null },
  { id: "zh-budget", language: "zh", assistant: "rua", history: [], message: "周六晚上两个人，预算一百块左右", filters: null, shown: [], search: budget },
  { id: "zh-different", language: "zh", assistant: "sunny", history: [{ role: "user", text: "周六晚上两个人，预算一百块左右" }, hi("Classic Comedy Club 的深夜场两个人大概 40 块。")], message: "喜剧没意思，有没有别的", filters: { ...EMPTY_FILTERS, dates: ["2026-10-10"], timeOfDay: "evening" }, shown: shownOf(budget), search: different },
];
