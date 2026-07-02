import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PasswordForm from "./password-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="mb-6">
        <a href="/" className="text-sm text-blue-600 hover:underline">← メニューに戻る</a>
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">パスワード変更</h2>
      <div className="bg-white rounded-lg border p-6">
        <PasswordForm />
      </div>
    </div>
  );
}
