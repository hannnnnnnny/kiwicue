"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Language } from "./language-provider";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useRouter } from "next/navigation";

export function AccountControl({ language }: { language: Language }) {
  const { user, loading, enabled } = useAuth();
  if (!enabled) return null;
  if (loading) return <span className="account-nav-loading" role="status" aria-label={language === "zh" ? "正在读取账号" : "Loading account"} />;
  if (!user) return <Link className="account-nav-login" href="/login">{language === "zh" ? "登录" : "Log in"}</Link>;
  return <SignedInAccountControl language={language} user={user} />;
}

function SignedInAccountControl({ language, user }: { language: Language; user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    Promise.all([
      client.from("profiles").select("username,is_public").eq("id", user.id).single(),
      client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    ]).then(([profile, notifications]) => {
      if (!active) return;
      setUsername(profile.data?.is_public ? profile.data.username : null);
      setUnread(notifications.count ?? 0);
    });
    return () => { active = false; };
  }, [user]);
  async function logout() {
    const client = supabaseBrowser();
    if (!client) return;
    const { error: authError } = await client.auth.signOut({ scope: "local" });
    if (authError) { setError(true); return; }
    router.replace("/events");
    router.refresh();
  }

  return (
    <details className="account-nav-menu">
      <summary aria-label={language === "zh" ? `账号菜单，${unread} 条未读通知` : `Account menu, ${unread} unread notifications`}>{user.email?.slice(0, 1).toUpperCase() ?? "K"}{unread > 0 && <span className="account-unread" aria-hidden="true" />}</summary>
      <div className="account-nav-dropdown">
        {username && <Link href={`/u/${encodeURIComponent(username)}`}>{language === "zh" ? "我的主页" : "Profile"}</Link>}
        <Link href="/account">{language === "zh" ? "账号设置" : "Account"}</Link>
        <Link href="/saved">{language === "zh" ? "收藏" : "Saved"}</Link>
        <Link href="/collections">{language === "zh" ? "清单" : "Collections"}</Link>
        <Link href="/notifications">{language === "zh" ? "通知" : "Notifications"}</Link>
        <Link href="/for-you">{language === "zh" ? "为你推荐" : "For You"}</Link>
        <button type="button" onClick={() => void logout()}>{language === "zh" ? "退出登录" : "Log out"}</button>
        {error && <p role="alert">{language === "zh" ? "退出失败，请重试。" : "Could not log out. Try again."}</p>}
      </div>
    </details>
  );
}
