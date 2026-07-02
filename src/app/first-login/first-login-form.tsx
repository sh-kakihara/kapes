"use client";

import { useState } from "react";
import { setupFirstLogin } from "@/server/user-password";
import { signIn, signOut } from "next-auth/react";

export default function FirstLoginForm({ name, employeeNumber }: { name: string; employeeNumber: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("パスワードと確認用パスワードが一致しません");
      return;
    }
    if (!employeeNumber) {
      setError("社員番号が登録されていません。管理者にお問い合わせください。");
      return;
    }
    setLoading(true);
    setError("");
    const res = await setupFirstLogin(employeeNumber, password);
    if (!res.ok) {
      setLoading(false);
      setError(res.error ?? "エラーが発生しました");
      return;
    }
    // 新しい認証情報で再ログインしてトップへ
    await signIn("credentials", { login_id: employeeNumber, password, callbackUrl: "/" });
    setLoading(false);
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <p className="text-green-600 font-medium">設定が完了しました</p>
        <p className="text-sm text-gray-500">社員番号とパスワードでログインしてください</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 px-6 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          ログイン画面へ
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-right">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          ログアウト
        </button>
      </div>
      <p className="text-sm text-gray-600">
        {name} さん、初回ログインです。パスワードを設定してください。
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ログインID（社員番号）
        </label>
        <input
          type="text"
          value={employeeNumber ?? "（未設定）"}
          readOnly
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">ログインIDは社員番号に固定されます</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          新しいパスワード（6文字以上）
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          パスワード（確認）
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !employeeNumber}
        className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "設定中..." : "設定する"}
      </button>
    </form>
  );
}
