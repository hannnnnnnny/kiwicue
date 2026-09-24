"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authInput, emailInput, passwordInput } from "../lib/social/validation";
import { safeNextPath } from "../lib/auth/safe-next-path";
import { supabaseBrowser } from "./auth-provider";
import { PortalHeader } from "./portal-header";
import { useLanguage } from "./language-provider";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup" | "forgot" | "reset";
type SignupPhase = "editing" | "waiting" | "completing" | "expired" | "failed";
const SIGNUP_WAIT_MS = 15 * 60_000;

const labels = {
  en: {
    login: "Log in", signup: "Create account", forgot: "Reset password", reset: "Choose a new password",
    email: "Email", password: "Password", submit: "Continue", busy: "Please wait…",
    noAccount: "New to KiwiCue?", haveAccount: "Already have an account?",
    forgotLink: "Forgot your password?", back: "Back to log in",
    checkEmail: "Check your email for the secure link. You can close this page.",
    updated: "Password updated. You can now log in.",
    invalid: "Check your email and password, then try again.",
    unavailable: "Account features are not configured yet. Event discovery still works.",
    failed: "This request could not be completed. Please try again.",
    waiting: "Waiting for email confirmation. Open the email on any device; this tab will continue automatically.",
    completing: "Email confirmed. Signing you in…",
    expired: "Verification wait expired. If you confirmed the email, log in normally; otherwise start again.",
    retry: "Start again",
  },
  zh: {
    login: "登录", signup: "创建账号", forgot: "重设密码", reset: "设置新密码",
    email: "邮箱", password: "密码", submit: "继续", busy: "请稍候…",
    noAccount: "还没有 KiwiCue 账号？", haveAccount: "已有账号？",
    forgotLink: "忘记密码？", back: "返回登录",
    checkEmail: "请查收邮箱中的安全链接，然后按提示继续。",
    updated: "密码已更新，现在可以登录。",
    invalid: "请检查邮箱和密码后重试。",
    unavailable: "账号功能尚未配置，活动浏览仍可正常使用。",
    failed: "暂时无法完成操作，请稍后重试。",
    waiting: "正在等待邮箱验证。你可以在手机上确认邮件，当前页面随后会自动进入账号。",
    completing: "邮箱已确认，正在自动登录…",
    expired: "验证等待已结束。如果已确认邮箱，请直接登录；否则可以重新开始。",
    retry: "重新开始",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = labels[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signupPhase, setSignupPhase] = useState<SignupPhase>("editing");
  const signupCredentials = useRef<{ email: string; password: string } | null>(null);
  const signupStartedAt = useRef(0);
  const signInStarted = useRef(false);
  const configured = Boolean(supabaseBrowser());

  useEffect(() => {
    if (mode !== "signup" || signupPhase !== "waiting") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (!active) return;
      if (Date.now() - signupStartedAt.current >= SIGNUP_WAIT_MS) {
        signupCredentials.current = null;
        setSignupPhase("expired");
        return;
      }
      try {
        const response = await fetch("/api/auth/signup-status", { credentials: "same-origin", cache: "no-store" });
        if (!active) return;
        if (response.status === 401) { signupCredentials.current = null; setSignupPhase("expired"); return; }
        if (response.ok && (await response.json() as { confirmed?: unknown }).confirmed === true) {
          setSignupPhase("completing");
          return;
        }
      } catch { /* A temporary network failure is retried before the deadline. */ }
      if (active) timer = setTimeout(check, document.visibilityState === "visible" ? 5_000 : 10_000);
    };
    timer = setTimeout(check, 3_000);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, signupPhase]);

  useEffect(() => {
    if (mode !== "signup" || signupPhase !== "completing" || signInStarted.current) return;
    const credentials = signupCredentials.current;
    const client = supabaseBrowser();
    if (!credentials || !client) { setSignupPhase("failed"); return; }
    signInStarted.current = true;
    let active = true;
    client.auth.signInWithPassword(credentials).then(({ error: authError }) => {
      signupCredentials.current = null;
      if (!active) return;
      if (authError) { setSignupPhase("failed"); return; }
      router.replace("/account");
      router.refresh();
    }).catch(() => {
      signupCredentials.current = null;
      if (active) setSignupPhase("failed");
    });
    return () => { active = false; };
  }, [mode, router, signupPhase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const client = supabaseBrowser();
    if (!client) { setError(copy.unavailable); return; }
    const valid = mode === "forgot" ? emailInput.safeParse(email) : mode === "reset"
      ? passwordInput.safeParse(password) : authInput.safeParse({ email, password });
    if (!valid.success) { setError(copy.invalid); return; }
    setError(""); setMessage(""); setPending(true);
    const origin = window.location.origin;
    try {
      if (mode === "login") {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) { setError(copy.invalid); return; }
        const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
        router.replace(next);
        router.refresh();
      } else if (mode === "signup") {
        const response = await fetch("/api/auth/signup", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "same-origin", body: JSON.stringify({ email, password }),
        });
        if (!response.ok) { setError(copy.failed); return; }
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("pending" in result) || typeof result.pending !== "boolean") {
          setError(copy.failed); return;
        }
        signupCredentials.current = { email, password };
        signupStartedAt.current = Date.now();
        setPassword("");
        setSignupPhase(result.pending ? "waiting" : "completing");
      } else if (mode === "forgot") {
        const { error: authError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        });
        if (authError) { setError(copy.failed); return; }
        setMessage(copy.checkEmail);
      } else {
        const { error: authError } = await client.auth.updateUser({ password });
        if (authError) { setError(copy.failed); return; }
        setMessage(copy.updated);
      }
    } catch { setError(copy.failed); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <PortalHeader />
      <section className="account-panel" aria-labelledby="auth-title">
        <p className="eyebrow">KiwiCue / 纽村小报</p>
        <h1 id="auth-title">{copy[mode]}</h1>
        {mode === "signup" && signupPhase !== "editing" ? (
          <div className="account-verification" role={signupPhase === "expired" || signupPhase === "failed" ? "alert" : "status"}>
            <p>{signupPhase === "waiting" ? copy.waiting : signupPhase === "completing" ? copy.completing : signupPhase === "expired" ? copy.expired : copy.failed}</p>
            {(signupPhase === "expired" || signupPhase === "failed") && <button type="button" onClick={() => { signInStarted.current = false; setSignupPhase("editing"); }}>{copy.retry}</button>}
          </div>
        ) : <form onSubmit={submit} noValidate>
          {mode !== "reset" && <label>{copy.email}<input type="email" name="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>}
          {mode !== "forgot" && <label>{copy.password}<input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} /></label>}
          {mode !== "forgot" && <p className="account-help">{language === "zh" ? "密码至少 8 位。" : "Use at least 8 characters."}</p>}
          {!configured && <p role="alert" className="account-error">{copy.unavailable}</p>}
          {error && <p role="alert" className="account-error">{error}</p>}
          {message && <p role="status" className="account-success">{message}</p>}
          <button type="submit" disabled={pending || !configured}>{pending ? copy.busy : copy[mode]}</button>
        </form>}
        <div className="account-links">
          {mode === "login" && <><Link href="/forgot-password">{copy.forgotLink}</Link><span>{copy.noAccount} <Link href="/signup">{copy.signup}</Link></span></>}
          {mode === "signup" && <span>{copy.haveAccount} <Link href="/login">{copy.login}</Link></span>}
          {(mode === "forgot" || mode === "reset") && <Link href="/login">{copy.back}</Link>}
        </div>
      </section>
    </main>
  );
}
