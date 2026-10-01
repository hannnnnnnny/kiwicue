"use client";

import { useMemo, useSyncExternalStore } from "react";
import { MAX_PLANS, PLAN_STORAGE_KEY, outingPlanSchema, readPlans, type OutingPlan } from "../../lib/ask/plans";

const changed = "kiwicue-plans-changed";
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(changed, listener); window.removeEventListener("storage", listener); };
}
function snapshot(): string | null {
  try { return window.localStorage.getItem(PLAN_STORAGE_KEY); }
  catch { return null; }
}
function write(plans: OutingPlan[]): boolean {
  try {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
    window.dispatchEvent(new Event(changed));
    return true;
  } catch { return false; }
}

export function useOutingPlans() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const plans = useMemo(() => readPlans(raw), [raw]);
  function save(plan: OutingPlan): boolean {
    const parsed = outingPlanSchema.safeParse(plan);
    if (!parsed.success) return false;
    const current = readPlans(snapshot());
    const rest = current.filter((item) => item.id !== plan.id);
    return rest.length < MAX_PLANS && write([parsed.data, ...rest]);
  }
  function remove(id: string) { return write(readPlans(snapshot()).filter((plan) => plan.id !== id)); }
  return { plans, save, remove };
}
