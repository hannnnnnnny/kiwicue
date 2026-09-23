"use client";
import { useState } from "react";
import { DiscoveryIcon } from "./discovery-icon";
import type { Language } from "./language-provider";

export function EventShareButton({ title, language }: { title: string; language: Language }) {
  const [message, setMessage] = useState("");
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage(language === "zh" ? "链接已复制" : "Link copied");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage(language === "zh" ? "无法分享，请复制浏览器地址。" : "Sharing unavailable. Copy the browser address instead.");
    }
  }
  return <div className="event-share"><button type="button" onClick={share}><DiscoveryIcon name="share" />{language === "zh" ? "分享" : "Share"}</button>{message && <span role="status">{message}</span>}</div>;
}
