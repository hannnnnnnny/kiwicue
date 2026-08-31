import type {
  EventExperienceGuide,
  EventExperienceLink,
  EventExperienceSection,
  EventExperienceSource,
  KiwiCueEvent,
} from "./events";
import { isCuratedMarketEventId } from "./events";

const GUIDE_CHECKED_AT = "2026-08-31";

function source(name: string, url: string, scope: string): EventExperienceSource {
  return { name, url, checkedAt: GUIDE_CHECKED_AT, scope };
}

function link(label: string, labelZh: string, url: string): EventExperienceLink {
  return { label, labelZh, url };
}

const hiatusOfficial = source(
  "Auckland Live",
  "https://www.aucklandlive.co.nz/show/hiatus-kaiyote",
  "Official Auckland listing checked 31 Aug 2026",
);
const hiatusReport = source(
  "Scenestr",
  "https://scenestr.com.au/music/review-hiatus-kaiyote-the-tivoli-brisbane-20260713",
  "Brisbane review of the 10 Jul 2026 performance",
);
const hiatusGallery = source(
  "Backseat Mafia",
  "https://www.backseatmafia.com/live-gallery-hiatus-kaiyote-bring-the-sydney-opera-house-to-its-feet-12-07-2026/",
  "Sydney Opera House photo report dated 12 Jul 2026",
);
const suzanneOfficial = source(
  "Auckland Live",
  "https://www.aucklandlive.co.nz/show/suzanne-vega",
  "Official Auckland listing and tour information checked 31 Aug 2026",
);

const hiatusGuide: EventExperienceGuide = {
  sections: [
    {
      kind: "official",
      heading: "About this show",
      headingZh: "本场简介",
      summary: "The Melbourne quartet's 15th-anniversary show brings jazz, funk, hip-hop and progressive R&B together.",
      summaryZh: "这支墨尔本四人乐队的十五周年演出融合爵士、放克、嘻哈与前卫 R&B。",
      source: hiatusOfficial,
    },
    {
      kind: "historical-report",
      heading: "A reported Brisbane reference",
      headingZh: "布里斯班现场参考",
      summary: "A Brisbane review describes a groove-led performance with three backing singers and changing stage visuals.",
      summaryZh: "布里斯班的现场报道记录了以律动为主的演出、三位伴唱与变化的舞台影像。",
      disclosure: "Show the reported three-song opening excerpt",
      disclosureZh: "展开报道中的三首开场节选",
      songs: ["Rose Water", "Rainbow Rhodes", "Dilla (Nag Champa)"],
      caveat: "Historical reference, not the Auckland running order. Songs, guests and staging can change.",
      caveatZh: "仅作往期参考，不是奥克兰本场流程；歌曲、嘉宾和舞台可能调整。",
      links: [link("Read the full live report", "阅读完整现场报道", hiatusReport.url)],
      source: hiatusReport,
    },
    {
      kind: "historical-report",
      heading: "A dated Sydney photo report",
      headingZh: "悉尼往期现场图文",
      summary: "A Sydney Opera House gallery records another 15th-anniversary tour stop on 12 Jul 2026.",
      summaryZh: "悉尼歌剧院图文记录了这轮十五周年巡演在 2026 年 7 月 12 日的一站。",
      links: [link("Sydney photo report · 12 Jul 2026", "悉尼现场图文 · 2026年7月12日", hiatusGallery.url)],
      source: hiatusGallery,
    },
    {
      kind: "official",
      heading: "Entry note from the venue",
      headingZh: "场馆入场提示",
      summary: "Auckland Live lists this show as all ages; children aged 14 and under need an accompanying caregiver.",
      summaryZh: "场馆将本场列为全年龄活动；14 岁及以下儿童需由照护人陪同。",
      caveat: "Check the event page for current entry conditions.",
      caveatZh: "最新入场要求请查看本场官网。",
      source: hiatusOfficial,
    },
  ],
};

const suzanneGuide: EventExperienceGuide = {
  sections: [
    {
      kind: "official",
      heading: "About this show",
      headingZh: "本场简介",
      summary: "A songwriter-led show mixing earlier work with Flying with Angels material, accompanied by guitar and cello.",
      summaryZh: "以创作歌曲为主的演出，结合早期作品与《Flying with Angels》新专辑曲目，并有吉他和大提琴伴奏。",
      points: ["Guitar: Gerry Leonard", "Cello: Stephanie Winters"],
      pointsZh: ["吉他：Gerry Leonard", "大提琴：Stephanie Winters"],
      caveat: "The venue lists the musicians; this does not promise an exact song order.",
      caveatZh: "这是场馆列出的演出阵容，并不代表确定的歌曲顺序。",
      source: suzanneOfficial,
    },
  ],
};

function safeHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" && parsed.port === "";
  } catch {
    return false;
  }
}

function safeSection(section: EventExperienceSection): EventExperienceSection | null {
  if (!safeHttpsUrl(section.source.url)) return null;
  const links = (section.links ?? []).filter((item) => safeHttpsUrl(item.url));
  return { ...section, ...(links.length > 0 ? { links } : {}) };
}

function genericMarketGuide(event: KiwiCueEvent): EventExperienceGuide | null {
  if (!event.editorialPreview || !event.source || !safeHttpsUrl(event.source.url)) return null;
  const summary = event.editorialPreview.summary;
  const summaryZh = event.localization?.zh?.previewSummary ?? summary;
  const points = event.editorialPreview.highlights;
  const pointsZh = event.localization?.zh?.previewHighlights ?? points;
  const guideSource = source(
    event.source.name,
    event.source.url,
    "Published organiser schedule and general introduction; not an attendance report",
  );
  return {
    sections: [{
      kind: "first-visit",
      heading: "First-visit guide",
      headingZh: "第一次去指南",
      summary,
      summaryZh,
      points,
      pointsZh,
      caveat: "This is a general organiser guide, not a promise about next week's stalls or layout.",
      caveatZh: "这是主办方的常规介绍，不保证下周摊位、商品或现场布局。",
      links: [link("Official organiser page", "主办方官网", event.source.url)],
      source: guideSource,
    }],
  };
}

function greyLynnNotice(): EventExperienceSection {
  return {
    kind: "historical-organizer",
    heading: "Previous organiser notice · 30 Aug 2026",
    headingZh: "往期主办方通知 · 2026年8月30日",
    summary: "The organiser's 30 August notice listed produce, cheese, bread and pantry goods, with produce in the Garden Room off the courtyard.",
    summaryZh: "主办方 8 月 30 日的通知列出了果蔬、奶酪、面包与日常食材，并注明庭院旁的 Garden Room 有农产品。",
    caveat: "This is an organiser notice, not an attendance report. Source page changes weekly; the reference was checked on 31 Aug 2026.",
    caveatZh: "这是主办方通知，不是到场记录。来源页每周更新；这条历史参考核对于 2026年8月31日。",
    links: [link("Open the dated organiser notice", "打开这条主办方通知", "https://www.greylynnfarmersmarket.co.nz/this-week")],
    source: source(
      "Grey Lynn Farmers Market",
      "https://www.greylynnfarmersmarket.co.nz/this-week",
      "Dated organiser notice for 30 Aug 2026",
    ),
  };
}

const exactGuides = new Map<string, EventExperienceGuide>([
  ["1Ae8Z_oGkwOKdBs", hiatusGuide],
  ["17aZv0G65C-DS1N", hiatusGuide],
  ["1A0ZkGyGkeEieUI", suzanneGuide],
]);

export function getEventExperience(event: KiwiCueEvent): EventExperienceGuide | null {
  const exact = exactGuides.get(event.id);
  if (exact) return { sections: exact.sections.map((section) => safeSection(section)).filter((section): section is EventExperienceSection => section !== null) };
  const generic = isCuratedMarketEventId(event.id) ? genericMarketGuide(event) : null;
  if (!generic) return null;
  if (event.id === "kc-market-grey-lynn") generic.sections.push(greyLynnNotice());
  return { sections: generic.sections.map((section) => safeSection(section)).filter((section): section is EventExperienceSection => section !== null) };
}
