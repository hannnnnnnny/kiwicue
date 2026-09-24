"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { commentInput, eventIdInput } from "../lib/social/validation";
import { trackActivity } from "../lib/social/activity";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

type Comment = { id: string; user_id: string; parent_id: string | null; content: string; created_at: string; updated_at: string };
type Profile = { id: string; display_name: string; username: string };
type ReportReason = "spam" | "harassment" | "offensive" | "misinformation" | "other";

function CommentComposer({ eventId, parentId, onDone, onCancel }: {
  eventId: string; parentId?: string; onDone: () => void; onCancel?: () => void;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = commentInput.safeParse({ content });
    if (!parsed.success || !eventIdInput.safeParse(eventId).success) {
      setError(language === "zh" ? "评论需为 1–1000 字。" : "Use 1–1000 characters."); return;
    }
    const client = supabaseBrowser();
    if (!client || !user || busy) return;
    setBusy(true); setError("");
    const { error: saveError } = await client.from("comments").insert({
      event_id: eventId, user_id: user.id, parent_id: parentId ?? null, content: parsed.data.content,
    });
    setBusy(false);
    if (saveError) setError(language === "zh" ? "发表失败，请稍后重试。" : "Could not post. Please try again later.");
    else { setContent(""); void trackActivity({ action: "event_comment", eventId }); onDone(); }
  }

  return <form className="comment-composer" onSubmit={(event) => void submit(event)}>
    <label>{parentId ? (language === "zh" ? "回复" : "Your reply") : (language === "zh" ? "你的评论" : "Your comment")}
      <textarea value={content} maxLength={1000} required onChange={(event) => setContent(event.target.value)} />
    </label><div><button type="submit" disabled={busy}>{busy ? (language === "zh" ? "发送中…" : "Posting…") : (language === "zh" ? "发表" : "Post comment")}</button>
      {onCancel && <button type="button" onClick={onCancel}>{language === "zh" ? "取消" : "Cancel"}</button>}</div>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function CommentActions({ comment, eventId, liked, likes, onChanged }: {
  comment: Comment; eventId: string; liked: boolean; likes: number; onChanged: () => void;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [content, setContent] = useState(comment.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return null;

  async function mutate(action: "like" | "edit" | "delete" | "report") {
    const client = supabaseBrowser();
    if (!client || !user || busy) return;
    const parsed = commentInput.safeParse({ content });
    if (action === "edit" && !parsed.success) { setError(language === "zh" ? "评论需为 1–1000 字。" : "Use 1–1000 characters."); return; }
    setBusy(true); setError("");
    const result = action === "like" ? (liked
      ? await client.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", user.id)
      : await client.from("comment_likes").insert({ comment_id: comment.id, user_id: user.id }))
      : action === "edit" ? await client.from("comments").update({ content: parsed.data!.content }).eq("id", comment.id).eq("user_id", user.id)
      : action === "delete" ? await client.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", comment.id).eq("user_id", user.id)
      : await client.from("comment_reports").insert({ comment_id: comment.id, reporter_id: user.id, reason });
    setBusy(false);
    if (result.error) setError(language === "zh" ? "操作失败，请重试。" : "Could not save your change. Try again.");
    else { setEditing(false); setReporting(false); if (action === "like" && !liked) void trackActivity({ action: "event_like", eventId }); onChanged(); }
  }

  return <div className="comment-actions">
    <button type="button" disabled={busy} aria-pressed={liked} onClick={() => void mutate("like")}>{liked ? "♥" : "♡"} {likes}</button>
    {!comment.parent_id && <button type="button" onClick={() => setReplying(!replying)}>{language === "zh" ? "回复" : "Reply"}</button>}
    {comment.user_id === user.id ? <><button type="button" onClick={() => setEditing(!editing)}>{language === "zh" ? "编辑" : "Edit"}</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(language === "zh" ? "确定删除这条评论？" : "Delete this comment?")) void mutate("delete"); }}>{language === "zh" ? "删除" : "Delete"}</button></>
      : <button type="button" onClick={() => setReporting(!reporting)}>{language === "zh" ? "举报" : "Report"}</button>}
    {replying && <CommentComposer eventId={eventId} parentId={comment.id} onDone={() => { setReplying(false); onChanged(); }} onCancel={() => setReplying(false)} />}
    {editing && <form onSubmit={(event) => { event.preventDefault(); void mutate("edit"); }}><label>{language === "zh" ? "编辑评论" : "Edit comment"}<textarea value={content} maxLength={1000} onChange={(event) => setContent(event.target.value)} /></label><button type="submit" disabled={busy}>{language === "zh" ? "保存" : "Save"}</button></form>}
    {reporting && <form onSubmit={(event) => { event.preventDefault(); void mutate("report"); }}><label>{language === "zh" ? "举报原因" : "Reason"}<select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="offensive">Offensive</option><option value="misinformation">Misinformation</option><option value="other">Other</option></select></label><button type="submit" disabled={busy}>{language === "zh" ? "提交举报" : "Submit report"}</button></form>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function EventDiscussion({ eventId }: { eventId: string }) {
  const { user, loading, enabled } = useAuth();
  const { language } = useLanguage();
  const [roots, setRoots] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [likes, setLikes] = useState<{ comment_id: string; user_id: string }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !eventIdInput.safeParse(eventId).success) return;
    let active = true;
    client.from("comments").select("id,user_id,parent_id,content,created_at,updated_at")
      .eq("event_id", eventId).is("parent_id", null).is("deleted_at", null)
      .order("created_at", { ascending: false }).range(page * 20, page * 20 + 20)
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) { setState("error"); return; }
        const rootItems = (data ?? []) as Comment[];
        setMore(rootItems.length > 20);
        const visible = rootItems.slice(0, 20);
        const ids = visible.map((item) => item.id);
        const replyResult = ids.length ? await client.from("comments")
          .select("id,user_id,parent_id,content,created_at,updated_at").in("parent_id", ids)
          .is("deleted_at", null).order("created_at").limit(100) : { data: [], error: null };
        if (!active) return;
        if (replyResult.error) { setState("error"); return; }
        const replyItems = (replyResult.data ?? []) as Comment[];
        const allIds = [...ids, ...replyItems.map((item) => item.id)];
        const likeResult = allIds.length ? await client.from("comment_likes").select("comment_id,user_id").in("comment_id", allIds).limit(1000) : { data: [], error: null };
        if (!active || likeResult.error) { if (active) setState("error"); return; }
        const userIds = [...new Set([...visible, ...replyItems].map((item) => item.user_id))];
        const profileResult = userIds.length ? await client.from("profiles").select("id,display_name,username").in("id", userIds).limit(120) : { data: [], error: null };
        if (!active) return;
        setRoots(visible); setReplies(replyItems); setLikes((likeResult.data ?? []) as typeof likes);
        setProfiles((profileResult.data ?? []) as Profile[]); setState("ready");
      });
    return () => { active = false; };
  }, [eventId, page, revision]);

  function renderComment(comment: Comment) {
    const profile = profiles.find((item) => item.id === comment.user_id);
    const relatedLikes = likes.filter((item) => item.comment_id === comment.id);
    return <li key={comment.id} className={comment.parent_id ? "comment-reply" : "comment-root"}>
      <p className="comment-byline">{profile ? <Link href={`/u/${encodeURIComponent(profile.username)}`}>{profile.display_name}</Link> : (language === "zh" ? "社区成员" : "Community member")} <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString(language === "zh" ? "zh-NZ" : "en-NZ")}</time></p>
      <p className="comment-content">{comment.content}</p>
      <CommentActions comment={comment} eventId={eventId} liked={Boolean(user && relatedLikes.some((item) => item.user_id === user.id))} likes={relatedLikes.length} onChanged={refresh} />
      {!comment.parent_id && <ul className="comment-replies">{replies.filter((item) => item.parent_id === comment.id).map(renderComment)}</ul>}
    </li>;
  }

  if (!enabled) return null;
  return <section className="event-discussion" aria-label={language === "zh" ? "活动讨论" : "Event discussion"}>
    <h2>{language === "zh" ? "聊聊这个活动" : "Talk about this event"}</h2>
    {!loading && !user && <p><Link href={`/login?next=/events/${encodeURIComponent(eventId)}`}>{language === "zh" ? "登录后评论" : "Log in to comment"}</Link></p>}
    {user && <CommentComposer eventId={eventId} onDone={refresh} />}
    {state === "loading" && <p role="status">{language === "zh" ? "读取评论中…" : "Loading comments…"}</p>}
    {state === "error" && <p role="alert">{language === "zh" ? "评论暂时不可用。" : "Comments are temporarily unavailable."} <button type="button" onClick={refresh}>{language === "zh" ? "重试" : "Retry"}</button></p>}
    {state === "ready" && roots.length === 0 && <p>{language === "zh" ? "还没有评论，来聊聊吧。" : "No comments yet. Start the conversation."}</p>}
    {state === "ready" && <ul className="comment-list">{roots.map(renderComment)}</ul>}
    {state === "ready" && (page > 0 || more) && <div className="comment-pagination"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{language === "zh" ? "上一页" : "Previous"}</button><button type="button" disabled={!more} onClick={() => setPage((value) => value + 1)}>{language === "zh" ? "下一页" : "Next"}</button></div>}
  </section>;
}
