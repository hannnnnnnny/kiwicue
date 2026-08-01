"use client";

import { useState } from "react";
import { distanceKm, formatDistanceKm } from "../lib/distance";
import type { EventCoordinates } from "../lib/events";
import type { Language } from "./language-provider";

type DistanceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; distance: number }
  | { status: "error"; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

const copy = {
  en: {
    title: "How far is it from me?",
    privacy: "Your position is used only on this device and is not saved.",
    show: "Show distance from me",
    loading: "Checking your location",
    update: "Update distance",
    retry: "Try location again",
    denied: "Location access is off. Enable it in your browser settings to calculate distance.",
    unavailable: "Your location is unavailable right now.",
    timeout: "Location took too long. Try again.",
    unsupported: "This browser cannot provide location distance.",
  },
  zh: {
    title: "这里离我多远？",
    privacy: "你的位置只在当前设备计算，不会被保存。",
    show: "查看离我多远",
    loading: "正在获取你的位置",
    update: "更新距离",
    retry: "重新获取位置",
    denied: "定位权限未开启。请在浏览器设置中允许定位后再计算距离。",
    unavailable: "暂时无法获取你的位置。",
    timeout: "获取位置超时，请重试。",
    unsupported: "当前浏览器无法提供定位距离。",
  },
} as const;

function reasonFor(error: GeolocationPositionError): Extract<DistanceState, { status: "error" }>["reason"] {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unavailable";
}

export function DistancePanel({ coordinates, language }: {
  coordinates: EventCoordinates;
  language: Language;
}) {
  const [state, setState] = useState<DistanceState>({ status: "idle" });
  const content = copy[language];

  function requestDistance() {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", reason: "unsupported" });
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = distanceKm(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          coordinates,
        );
        setState({ status: "success", distance });
      },
      (error) => setState({ status: "error", reason: reasonFor(error) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const buttonLabel = state.status === "loading"
    ? content.loading
    : state.status === "success"
      ? content.update
      : state.status === "error"
        ? content.retry
        : content.show;

  return (
    <section className="distance-panel" aria-labelledby="distance-title">
      <h3 id="distance-title">{content.title}</h3>
      <p className="distance-privacy">{content.privacy}</p>
      {state.status === "success" && (
        <p className="distance-result" role="status">
          {formatDistanceKm(state.distance, language)}
        </p>
      )}
      {state.status === "error" && (
        <p className="distance-error" role="alert">{content[state.reason]}</p>
      )}
      <button
        type="button"
        onClick={requestDistance}
        disabled={state.status === "loading"}
      >
        {buttonLabel}
      </button>
    </section>
  );
}
