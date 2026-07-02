import { auth } from "@/auth";
import { redirect } from "next/navigation";
import FirstLoginForm from "./first-login-form";

export default async function FirstLoginPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.is_first_login) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-md">
        <h1 className="text-xl font-bold text-center mb-2 text-gray-800">初回ログイン設定</h1>
        <p className="text-center text-gray-500 text-sm mb-6">人事評価システム</p>
        <FirstLoginForm name={session.user.name ?? ""} employeeNumber={session.user.employee_number ?? null} />
      </div>
    </div>
  );
}
