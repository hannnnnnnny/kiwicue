import { AuthForm } from "../../components/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  return <AuthForm mode="login" linkError={error === "auth" ? "auth" : undefined} />;
}
