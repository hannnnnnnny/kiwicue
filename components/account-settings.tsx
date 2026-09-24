"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { profileInput } from "../lib/social/validation";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { useRouter } from "next/navigation";

type Profile = { username: string; display_name: string; bio: string | null; city: string | null; is_public: boolean };
type Privacy = { show_saved: boolean; show_going: boolean; followers_can_see_activity: boolean; default_collections_public: boolean; allow_activity_tracking: boolean };
type Preferences = { comment_replies: boolean; comment_likes: boolean; new_followers: boolean; saved_event_reminders: boolean; event_updates: boolean; recommendations: boolean };
type Interest = { id: string; name: string; slug: string };

const privacyLabels: Record<keyof Privacy, [string, string]> = {
  show_saved: ["Show saved events publicly", "公开显示收藏"],
  show_going: ["Show Going events publicly", "公开显示想去的活动"],
  followers_can_see_activity: ["Followers can see activity", "允许关注者查看动态"],
  default_collections_public: ["New collections are public by default", "新清单默认公开"],
  allow_activity_tracking: ["Use my activity to improve recommendations", "使用我的活动记录改善推荐"],
};
const notificationLabels: Record<keyof Preferences, [string, string]> = {
  comment_replies: ["Comment replies", "评论回复"], comment_likes: ["Comment likes", "评论点赞"],
  new_followers: ["New followers", "新关注者"], saved_event_reminders: ["Saved event reminders", "收藏活动提醒"],
  event_updates: ["Event changes", "活动变更"], recommendations: ["Recommendations", "推荐"],
};

function ToggleGroup<T extends Record<string, boolean>>({ title, value, labels, language, onChange }: {
  title: string; value: T; labels: Record<keyof T, [string, string]>;
  language: "en" | "zh"; onChange: (next: T) => void;
}) {
  return <section className="account-section"><h2>{title}</h2><div className="account-toggle-list">
    {(Object.keys(labels) as (keyof T)[]).map((key) => <label key={String(key)}>
      <span>{labels[key][language === "en" ? 0 : 1]}</span>
      <input type="checkbox" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />
    </label>)}
  </div></section>;
}

export function AccountSettings() {
  const router = useRouter();
  const { user, loading, enabled } = useAuth();
  const { language } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!user) return;
    const client = supabaseBrowser();
    if (!client) return;
    let active = true;
    Promise.all([
      client.from("profiles").select("username,display_name,bio,city,is_public").eq("id", user.id).single(),
      client.from("privacy_settings").select("show_saved,show_going,followers_can_see_activity,default_collections_public,allow_activity_tracking").eq("user_id", user.id).single(),
      client.from("notification_preferences").select("comment_replies,comment_likes,new_followers,saved_event_reminders,event_updates,recommendations").eq("user_id", user.id).single(),
      client.from("interests").select("id,name,slug").order("name"),
      client.from("user_interests").select("interest_id").eq("user_id", user.id),
    ]).then(([profileResult, privacyResult, preferencesResult, interestResult, selectedResult]) => {
      if (!active) return;
      if (profileResult.error || privacyResult.error || preferencesResult.error || interestResult.error || selectedResult.error) {
        setError(language === "zh" ? "账号资料暂时无法加载。" : "Account settings are temporarily unavailable.");
        return;
      }
      setProfile(profileResult.data as Profile);
      setPrivacy(privacyResult.data as Privacy);
      setPreferences(preferencesResult.data as Preferences);
      setInterests(interestResult.data as Interest[]);
      setSelected((selectedResult.data as { interest_id: string }[]).map(({ interest_id }) => interest_id));
    });
    return () => { active = false; };
  }, [user, language]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !user || busy) return;
    const parsed = profileInput.safeParse({ username: profile.username, displayName: profile.display_name, bio: profile.bio, city: profile.city, isPublic: profile.is_public });
    if (!parsed.success) { setError(language === "zh" ? "请检查用户名和资料长度。" : "Check your username and profile field lengths."); return; }
    const client = supabaseBrowser();
    if (!client) return;
    setBusy(true); setError(""); setMessage("");
    const { error: updateError } = await client.from("profiles").update({
      username: parsed.data.username, display_name: parsed.data.displayName,
      bio: parsed.data.bio ?? null, city: parsed.data.city ?? null,
      is_public: parsed.data.isPublic ?? false,
    }).eq("id", user.id);
    setBusy(false);
    if (updateError) setError(updateError.code === "23505" ? (language === "zh" ? "用户名已被使用。" : "That username is taken.") : (language === "zh" ? "保存失败，请重试。" : "Could not save profile."));
    else setMessage(language === "zh" ? "资料已保存。" : "Profile saved.");
  }

  async function updateToggle(table: "privacy_settings" | "notification_preferences", next: Privacy | Preferences) {
    const client = supabaseBrowser();
    if (!client || !user) return;
    const old = table === "privacy_settings" ? privacy : preferences;
    if (table === "privacy_settings") setPrivacy(next as Privacy);
    else setPreferences(next as Preferences);
    const { error: updateError } = await client.from(table).update(next).eq("user_id", user.id);
    if (updateError) {
      if (table === "privacy_settings") setPrivacy(old as Privacy);
      else setPreferences(old as Preferences);
      setError(language === "zh" ? "设置未保存，请重试。" : "Setting could not be saved. Try again.");
    }
  }

  async function toggleInterest(interestId: string) {
    const client = supabaseBrowser();
    if (!client || !user) return;
    const wasSelected = selected.includes(interestId);
    setSelected((items) => wasSelected ? items.filter((id) => id !== interestId) : [...items, interestId]);
    const { error: updateError } = wasSelected
      ? await client.from("user_interests").delete().eq("user_id", user.id).eq("interest_id", interestId)
      : await client.from("user_interests").upsert({ user_id: user.id, interest_id: interestId });
    if (updateError) {
      setSelected((items) => wasSelected ? [...items, interestId] : items.filter((id) => id !== interestId));
      setError(language === "zh" ? "兴趣未保存，请重试。" : "Interest could not be saved. Try again.");
    }
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE" || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/me/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }), cache: "no-store" });
      if (!response.ok) throw new Error("delete failed");
      await supabaseBrowser()?.auth.signOut({ scope: "local" });
      router.replace("/events");
      router.refresh();
    } catch { setError(language === "zh" ? "账号删除失败，请联系支持。" : "Account deletion failed. Please contact support."); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="account-panel" role="status">{language === "zh" ? "正在读取账号…" : "Loading account…"}</section>;
  if (!enabled) return <section className="account-panel" role="alert">{language === "zh" ? "账号功能尚未配置。" : "Account features are not configured yet."}</section>;
  if (!user) return <section className="account-panel"><h1>{language === "zh" ? "登录后管理账号" : "Manage your account"}</h1><Link href="/login?next=/account">{language === "zh" ? "登录" : "Log in"}</Link></section>;

  return <div className="account-settings">
    <header><p className="eyebrow">KiwiCue account</p><h1>{language === "zh" ? "账号设置" : "Account settings"}</h1></header>
    {error && <p role="alert" className="account-error">{error}</p>}
    {message && <p role="status" className="account-success">{message}</p>}
    {!profile ? <p role="status">{language === "zh" ? "正在读取资料…" : "Loading your profile…"}</p> : <section className="account-section"><h2>{language === "zh" ? "个人资料" : "Profile"}</h2>
      <form onSubmit={(event) => void saveProfile(event)}>
        <label>{language === "zh" ? "用户名" : "Username"}<input value={profile.username} minLength={3} maxLength={30} pattern="[a-z0-9_]+" onChange={(event) => setProfile({ ...profile, username: event.target.value })} /></label>
        <label>{language === "zh" ? "显示名称" : "Display name"}<input value={profile.display_name} maxLength={100} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label>
        <label>{language === "zh" ? "简介" : "Bio"}<textarea value={profile.bio ?? ""} maxLength={500} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
        <label>{language === "zh" ? "城市" : "City"}<input value={profile.city ?? ""} maxLength={100} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></label>
        <label className="account-check"><input type="checkbox" checked={profile.is_public} onChange={(event) => setProfile({ ...profile, is_public: event.target.checked })} />{language === "zh" ? "公开我的资料" : "Make my profile public"}</label>
        <button type="submit" disabled={busy}>{language === "zh" ? "保存资料" : "Save profile"}</button>
      </form></section>}
    <section className="account-section"><h2>{language === "zh" ? "兴趣" : "Interests"}</h2><p>{language === "zh" ? "可选，随时更改。" : "Optional. Change these any time."}</p><div className="account-interest-grid">{interests.map((interest) => <button type="button" key={interest.id} aria-pressed={selected.includes(interest.id)} onClick={() => void toggleInterest(interest.id)}>{interest.name}</button>)}</div></section>
    {privacy && <ToggleGroup title={language === "zh" ? "隐私" : "Privacy"} value={privacy} labels={privacyLabels} language={language} onChange={(next) => void updateToggle("privacy_settings", next)} />}
    {preferences && <ToggleGroup title={language === "zh" ? "通知" : "Notifications"} value={preferences} labels={notificationLabels} language={language} onChange={(next) => void updateToggle("notification_preferences", next)} />}
    <section className="account-section"><h2>{language === "zh" ? "安全" : "Security"}</h2><Link href="/reset-password">{language === "zh" ? "修改密码" : "Change password"}</Link></section>
    <section className="account-section account-danger"><h2>{language === "zh" ? "危险操作" : "Danger zone"}</h2><p>{language === "zh" ? "删除账号及相关数据后无法恢复。" : "Deleting your account and associated data cannot be undone."}</p><label>{language === "zh" ? "输入 DELETE 确认" : "Type DELETE to confirm"}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label><button type="button" disabled={confirmation !== "DELETE" || busy} onClick={() => void deleteAccount()}>{language === "zh" ? "永久删除账号" : "Delete account"}</button></section>
  </div>;
}
