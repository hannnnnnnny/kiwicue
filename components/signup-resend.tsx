"use client";

import { useEffect, useState } from "react";

export const RESEND_COOLDOWN_S = 60;

type ResendState = "idle" | "sending" | "sent" | "limited" | "failed";

const labels = {
  en: {
    resend: "Resend email",
    wait: (seconds: number) => `Resend in ${seconds}s`,
    sending: "Sending…",
    sent: "Sent again. If it still doesn't arrive, check your spam folder.",
    limited: "Too many requests. Wait a minute, then try again.",
    failed: "The email could not be resent right now. Please try again later.",
  },
  zh: {
    resend: "重新发送邮件",
    wait: (seconds: number) => `${seconds} 秒后可重新发送`,
    sending: "正在发送…",
    sent: "已重新发送。如果还是没收到，请检查垃圾邮件文件夹。",
    limited: "请求太频繁，请稍等一分钟再试。",
    failed: "暂时无法重新发送，请稍后再试。",
  },
} as const;

// Counting against a fixed deadline (not chained ticks) stays correct when a background
// tab throttles its timers, which is exactly when people go and check their inbox.
function useCountdown(seconds: number) {
  const [deadline, setDeadline] = useState(() => Date.now() + seconds * 1_000);
  const [now, setNow] = useState(() => Date.now());
  const waiting = now < deadline;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [waiting]);
  const restart = () => {
    const current = Date.now();
    setNow(current);
    setDeadline(current + seconds * 1_000);
  };
  return { remaining: Math.max(0, Math.ceil((deadline - now) / 1_000)), restart };
}

/**
 * The cooldown starts at mount because signup has just sent the first email; it mirrors
 * Supabase's per-address resend limit so people are not invited to click into a 429.
 */
export function SignupResend({ language, onConfirmed, onExpired }: {
  language: "en" | "zh";
  onConfirmed: () => void;
  onExpired: () => void;
}) {
  const copy = labels[language];
  const { remaining, restart } = useCountdown(RESEND_COOLDOWN_S);
  const [state, setState] = useState<ResendState>("idle");

  async function resend() {
    setState("sending");
    try {
      const response = await fetch("/api/auth/signup-status/resend", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (response.status === 409) { onConfirmed(); return; }
      if (response.status === 401) { onExpired(); return; }
      if (response.status === 429) { setState("limited"); restart(); return; }
      setState(response.ok ? "sent" : "failed");
      if (response.ok) restart();
    } catch {
      setState("failed");
    }
  }

  const disabled = state === "sending" || remaining > 0;
  const label = state === "sending" ? copy.sending : remaining > 0 ? copy.wait(remaining) : copy.resend;
  const notice = state === "sent" || state === "limited" || state === "failed" ? copy[state] : null;

  return (
    <div className="account-resend">
      <button type="button" className="account-resend-button" onClick={resend} disabled={disabled}>{label}</button>
      {notice && <p className={state === "sent" ? "account-success" : "account-error"} role={state === "sent" ? "status" : "alert"}>{notice}</p>}
    </div>
  );
}
