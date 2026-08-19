"use client";

import { useState, useRef, useEffect } from "react";
import { createBackup, restoreBackup } from "@/server/backup";

export default function BackupPage() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restoreLoading) { setElapsedSec(0); return; }
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [restoreLoading]);

  async function handleBackup() {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const result = await createBackup();
      if (!result.ok) {
        setBackupMsg(`エラー: ${result.error}`);
        return;
      }
      const blob = new Blob([new Uint8Array(result.data)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg("バックアップファイルをダウンロードしました");
    } catch (e) {
      setBackupMsg(`エラー: ${e}`);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore() {
    if (!restoreFile) return;
    setConfirmOpen(false);
    setRestoreLoading(true);
    setRestoreMsg(null);
    try {
      const buf = await restoreFile.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const result = await restoreBackup(bytes);
      setRestoreMsg(result.message);
      if (result.ok) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      setRestoreMsg(`エラー: ${e}`);
    } finally {
      setRestoreLoading(false);
      setRestoreFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h2 className="text-xl font-bold text-gray-800">バックアップ・リストア</h2>

      {/* バックアップ */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="font-bold text-gray-700">バックアップ</h3>
        <p className="text-sm text-gray-500">
          現在のデータベースをダンプファイル（.dump）としてダウンロードします。
        </p>
        <button
          onClick={handleBackup}
          disabled={backupLoading}
          className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {backupLoading ? "作成中..." : "バックアップをダウンロード"}
        </button>
        {backupMsg && (
          <p className={`text-sm ${backupMsg.startsWith("エラー") ? "text-red-600" : "text-green-600"}`}>
            {backupMsg}
          </p>
        )}
      </div>

      {/* リストア */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="font-bold text-gray-700">リストア</h3>
        <p className="text-sm text-gray-500">
          バックアップファイル（.dump）を選択してデータを復元します。<br />
          <span className="text-red-500 font-medium">※ 現在のデータはすべて上書きされます。</span>
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".dump"
            onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-1 file:rounded file:border file:border-gray-300 file:text-sm file:bg-gray-50 file:hover:bg-gray-100"
          />
          <button
            onClick={() => { if (restoreFile) setConfirmOpen(true); }}
            disabled={!restoreFile || restoreLoading}
            className="px-5 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
          >
            {restoreLoading ? `復元中... (${elapsedSec}秒経過)` : "リストア実行"}
          </button>
        </div>
        {restoreFile && <p className="text-xs text-gray-500">選択ファイル: {restoreFile.name}</p>}
        {restoreMsg && (
          <p className={`text-sm whitespace-pre-wrap ${restoreMsg.startsWith("エラー") ? "text-red-600" : "text-green-600"}`}>
            {restoreMsg}
          </p>
        )}
      </div>

      {/* 確認ダイアログ */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
            <h4 className="font-bold text-gray-800">リストアの確認</h4>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-red-600">{restoreFile?.name}</span> を使ってリストアします。<br />
              現在のデータはすべて上書きされます。よろしいですか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleRestore}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
