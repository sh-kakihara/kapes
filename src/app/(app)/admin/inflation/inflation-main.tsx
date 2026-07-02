"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  upsertInflationSetting,
  overrideInflationEmployee,
  resetInflationEmployee,
} from "@/server/inflation";
import type { InflationEmployeeRow } from "@/server/inflation";

type Props = {
  years: number[];
  activeYear: number;
  activeSeason: "夏期" | "冬期";
  enabled: boolean;
  noticeDate: string;
  settingId: string | null;
  rows: InflationEmployeeRow[];
};

// ---- 編集ポップアップ ----
function EditModal({
  row,
  settingId,
  onClose,
  onSaved,
}: {
  row: InflationEmployeeRow;
  settingId: string;
  onClose: () => void;
  onSaved: (userId: string, amount: number | null) => void;
}) {
  const [amount, setAmount] = useState(String(row.final_amount));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave() {
    const n = parseInt(amount.replace(/,/g, ""), 10);
    if (isNaN(n) || n < 0) { setMsg("0以上の整数を入力してください"); return; }
    setSaving(true);
    await overrideInflationEmployee(settingId, row.user_id, n);
    onSaved(row.user_id, n);
    onClose();
  }

  async function handleReset() {
    setSaving(true);
    await resetInflationEmployee(settingId, row.user_id);
    onSaved(row.user_id, null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-80 space-y-4">
        <h3 className="font-bold text-gray-800 text-base">インフレ手当 変更</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div>{row.employee_number}　{row.name}</div>
          <div className="text-xs text-gray-400">
            自動計算額: {row.auto_amount.toLocaleString("ja-JP")}円
            {row.override_amount != null && "　（現在: 手動上書き）"}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">金額（円）</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setMsg(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">円</span>
          </div>
          {msg && <p className="text-xs text-red-500 mt-1">{msg}</p>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            保存
          </button>
          {row.override_amount != null && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex-1 py-2 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
            >
              自動に戻す
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-2 border border-gray-300 text-gray-500 text-sm rounded hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- メイン ----
export default function InflationMain({
  years,
  activeYear,
  activeSeason,
  enabled: initialEnabled,
  noticeDate: initialDate,
  settingId: initialSettingId,
  rows: initialRows,
}: Props) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [noticeDate, setNoticeDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [settingId, setSettingId] = useState(initialSettingId);

  // 行データのローカルコピー（上書き額を即時反映するため）
  const [rows, setRows] = useState<InflationEmployeeRow[]>(initialRows);
  const [editRow, setEditRow] = useState<InflationEmployeeRow | null>(null);

  function handleSeasonChange(season: "夏期" | "冬期") {
    router.push(`/admin/inflation?year=${activeYear}&season=${season}`);
  }

  async function handleSave() {
    setSaving(true); setSaveMsg("");
    const res = await upsertInflationSetting({
      fiscal_year: activeYear,
      season: activeSeason,
      enabled,
      notice_date: noticeDate,
    });
    if (res.ok) {
      setSettingId(res.id);
      setSaveMsg("保存しました");
      router.refresh();
    }
    setSaving(false);
  }

  function handleOverrideSaved(userId: string, amount: number | null) {
    setRows((prev) =>
      prev.map((r) =>
        r.user_id === userId
          ? {
              ...r,
              override_amount: amount,
              final_amount: amount ?? r.auto_amount,
            }
          : r
      )
    );
  }

  const totalAmount = enabled
    ? rows.reduce((sum, r) => sum + r.final_amount, 0)
    : 0;

  return (
    <div>
      {/* 年タブ */}
      <div className="flex border-b mb-5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => router.push(`/admin/inflation?year=${y}&season=${activeSeason}`)}
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

      {/* 夏期/冬期 切替 */}
      <div className="flex gap-2 mb-5">
        {(["夏期", "冬期"] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleSeasonChange(s)}
            className={`px-6 py-2 text-sm rounded border transition-colors ${
              activeSeason === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px] items-start">
        {/* 左: 社員一覧 */}
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-3 py-2 text-left font-medium border-b w-20">社員番号</th>
                <th className="px-3 py-2 text-left font-medium border-b w-28">氏名</th>
                <th className="px-3 py-2 text-left font-medium border-b w-24">部</th>
                <th className="px-3 py-2 text-left font-medium border-b w-24">課</th>
                <th className="px-3 py-2 text-center font-medium border-b w-16">勤務年数</th>
                <th className="px-3 py-2 text-center font-medium border-b w-14">年齢</th>
                <th className="px-3 py-2 text-right font-medium border-b w-28">インフレ手当額</th>
                <th className="px-3 py-2 text-center font-medium border-b w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    社員データがありません
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr
                  key={row.user_id}
                  className={`border-b last:border-b-0 hover:bg-gray-50 ${!enabled ? "opacity-40" : ""}`}
                >
                  <td className="px-3 py-2 text-gray-500 font-mono text-xs">{row.employee_number}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-[7rem] truncate">{row.name}</td>
                  <td className="px-3 py-2 text-gray-600">{row.department ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{row.section ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {row.years_employed != null ? `${row.years_employed}年` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {row.age != null ? `${row.age}歳` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={row.override_amount != null ? "text-amber-700 font-medium" : "text-gray-700"}>
                      {row.final_amount.toLocaleString("ja-JP")}円
                    </span>
                    {row.override_amount != null && (
                      <span className="text-xs text-amber-500 ml-1">手動</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={async () => {
                        if (!settingId) {
                          // 設定未保存なら先に保存してからポップアップを開く
                          const res = await upsertInflationSetting({
                            fiscal_year: activeYear,
                            season: activeSeason,
                            enabled,
                            notice_date: noticeDate,
                          });
                          if (res.ok) { setSettingId(res.id); setSaveMsg("保存しました"); }
                        }
                        setEditRow(row);
                      }}
                      disabled={!enabled}
                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      変更
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-gray-500">
            <span>{rows.length}名</span>
            {enabled && (
              <span className="font-medium text-gray-700">
                合計: {totalAmount.toLocaleString("ja-JP")}円
              </span>
            )}
          </div>
        </div>

        {/* 右: 設定パネル */}
        <div className="bg-white rounded-lg border p-5 space-y-4">
          <h3 className="font-bold text-gray-800">{activeYear}年度{activeSeason} 設定</h3>

          {/* 出す/出さない トグル */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">インフレ手当</label>
            <div className="flex gap-2">
              <button
                onClick={() => setEnabled(true)}
                className={`flex-1 py-2 text-sm rounded border transition-colors ${
                  enabled
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                支給する
              </button>
              <button
                onClick={() => setEnabled(false)}
                className={`flex-1 py-2 text-sm rounded border transition-colors ${
                  !enabled
                    ? "bg-red-500 text-white border-red-500"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                支給しない
              </button>
            </div>
          </div>

          {/* 支給日 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              支給日（年齢・在籍期間の計算基準日）
            </label>
            <input
              type="date"
              value={noticeDate}
              onChange={(e) => setNoticeDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {!noticeDate && (
              <p className="text-xs text-amber-500 mt-1">
                ⚠ 支給日を設定すると年齢・勤務年数・手当額が正しく計算されます
              </p>
            )}
          </div>

          {saveMsg && <p className="text-xs text-green-600">{saveMsg}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>

          <div className="pt-2 border-t text-xs text-gray-400 space-y-1 leading-relaxed">
            <p className="font-medium text-gray-500">自動計算ルール（支給日基準）</p>
            <p>在籍3ヶ月未満 → 10,000円</p>
            <p>65歳以上 → 10,000円</p>
            <p>60〜64歳 → 20,000円</p>
            <p>実習生 → 20,000円</p>
            <p>月給・日給月給（59歳以下）→ 30,000円</p>
            <p>時給・日給（59歳以下）→ 20,000円</p>
          </div>
        </div>
      </div>

      {/* 編集ポップアップ */}
      {editRow && settingId && (
        <EditModal
          row={editRow}
          settingId={settingId}
          onClose={() => setEditRow(null)}
          onSaved={handleOverrideSaved}
        />
      )}
    </div>
  );
}
