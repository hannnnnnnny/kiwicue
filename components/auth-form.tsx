"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authInput, emailInput, passwordInput } from "../lib/social/validation";
import { safeNextPath } from "../lib/auth/safe-next-path";
import { supabaseBrowser } from "./auth-provider";
import { PortalHeader } from "./portal-header";
import { useLanguage } from "./language-provider";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup" | "forgot" | "reset";

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
  const configured = Boolean(supabaseBrowser());

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
        const { data, error: authError } = await client.auth.signUp({
          email, password, options: { emailRedirectTo: `${origin}/auth/callback?next=/account` },
        });
        if (authError) { setError(copy.failed); return; }
        if (data.session) { router.replace("/account"); router.refresh(); }
        else setMessage(copy.checkEmail);
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
        <form onSubmit={submit} noValidate>
          {mode !== "reset" && <label>{copy.email}<input type="email" name="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>}
          {mode !== "forgot" && <label>{copy.password}<input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} /></label>}
          {mode !== "forgot" && <p className="account-help">{language === "zh" ? "密码至少 8 位。" : "Use at least 8 characters."}</p>}
          {!configured && <p role="alert" className="account-error">{copy.unavailable}</p>}
          {error && <p role="alert" className="account-error">{error}</p>}
          {message && <p role="status" className="account-success">{message}</p>}
          <button type="submit" disabled={pending || !configured}>{pending ? copy.busy : copy[mode]}</button>
        </form>
        <div className="account-links">
          {mode === "login" && <><Link href="/forgot-password">{copy.forgotLink}</Link><span>{copy.noAccount} <Link href="/signup">{copy.signup}</Link></span></>}
          {mode === "signup" && <span>{copy.haveAccount} <Link href="/login">{copy.login}</Link></span>}
          {(mode === "forgot" || mode === "reset") && <Link href="/login">{copy.back}</Link>}
        </div>
      </section>
    </main>
  );
}
