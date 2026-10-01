"use client";

import Link from "next/link";
import { useState } from "react";
import { planCalendar } from "../../lib/ask/calendar";
import { planCosts, planWarnings, type OutingPlan } from "../../lib/ask/plans";
import { useLanguage } from "../language-provider";
import { AskResultCard } from "./ask-result-card";
import { PortalHeader } from "../portal-header";
import { useOutingPlans } from "./use-outing-plans";

function downloadCalendar(plan: OutingPlan) {
  const url = URL.createObjectURL(new Blob([planCalendar(plan)], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `kiwicue-${plan.id}.ics`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const warnings = {
  en: { overlap: "Activities overlap. Choose alternatives before you go.", duration: "Some durations are unknown; this is not a verified complete itinerary.", travel: "Travel time between venues is not included. Check transport before you go." },
  zh: { overlap: "活动时间重叠，请先取舍。", duration: "部分活动时长未知，这还不是已核实的完整行程。", travel: "尚未计入场馆间的交通时间，出发前请核对交通。" },
};

function PlanEditor({ plan, language, save, remove }: { plan: OutingPlan; language: "en" | "zh"; save(plan: OutingPlan): boolean; remove(id: string): boolean }) {
  const [name, setName] = useState(plan.name);
  const [notes, setNotes] = useState(plan.notes);
  const [message, setMessage] = useState("");
  const costs = planCosts(plan), zh = language === "zh";
  function update() { setMessage(save({ ...plan, name: name.trim(), notes }) ? zh ? "已更新" : "Updated" : zh ? "更新失败，请检查名称和本地存储" : "Could not update; check the name and browser storage"); }
  function erase() {
    if (window.confirm(zh ? "删除这个本机行程？" : "Delete this local plan?")) {
      if (!remove(plan.id)) setMessage(zh ? "删除失败" : "Could not delete");
    }
  }
  return <article className="outing-plan"><h2>{plan.name}</h2>
    <p>{zh ? `${plan.filters.partySize} 人 · ` : `${plan.filters.partySize} people · `}{costs.free ? zh ? "免费入场" : "Free entry" : zh ? `已知最低票价合计 $${costs.minimum}；票种和额外费用待确认` : `Known ticket minimum $${costs.minimum}; ticket types and extra fees unconfirmed`}</p>
    {costs.unknown ? <p role="status">{zh ? "部分价格未知，总预算未核实。" : "Some prices are unknown; the total budget is unverified."}</p> : null}
    {costs.exceeds ? <p role="alert">{zh ? "已知最低费用已超过总预算。" : "The known minimum already exceeds the total budget."}</p> : null}
    {planWarnings(plan.cards).map((warning) => <p className="outing-warning" key={warning}>{warnings[language][warning]}</p>)}
    <ol>{plan.cards.map((card) => <li key={card.id}><AskResultCard card={card} best={false} language={language} /></li>)}</ol>
    <label>{zh ? "名称" : "Name"}<input maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>{zh ? "备注及雨天备选" : "Notes and rainy-day alternatives"}<textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    <div className="outing-actions"><button onClick={update}>{zh ? "保存修改" : "Save changes"}</button>
      <button onClick={() => downloadCalendar({ ...plan, notes })}>{zh ? "导出日历" : "Export calendar"}</button><button onClick={erase}>{zh ? "删除行程" : "Delete plan"}</button></div>
    {message ? <p role="status">{message}</p> : null}
  </article>;
}

export function OutingPlansPage() {
  const { language } = useLanguage();
  const { plans, save, remove } = useOutingPlans();
  const zh = language === "zh";
  return <main className="outing-plans"><PortalHeader currentPage="plans" skipTarget="outing-plan-content" /><div id="outing-plan-content"><Link href="/">{zh ? "返回活动" : "Back to events"}</Link><h1>{zh ? "我的行程" : "My outing plans"}</h1>
    <p>{zh ? "仅保存到当前浏览器，不会同步账号。日历导出不会预订或启用后台监控；提醒由日历应用设置。" : "Stored in this browser, without account sync. Calendar export does not book or enable background monitoring; set reminders in your calendar app."}</p>
    {plans.length === 0 ? <p role="status">{zh ? "还没有行程。打开助手搜索活动，选择结果并保存。" : "No plans yet. Search with the assistant, select results and save a plan."}</p> : null}
    {plans.map((plan) => <PlanEditor key={plan.id} plan={plan} language={language} save={save} remove={remove} />)}
  </div></main>;
}
