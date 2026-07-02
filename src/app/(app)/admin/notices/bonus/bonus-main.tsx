"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  type Column,
} from "@tanstack/react-table";
import { upsertBonusNoticeDocument } from "@/server/notice";
import { toWareki, calcAgeAt, fmtAmount } from "@/lib/wareki";
import type { BonusNoticeEmployee } from "@/server/notice";

// ---------- 型 ----------
type EmpRow = BonusNoticeEmployee & { _age: number | null };

// ---------- フィルター ----------
const NONE_SELECTED = "__none__";

const multiSelectFilter: FilterFn<EmpRow> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  if (filterValue[0] === NONE_SELECTED) return false;
  return filterValue.includes(String(row.getValue(columnId) ?? ""));
};
multiSelectFilter.autoRemove = (val: string[]) => !val || val.length === 0;

function FacetedFilter({ column, title }: { column: Column<EmpRow, unknown>; title: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const uniqueValues = useMemo(
    () => Array.from(column.getFacetedUniqueValues().keys()).filter((v) => v !== "").sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [column.getFacetedUniqueValues()]
  );
  const filtered = useMemo(
    () => uniqueValues.filter((v) => String(v).toLowerCase().includes(search.toLowerCase())),
    [uniqueValues, search]
  );

  const filterValue = (column.getFilterValue() as string[]) ?? [];
  const isAllSelected = filterValue.length === 0;
  const isNoneSelected = filterValue.length === 1 && filterValue[0] === NONE_SELECTED;
  const isFiltered = !isAllSelected;
  const sortDir = column.getIsSorted();

  function isChecked(val: string) {
    if (isAllSelected) return true;
    if (isNoneSelected) return false;
    return filterValue.includes(val);
  }
  function toggleAll() { column.setFilterValue(isAllSelected ? [NONE_SELECTED] : []); setSearch(""); }
  function toggleValue(val: string) {
    const current = isAllSelected ? uniqueValues.map(String) : isNoneSelected ? [] : filterValue;
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    if (next.length === 0) column.setFilterValue([NONE_SELECTED]);
    else if (next.length === uniqueValues.length) column.setFilterValue([]);
    else column.setFilterValue(next);
  }

  return (
    <div ref={ref} className="relative inline-block w-full">
      <div className={`flex items-center gap-0.5 text-xs font-medium px-1 py-0.5 rounded w-full ${isFiltered ? "text-blue-700 bg-blue-50" : "text-gray-600"}`}>
        <button
          onClick={() => column.toggleSorting(sortDir === "asc")}
          className="flex items-center gap-1 hover:text-blue-700 flex-1 min-w-0"
        >
          <span className="truncate">{title}</span>
          <span className="text-gray-400 shrink-0">{sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "⇅"}</span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 px-0.5 hover:text-blue-600 ${isFiltered ? "text-blue-600" : "text-gray-400"}`}
          title="絞り込み"
        >
          ☰
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-44 max-w-56 p-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索..."
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs border-b border-gray-100 mb-1 pb-2">
              <input type="checkbox" checked={isAllSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-blue-600" />
              <span className="font-medium text-gray-700">（すべて選択）</span>
            </label>
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-1.5 py-1">該当なし</p>}
            {filtered.map((val) => (
              <label key={String(val)} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={isChecked(String(val))}
                  onChange={() => toggleValue(String(val))}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-gray-700 truncate">{String(val) || "（空白）"}</span>
              </label>
            ))}
          </div>
          {isFiltered && (
            <button onClick={toggleAll} className="mt-2 w-full text-xs text-blue-600 hover:underline text-left px-1.5">
              フィルターをクリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- ソートのみヘッダー ----------
function SortOnlyHeader({ column, title }: { column: Column<EmpRow, unknown>; title: string }) {
  const sortDir = column.getIsSorted();
  return (
    <button
      onClick={() => column.toggleSorting(sortDir === "asc")}
      className="flex items-center gap-1 hover:text-blue-700 text-xs font-medium text-gray-600 w-full px-1 py-0.5"
    >
      <span className="truncate">{title}</span>
      <span className="text-gray-400 shrink-0">{sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "⇅"}</span>
    </button>
  );
}

// ---------- 列定義 ----------
const FILTER_COLS = new Set(["employee_number", "name"]);

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
    router.push(`/notices/print-bonus?fiscal_year=${activeYear}&season=${encodeURIComponent(bonusSeason)}`);
  }

  const wareki = activeDate ? toWareki(activeDate) : "";

  return (
    <div>
      {/* 年タブ */}
      <div className="flex border-b mb-5">
        {years.map((y) => (
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
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const col = header.column;
                  const isFilter = FILTER_COLS.has(col.id);
                  return (
                    <th
                      key={header.id}
                      className="px-2 py-1.5 border-b text-left font-medium whitespace-nowrap"
                    >
                      {isFilter ? (
                        <FacetedFilter column={col} title={col.columnDef.header as string} />
                      ) : (
                        <SortOnlyHeader column={col} title={col.columnDef.header as string} />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
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
                  const commentPreview = activeComment
                    ? activeComment.slice(0, 20) + (activeComment.length > 20 ? "…" : "")
                    : "（未設定）";
                  return (
                    <tr key={emp.id} className="border-b last:border-b-0 hover:bg-gray-50">
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
            <button
              onClick={handlePrint}
              className="w-full py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
            >
              {activeYear}年度{bonusSeason}賞与 印刷プレビュー →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
