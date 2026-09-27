import { AuthForm } from "../../components/auth-form";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  return <AuthForm mode="forgot" linkError={error === "link" ? "link" : undefined} />;
}
