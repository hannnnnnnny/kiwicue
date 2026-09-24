import Link from "next/link";
import { PortalHeader } from "../../../components/portal-header";

export const dynamic = "force-dynamic";

export default async function VerifiedEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const confirmed = status === "confirmed";
  return (
    <main className="account-page">
      <PortalHeader />
      <section className="account-panel" aria-labelledby="verification-title">
        <p className="eyebrow">KiwiCue / 纽村小报</p>
        <h1 id="verification-title">{confirmed ? "Email confirmed · 邮箱已验证" : "Check your link · 请检查验证链接"}</h1>
        {confirmed ? (
          <>
            <p>Your email is verified. Return to the computer where you signed up; that page will automatically open your account.</p>
            <p>验证成功。请回到刚才注册的电脑页面，它会自动进入你的账号，无需再次输入密码。</p>
          </>
        ) : (
          <>
            <p>We could not confirm this link. It may have expired or already been used. Please return to your signup page or log in if your email was confirmed earlier.</p>
            <p>这个链接可能已过期或已使用。请回到注册页面重试；如果之前已经完成验证，也可以直接登录。</p>
          </>
        )}
        <div className="account-links"><Link href="/login">Log in / 登录</Link></div>
      </section>
    </main>
  );
}
