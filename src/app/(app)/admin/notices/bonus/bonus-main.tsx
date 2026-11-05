"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table";
import { upsertBonusNoticeDocument } from "@/server/notice";
import { toWareki, calcAgeAt, fmtAmount } from "@/lib/wareki";
import type { BonusNoticeEmployee } from "@/server/notice";
import { FacetedFilter, NONE_SELECTED } from "@/components/faceted-filter";

// ---------- 型 ----------
type EmpRow = BonusNoticeEmployee & { _age: number | null };

const multiSelectFilter: FilterFn<EmpRow> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  if (filterValue[0] === NONE_SELECTED) return false;
  return filterValue.includes(String(row.getValue(columnId) ?? ""));
};
multiSelectFilter.autoRemove = (val: string[]) => !val || val.length === 0;

// ---------- 列定義 ----------
function makeColumns(): ColumnDef<EmpRow>[] {
  function f(id: string, label: string, accessorFn: (r: EmpRow) => string): ColumnDef<EmpRow> {
    return { id, accessorFn, header: label, filterFn: multiSelectFilter };
  }
  function n(id: string, label: string, accessorFn: (r: EmpRow) => string): ColumnDef<EmpRow> {
    return { id, accessorFn, header: label };
  }
  return [
    f("employee_number",  "社員番号",           (r) => r.employee_number),
    f("name",             "氏名",               (r) => r.name),
    n("payment",          "支給額",             (r) => r.payment != null ? fmtAmount(r.payment) : ""),
    n("bonus_add",        "精勤手当",           (r) => fmtAmount(r.bonus_add)),
    n("inflation_amount", "インフレ手当",       (r) => r.inflation_enabled ? fmtAmount(r.inflation_amount) : "－"),
    n("paid_leave_days",  "有給日数",           (r) => r.paid_leave_days != null ? `${r.paid_leave_days}日` : "—"),
    n("absent_days",      "欠勤日数",           (r) => r.absent_days != null ? `${r.absent_days}日` : "—"),
    n("late_early_hours", "遅早時間",           (r) => r.late_early_hours != null ? `${r.late_early_hours}時間` : "—"),
    n("comment",          "社長コメント（冒頭）", () => ""),
  ];
}

const COLUMNS = makeColumns();

// ---------- Props ----------
type Props = {
  years: number[];
  activeYear: number;
  bonusSummerDate: string;
  bonusSummerRep: string;
  bonusSummerComment: string;
  bonusWinterDate: string;
  bonusWinterRep: string;
  bonusWinterComment: string;
  summerEmployees: BonusNoticeEmployee[];
  winterEmployees: BonusNoticeEmployee[];
};

export default function BonusMain({
  years,
  activeYear,
  bonusSummerDate,
  bonusSummerRep,
  bonusSummerComment,
  bonusWinterDate,
  bonusWinterRep,
  bonusWinterComment,
  summerEmployees,
  winterEmployees,
}: Props) {
  const router = useRouter();

  const [yearList, setYearList] = useState(years);
  const [bonusSeason, setBonusSeason] = useState<"夏期" | "冬期">("夏期");
  const [summerDate, setSummerDate] = useState(bonusSummerDate);
  const [summerRep, setSummerRep] = useState(bonusSummerRep);
  const [summerComment, setSummerComment] = useState(bonusSummerComment);
  const [winterDate, setWinterDate] = useState(bonusWinterDate);
  const [winterRep, setWinterRep] = useState(bonusWinterRep);
  const [winterComment, setWinterComment] = useState(bonusWinterComment);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const isSummer = bonusSeason === "夏期";
  const activeDate = isSummer ? summerDate : winterDate;
  const activeRep = isSummer ? summerRep : winterRep;
  const activeComment = isSummer ? summerComment : winterComment;
  const setActiveDate = isSummer ? setSummerDate : setWinterDate;
  const setActiveRep = isSummer ? setSummerRep : setWinterRep;
  const setActiveComment = isSummer ? setSummerComment : setWinterComment;

  const rawEmployees = isSummer ? summerEmployees : winterEmployees;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(rawEmployees.map((e) => e.id)));

  // シーズン・年度切替時に全員選択にリセット
  useEffect(() => {
    setSelectedIds(new Set(rawEmployees.map((e) => e.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonusSeason, activeYear]);

  const employees: EmpRow[] = useMemo(
    () =>
      rawEmployees.map((emp) => ({
        ...emp,
        _age:
          emp.birth_date && activeDate
            ? calcAgeAt(new Date(emp.birth_date), new Date(activeDate))
            : null,
      })),
    [rawEmployees, activeDate]
  );

  const table = useReactTable({
    data: employees,
    columns: COLUMNS,
    filterFns: { multiSelectFilter },
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const hasFilter = columnFilters.length > 0;
  const totalRows = employees.length;
  const visibleRows = table.getRowModel().rows.length;

  function resetAll() { setColumnFilters([]); setSorting([]); }

  async function handleSave() {
    setSaving(true); setSaveMsg("");
    try {
      await upsertBonusNoticeDocument({
        fiscal_year: activeYear,
        season: bonusSeason,
        notice_date: activeDate,
        representative_name: activeRep,
        comment: activeComment,
      });
      setSaveMsg("保存しました");
    } catch { setSaveMsg("保存に失敗しました"); }
    finally { setSaving(false); }
  }

  function handlePrint() {
    const ids = [...selectedIds].join(",");
    router.push(`/notices/print-bonus?fiscal_year=${activeYear}&season=${encodeURIComponent(bonusSeason)}&ids=${encodeURIComponent(ids)}`);
  }

  const allVisibleIds = table.getRowModel().rows.map((r) => r.original.id);
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const wareki = activeDate ? toWareki(activeDate) : "";

  return (
    <div>
      {/* 年タブ */}
      <div className="flex border-b mb-5 items-end">
        {yearList.map((y) => (
          <button
            key={y}
            onClick={() => { router.push(`/admin/notices/bonus?year=${y}`); setSaveMsg(""); resetAll(); }}
            className={`px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              y === activeYear
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {y}年度
          </button>
        ))}
        <button
          onClick={() => {
            const next = Math.max(...yearList) + 1;
            setYearList((prev) => [...prev, next]);
            router.push(`/admin/notices/bonus?year=${next}`);
          }}
          className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded ml-2 mb-0.5"
          title="年度を追加"
        >
          ＋
        </button>
      </div>

      {/* 夏期/冬期 切替 */}
      <div className="flex gap-2 mb-5">
        {(["夏期", "冬期"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setBonusSeason(s); setSaveMsg(""); resetAll(); }}
            className={`px-6 py-2 text-sm rounded border transition-colors ${
              bonusSeason === s
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        {/* 左: 一覧 */}
        <div className="bg-white rounded-lg border overflow-x-auto">
          {hasFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-blue-50 text-xs text-blue-700">
              <span>フィルター適用中: {visibleRows}/{totalRows}名</span>
              <button
                onClick={() => setColumnFilters([])}
                className="ml-auto px-2 py-0.5 rounded border border-blue-300 hover:bg-blue-100"
              >
                すべてクリア
              </button>
            </div>
          )}

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs">
                <th className="px-2 py-1.5 border-b text-center w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                    title="表示中を全選択/全解除"
                  />
                </th>
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const col = header.column;
                  return (
                    <th
                      key={header.id}
                      className="px-2 py-1.5 border-b text-left font-medium whitespace-nowrap"
                    >
                      <FacetedFilter column={col} title={col.columnDef.header as string} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="px-3 text-center text-gray-400"
                    style={{ height: "320px", verticalAlign: "middle" }}
                  >
                    {hasFilter
                      ? "条件に一致するデータがありません"
                      : `${activeYear}年度${bonusSeason}の支給データがありません`}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const emp = row.original;
                  const isSelected = selectedIds.has(emp.id);
                  const commentPreview = activeComment
                    ? activeComment.slice(0, 20) + (activeComment.length > 20 ? "…" : "")
                    : "（未設定）";
                  return (
                    <tr key={emp.id} className={`border-b last:border-b-0 hover:bg-gray-50 ${!isSelected ? "opacity-40" : ""}`}>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(emp.id)}
                          className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-xs whitespace-nowrap">{emp.employee_number}</td>
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{emp.name}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium whitespace-nowrap">
                        {emp.payment != null ? fmtAmount(emp.payment) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                        {fmtAmount(emp.bonus_add)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                        {emp.inflation_enabled
                          ? fmtAmount(emp.inflation_amount)
                          : <span className="text-gray-400">－</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                        {emp.paid_leave_days != null ? `${emp.paid_leave_days}日` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                        {emp.absent_days != null ? `${emp.absent_days}日` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                        {emp.late_early_hours != null ? `${emp.late_early_hours}時間` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{commentPreview}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <p className="text-xs text-gray-400 px-3 py-2 border-t">
            {activeYear}年度{bonusSeason} — {hasFilter ? `${visibleRows}/` : ""}{totalRows}名
          </p>
        </div>

        {/* 右: 設定フォーム */}
        <div className="bg-white rounded-lg border p-5 self-start space-y-4">
          <h3 className="font-bold text-gray-800">{activeYear}年度{bonusSeason} 設定</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">代表取締役名</label>
            <input
              type="text"
              value={activeRep}
              onChange={(e) => setActiveRep(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="例: 代表取締役　柿原邦博"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">支給日</label>
            <input
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
            />
            {wareki && <p className="text-xs text-gray-400 mt-1">{wareki}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">社長コメント（通知書本文）</label>
            <textarea
              value={activeComment}
              onChange={(e) => setActiveComment(e.target.value)}
              rows={8}
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
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex-1 py-2 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
              >
                全解除
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">{selectedIds.size}/{employees.length}名 選択中</p>
            <button
              onClick={handlePrint}
              disabled={selectedIds.size === 0}
              className="w-full py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              選択中 {selectedIds.size}名 印刷プレビュー →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
