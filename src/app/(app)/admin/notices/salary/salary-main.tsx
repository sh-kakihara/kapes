"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertNoticeDocument } from "@/server/notice";
import { toWareki, getSalaryNoticeText, fmtAmount, calcAgeAt } from "@/lib/wareki";

type Employee = {
  id: string;
  name: string;
  employee_type: string;
  birth_date: string | null;
  gender: string | null;
  employment_type: string | null;
  salary_increase: number | null;
};

type Props = {
  years: number[];
  activeYear: number;
  representative: string;
  noticeDate: string;
  comment: string;
  employees: Employee[];
};

export default function SalaryMain({ years, activeYear, representative, noticeDate, comment, employees }: Props) {
  const router = useRouter();

  const [rep, setRep] = useState(representative);
  const [notice_date, setNoticeDate] = useState(noticeDate);
  const [commentText, setCommentText] = useState(comment);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const wareki = notice_date ? toWareki(notice_date) : "";

  async function handleSave() {
    setSaving(true); setSaveMsg("");
    try {
      await upsertNoticeDocument({
        fiscal_year: activeYear,
        notice_date,
        comment: commentText,
        representative_name: rep,
      });
      setSaveMsg("保存しました");
    } catch { setSaveMsg("保存に失敗しました"); }
    finally { setSaving(false); }
  }

  function handlePrint() {
    router.push(`/notices/print?fiscal_year=${activeYear}`);
  }

  return (
    <div>
      {/* 年タブ */}
      <div className="flex border-b mb-5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => router.push(`/admin/notices/salary?year=${y}`)}
            className={`px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              y === activeYear
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {y}年度
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        {/* 左: 一覧 */}
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-3 py-2 text-left font-medium border-b">氏名</th>
                <th className="px-3 py-2 text-center font-medium border-b w-14">年齢</th>
                <th className="px-3 py-2 text-center font-medium border-b w-14">性別</th>
                <th className="px-3 py-2 text-left font-medium border-b w-24">雇用形態</th>
                <th className="px-3 py-2 text-left font-medium border-b">昇給判定文言</th>
                <th className="px-3 py-2 text-right font-medium border-b w-24">昇給額</th>
                <th className="px-3 py-2 text-left font-medium border-b">社長コメント（冒頭）</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    {activeYear}年度の社員台帳データがありません
                  </td>
                </tr>
              ) : employees.map((emp) => {
                const noticeText = getSalaryNoticeText(
                  emp.birth_date ? new Date(emp.birth_date) : null,
                  emp.gender,
                  emp.salary_increase,
                  notice_date || new Date().toISOString().slice(0, 10),
                  wareki,
                );
                const age = emp.birth_date && notice_date
                  ? calcAgeAt(new Date(emp.birth_date), new Date(notice_date))
                  : null;
                const amount = emp.salary_increase ?? 0;
                const commentPreview = commentText
                  ? commentText.slice(0, 20) + (commentText.length > 20 ? "…" : "")
                  : "（未設定）";

                return (
                  <tr key={emp.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{emp.name}</td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {age !== null ? `${age}歳` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{emp.gender ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.employment_type ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-pre-line text-xs leading-relaxed">
                      {noticeText}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {amount > 0 ? fmtAmount(amount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">{commentPreview}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 px-3 py-2 border-t">
            対象: 柿原工業・柿原技研の社員（実習生除く）　{employees.length}名
          </p>
        </div>

        {/* 右: 設定フォーム */}
        <div className="bg-white rounded-lg border p-5 self-start space-y-4">
          <h3 className="font-bold text-gray-800">{activeYear}年度 設定</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">代表取締役名</label>
            <input
              type="text"
              value={rep}
              onChange={(e) => setRep(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="例: 代表取締役　柿原邦博"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">昇給開始日</label>
            <input
              type="date"
              value={notice_date}
              onChange={(e) => setNoticeDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
            />
            {wareki && <p className="text-xs text-gray-400 mt-1">{wareki}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">社長コメント（通知書本文）</label>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={10}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            />
          </div>

          {saveMsg && <p className="text-xs text-green-600">{saveMsg}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? "保存中..." : "設定を保存"}
            </button>
            <button
              onClick={handlePrint}
              className="w-full py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
            >
              印刷プレビュー →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
