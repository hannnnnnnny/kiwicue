"use client";

import Link from "next/link";
import { useState } from "react";
import { createPlan } from "../../lib/ask/plans";
import type { AskCard, AskFilters } from "../../lib/ask/schema";
import { useOutingPlans } from "./use-outing-plans";

export function PlanSelection({ cards, filters, language }: { cards: AskCard[]; filters: AskFilters; language: "en" | "zh" }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const { save } = useOutingPlans();
  const chosen = cards.filter((card) => selected.includes(card.id));
  const zh = language === "zh";
  function toggle(id: string) {
    setStatus("idle");
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 12));
  }
  function persist() {
    if (!chosen.length) return;
    const plan = createPlan(chosen, filters, name.trim() || (zh ? "我的奥克兰行程" : "My Auckland outing"));
    setStatus(save(plan) ? "saved" : "error");
  }
  return <details className="ask-plan-selection"><summary>{zh ? "选择活动并保存行程" : "Select activities and save a plan"}</summary>
    <p>{zh ? "结果是候选方案。请选取要去的活动；时长、交通和未标明的价格仍需确认。" : "Results are alternatives. Select what you want to attend; durations, travel and unlisted prices still need checking."}</p>
    <fieldset><legend>{zh ? "加入行程（最多 12 项）" : "Add to plan (up to 12)"}</legend>{cards.map((card) => <label key={card.id}>
      <input type="checkbox" checked={selected.includes(card.id)} onChange={() => toggle(card.id)} />{card.title}
      {card.indoor ? <small>{zh ? " · 室内备选" : " · Indoor option"}</small> : null}
    </label>)}</fieldset>
    <label>{zh ? "行程名称" : "Plan name"}<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
    <button type="button" disabled={!chosen.length || status === "saved"} onClick={persist}>{zh ? "保存到本机" : "Save on this device"}</button>
    {status === "saved" ? <p role="status">{zh ? "已保存到本机。" : "Saved on this device."} <Link href="/plans">{zh ? "查看行程" : "View plans"}</Link></p> : null}
    {status === "error" ? <p role="alert">{zh ? "保存失败。请允许本地存储，或删除旧行程后重试。" : "Could not save. Allow browser storage, or remove an old plan and try again."}</p> : null}
  </details>;
}
