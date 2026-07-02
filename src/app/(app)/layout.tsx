import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@/lib/constants";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col">
      <header className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg hover:text-blue-200 transition-colors">人事評価システム</Link>
        <div className="flex items-center gap-4 text-sm">
          <span>{session.user.name}（{ROLE_LABELS[session.user.role] ?? session.user.role}）</span>
          <Link href="/settings" className="text-xs text-blue-200 hover:text-white">
            パスワード変更
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
