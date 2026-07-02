"use client";

import { useState } from "react";
import { upsertEmployeeRecord } from "@/server/employee-record";

const GRADE_OPTIONS = ["A+", "A", "B+", "B", "C"];

type GradeData = {
  curr_summer_president_eval: string | null;
  curr_winter_president_eval: string | null;
};

export default function GradeEditPanel({
  userId,
  fiscalYear,
  initialGrades,
}: {
  userId: string;
  fiscalYear: number;
  initialGrades: GradeData;
}) {
  const [open, setOpen] = useState(false);
  const [grades, setGrades] = useState<GradeData>(initialGrades);
  const [form, setForm] = useState<GradeData>(initialGrades);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof GradeData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value || null }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await upsertEmployeeRecord(userId, fiscalYear, form);
    setSaving(false);
    if (res.ok) {
      setGrades(form);
      setOpen(false);
    } else {
      setError("保存に失敗しました");
    }
  }

  function GradeSelect({ label, fieldKey }: { label: string; fieldKey: keyof GradeData }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <select
          value={form[fieldKey] ?? ""}
          onChange={(e) => setField(fieldKey, e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">—</option>
          {GRADE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }

  const hasGrades = Object.values(grades).some((v) => v != null);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        {hasGrades && (
          <div className="flex gap-2 text-xs flex-wrap">
            {grades.curr_summer_president_eval && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">今年夏: {grades.curr_summer_president_eval}</span>
            )}
            {grades.curr_winter_president_eval && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">今年冬: {grades.curr_winter_president_eval}</span>
            )}
          </div>
        )}
        <button
          onClick={() => { setForm(grades); setOpen(true); }}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
        >
          グレード入力
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <p className="font-bold text-gray-800">評価グレード入力</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <div className="px-6 py-4 space-y-5">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 pb-1 border-b">今年度</p>
                <div className="grid grid-cols-2 gap-3">
                  <GradeSelect label="夏期・社長評価" fieldKey="curr_summer_president_eval" />
                  <GradeSelect label="冬期・社長評価" fieldKey="curr_winter_president_eval" />
                </div>
              </div>
            </div>

            {error && <p className="px-6 text-red-500 text-sm">{error}</p>}

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
