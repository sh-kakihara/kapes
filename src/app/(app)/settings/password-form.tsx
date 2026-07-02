"use client";

import { useState } from "react";
import { changePassword } from "@/server/user-password";

export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMessage({ text: "新しいパスワードと確認用パスワードが一致しません", ok: false });
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await changePassword(current, next);
    setLoading(false);
    if (res.ok) {
      setMessage({ text: "パスワードを変更しました", ok: true });
      setCurrent(""); setNext(""); setConfirm("");
    } else {
      setMessage({ text: res.error ?? "エラーが発生しました", ok: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（6文字以上）</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
        {loading ? "変更中..." : "パスワードを変更する"}
      </button>
    </form>
  );
}
