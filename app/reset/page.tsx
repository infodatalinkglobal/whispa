import ResetForm from "@/components/ResetForm";

export const metadata = { title: "Reset password — Whispa" };

export default function ResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <ResetForm />
    </main>
  );
}
