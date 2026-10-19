import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Log in — Whispa" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <LoginForm />
    </main>
  );
}
