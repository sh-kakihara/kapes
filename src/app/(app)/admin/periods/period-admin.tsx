"use client";

import { useState } from "react";
import { createPeriod, togglePeriod, updatePeriodDates, updatePeriodDeadlines, updatePeriodName, resetPeriodEvaluations } from "@/server/admin";

type Period = {
  id: string; name: string; start_date: Date; end_date: Date;
  self_deadline_from: Date | null; self_deadline: Date | null;
  leader_deadline_from: Date | null; leader_deadline: Date | null;
  manager_deadline_from: Date | null; manager_deadline: Date | null;
  director_deadline_from: Date | null; director_deadline: Date | null;
  is_active: boolean;
};

type DeadlineFields = {
  self_deadline_from: string; self_deadline: string;
  leader_deadline_from: string; leader_deadline: string;
  manager_deadline_from: string; manager_deadline: string;
  director_deadline_from: string; director_deadline: string;
};

function toDateValue(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function fmtDate(d: Date | null): string {
  if (!d) return "なし";
  return new Date(d).toLocaleDateString("ja-JP");
}

export default function PeriodAdmin({ periods, isDev }: { periods: Period[]; isDev?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nameYear: "", nameSeason: "夏期", start_date: "", end_date: "",
    self_deadline_from: "", self_deadline: "",
    leader_deadline_from: "", leader_deadline: "",
    manager_deadline_from: "", manager_deadline: "",
    director_deadline_from: "", director_deadline: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDeadlines, setEditDeadlines] = useState<DeadlineFields>({
    self_deadline_from: "", self_deadline: "",
    leader_deadline_from: "", leader_deadline: "",
    manager_deadline_from: "", manager_deadline: "",
    director_deadline_from: "", director_deadline: "",
  });
  const [editDatesId, setEditDatesId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState({ start_date: "", end_date: "" });
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [editNameYear, setEditNameYear] = useState("");
  const [editNameSeason, setEditNameSeason] = useState("夏期");
  const [message, setMessage] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameYear.match(/^\d{4}$/)) {
      setMessage("年は4桁の数字で入力してください");
      return;
    }
    const name = `${form.nameYear}年度${form.nameSeason}`;
    try {
      await createPeriod({ ...form, name });
      setMessage("作成しました");
      setShowForm(false);
      setForm({ nameYear: "", nameSeason: "夏期", start_date: "", end_date: "", self_deadline_from: "", self_deadline: "", leader_deadline_from: "", leader_deadline: "", manager_deadline_from: "", manager_deadline: "", director_deadline_from: "", director_deadline: "" });
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await togglePeriod(id, !current);
      setMessage(!current ? "有効にしました" : "無効にしました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  async function handleReset(id: string, name: string) {
    if (!window.confirm(`「${name}」の全評価スコアと提出状況をリセットします。\nこの操作は取り消せません。よろしいですか？`)) return;
    try {
      await resetPeriodEvaluations(id);
      setMessage("評価をリセットしました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  async function handleSaveName() {
    if (!editNameId) return;
    if (!editNameYear.match(/^\d{4}$/)) {
      setMessage("年は4桁の数字で入力してください");
      return;
    }
    const name = `${editNameYear}年度${editNameSeason}`;
    try {
      await updatePeriodName(editNameId, name);
      setEditNameId(null);
      setMessage("期間名を更新しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  async function handleSaveDates() {
    if (!editDatesId) return;
    try {
      await updatePeriodDates(editDatesId, editDates.start_date, editDates.end_date);
      setEditDatesId(null);
      setMessage("期間を更新しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  function startEdit(p: Period) {
    setEditId(p.id);
    setEditDeadlines({
      self_deadline_from: toDateValue(p.self_deadline_from),
      self_deadline: toDateValue(p.self_deadline),
      leader_deadline_from: toDateValue(p.leader_deadline_from),
      leader_deadline: toDateValue(p.leader_deadline),
      manager_deadline_from: toDateValue(p.manager_deadline_from),
      manager_deadline: toDateValue(p.manager_deadline),
      director_deadline_from: toDateValue(p.director_deadline_from),
      director_deadline: toDateValue(p.director_deadline),
    });
  }

  async function handleSaveDeadlines() {
    if (!editId) return;
    try {
      await updatePeriodDeadlines(editId, {
        self_deadline_from: editDeadlines.self_deadline_from || null,
        self_deadline: editDeadlines.self_deadline || null,
        leader_deadline_from: editDeadlines.leader_deadline_from || null,
        leader_deadline: editDeadlines.leader_deadline || null,
        manager_deadline_from: editDeadlines.manager_deadline_from || null,
        manager_deadline: editDeadlines.manager_deadline || null,
        director_deadline_from: editDeadlines.director_deadline_from || null,
        director_deadline: editDeadlines.director_deadline || null,
      });
      setEditId(null);
      setMessage("提出期限を更新しました");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  const deadlineRows: { fromKey: keyof DeadlineFields; toKey: keyof DeadlineFields; label: string; color: string }[] = [
    { fromKey: "self_deadline_from", toKey: "self_deadline", label: "自己評価", color: "text-blue-700" },
    { fromKey: "leader_deadline_from", toKey: "leader_deadline", label: "リーダー評価", color: "text-orange-700" },
    { fromKey: "manager_deadline_from", toKey: "manager_deadline", label: "課長評価", color: "text-green-700" },
    { fromKey: "director_deadline_from", toKey: "director_deadline", label: "部長評価", color: "text-purple-700" },
  ];

  return (
    <div>
      {message && <p className="mb-4 text-sm text-green-600">{message}</p>}

      <button onClick={() => setShowForm(true)} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
        + 新規作成
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]">
            <h3 className="font-bold text-lg mb-4">評価期間作成</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">期間名 *</label>
                <div className="flex items-center gap-1">
                  <input
                    value={form.nameYear}
                    onChange={(e) => setForm({ ...form, nameYear: e.target.value })}
                    placeholder="2026"
                    maxLength={4}
                    required
                    className="w-20 border rounded px-3 py-2 text-sm text-center"
                  />
                  <span className="text-sm text-gray-700">年度</span>
                  <select
                    value={form.nameSeason}
                    onChange={(e) => setForm({ ...form, nameSeason: e.target.value })}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="夏期">夏期</option>
                    <option value="冬期">冬期</option>
                  </select>
                </div>
                {form.nameYear.match(/^\d{4}$/) && (
                  <p className="text-xs text-gray-400 mt-1">→ {form.nameYear}年度{form.nameSeason}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">開始日 *</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    required className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">終了日 *</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    required className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-700 mt-2">提出期限（FROM / TO）</p>
              {deadlineRows.map(({ fromKey, toKey, label, color }) => (
                <div key={toKey}>
                  <label className={`block text-xs font-medium mb-1 ${color}`}>{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={form[fromKey]} onChange={(e) => setForm({ ...form, [fromKey]: e.target.value })}
                      placeholder="FROM" className="flex-1 border rounded px-3 py-2 text-sm" />
                    <span className="text-gray-400 text-sm">〜</span>
                    <input type="date" value={form[toKey]} onChange={(e) => setForm({ ...form, [toKey]: e.target.value })}
                      placeholder="TO" className="flex-1 border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700">作成</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded text-sm font-medium hover:bg-gray-50">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {periods.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border p-5">
            {/* 期間名 + 有効/無効 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0 mr-4">
                {editNameId === p.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={editNameYear}
                      onChange={(e) => setEditNameYear(e.target.value)}
                      placeholder="2026"
                      maxLength={4}
                      autoFocus
                      className="w-20 border rounded px-2 py-1 text-sm text-center"
                    />
                    <span className="text-sm text-gray-700">年度</span>
                    <select
                      value={editNameSeason}
                      onChange={(e) => setEditNameSeason(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="夏期">夏期</option>
                      <option value="冬期">冬期</option>
                    </select>
                    <button onClick={handleSaveName} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">保存</button>
                    <button onClick={() => setEditNameId(null)} className="px-3 py-1 border rounded text-xs hover:bg-gray-50">取消</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800">{p.name}</p>
                    <button
                      onClick={() => {
                        const m = p.name.match(/^(\d{4})年度(夏期|冬期)/);
                        setEditNameYear(m ? m[1] : "");
                        setEditNameSeason(m ? m[2] : "夏期");
                        setEditNameId(p.id);
                      }}
                      className="text-xs text-blue-500 hover:underline shrink-0"
                    >名前を変更</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {p.is_active ? "有効" : "無効"}
                </span>
                <button onClick={() => handleToggle(p.id, p.is_active)} className="text-xs text-blue-600 hover:underline">
                  {p.is_active ? "無効にする" : "有効にする"}
                </button>
                {isDev && (
                  <button onClick={() => handleReset(p.id, p.name)} className="text-xs text-red-500 hover:underline">
                    評価リセット
                  </button>
                )}
              </div>
            </div>

            {/* 評価期間 FROM / TO */}
            {editDatesId === p.id ? (
              <div className="border rounded p-4 bg-blue-50 mb-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">評価期間（FROM / TO）を編集</p>
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">FROM（開始日）</label>
                    <input type="date" value={editDates.start_date}
                      onChange={(e) => setEditDates({ ...editDates, start_date: e.target.value })}
                      required className="border rounded px-3 py-1.5 text-sm" />
                  </div>
                  <span className="text-gray-400 mb-1.5">〜</span>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">TO（終了日）</label>
                    <input type="date" value={editDates.end_date}
                      onChange={(e) => setEditDates({ ...editDates, end_date: e.target.value })}
                      required className="border rounded px-3 py-1.5 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSaveDates} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">保存</button>
                  <button onClick={() => setEditDatesId(null)} className="px-4 py-1.5 border rounded text-xs hover:bg-gray-50">取消</button>
                </div>
              </div>
            ) : (
              <div className="border rounded p-3 bg-blue-50 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-blue-700">評価期間（FROM / TO）</p>
                  <button
                    onClick={() => { setEditDates({ start_date: toDateValue(p.start_date), end_date: toDateValue(p.end_date) }); setEditDatesId(p.id); }}
                    className="text-xs text-blue-500 hover:underline"
                  >変更</button>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(p.start_date).toLocaleDateString("ja-JP")} 〜 {new Date(p.end_date).toLocaleDateString("ja-JP")}
                </p>
              </div>
            )}

            {/* 提出期限エリア */}
            {editId === p.id ? (
              <div className="border rounded p-4 bg-gray-50 space-y-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">提出期限を編集（FROM 〜 TO）</p>
                {deadlineRows.map(({ fromKey, toKey, label, color }) => (
                  <div key={toKey}>
                    <label className={`block text-xs font-medium mb-1 ${color}`}>{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={editDeadlines[fromKey]}
                        onChange={(e) => setEditDeadlines({ ...editDeadlines, [fromKey]: e.target.value })}
                        className="border rounded px-2 py-1 text-xs flex-1" />
                      <span className="text-xs text-gray-400">〜</span>
                      <input type="date" value={editDeadlines[toKey]}
                        onChange={(e) => setEditDeadlines({ ...editDeadlines, [toKey]: e.target.value })}
                        className="border rounded px-2 py-1 text-xs flex-1" />
                      {(editDeadlines[fromKey] || editDeadlines[toKey]) && (
                        <button onClick={() => setEditDeadlines({ ...editDeadlines, [fromKey]: "", [toKey]: "" })}
                          className="text-xs text-gray-400 hover:text-red-400">クリア</button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSaveDeadlines} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">保存</button>
                  <button onClick={() => setEditId(null)} className="px-4 py-1.5 border rounded text-xs hover:bg-gray-50">取消</button>
                </div>
              </div>
            ) : (
              <div className="border rounded p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">提出期限（FROM 〜 TO）</p>
                  <button onClick={() => startEdit(p)} className="text-xs text-blue-500 hover:underline">変更</button>
                </div>
                <div className="space-y-1">
                  {deadlineRows.map(({ fromKey, toKey, label, color }) => (
                    <div key={toKey} className="flex items-center gap-2">
                      <span className={`text-xs font-medium w-24 shrink-0 ${color}`}>{label}</span>
                      <span className="text-xs text-gray-600">
                        {fmtDate(p[fromKey])} 〜 {fmtDate(p[toKey])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
