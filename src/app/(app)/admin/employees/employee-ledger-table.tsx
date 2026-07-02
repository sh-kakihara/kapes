"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getFacetedRowModel, getFacetedUniqueValues,
  flexRender, type ColumnDef, type SortingState, type ColumnFiltersState,
  type FilterFn, type Column,
} from "@tanstack/react-table";
import { upsertEmployeeRecord, importEmployeeRecordsCsv, createFiscalYearRecords, type EmployeeRecordData } from "@/server/employee-record";
import { downloadCsv, parseCsvFile } from "@/lib/csv-utils";

// col[0]=社員番号 col[1..6]=基本情報 col[7]=対象年度 col[8..17]=給与・評価
function makeLedgerCsvHeaders(_fy: number): string[] {
  return [
    "社員番号",
    "雇用形態", "入社年月日", "生年月日", "性別", "最終学歴", "実習生期",
    "対象年度",
    "前年度年収", "基本給", "役職手当", "昇給額",
    "夏期賞与", "夏部長評価", "夏社長評価",
    "冬期賞与", "冬部長評価", "冬社長評価", "備考",
  ];
}

const PRESIDENT_EVAL_OPTIONS = ["A+", "A", "B+", "B", "C"];
const NONE_SELECTED = "__none__";

// ---------- types ----------
type User = {
  id: string;
  employee_number: string | null;
  name: string;
  role: string;
  employee_type: string | null;
  department: { name: string } | null;
  section: { name: string } | null;
};
type EmpRecord = {
  id?: string;
  hire_date?: Date | string | null;
  birth_date?: Date | string | null;
  [key: string]: unknown;
};
type Row = { user: User; record: EmpRecord | null };

// ---------- helpers ----------
function fmt(n: number | null | undefined) {
  return n == null ? "" : n.toLocaleString();
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function calcAge(birth: Date | string | null | undefined, ref: Date) {
  if (!birth) return "";
  const b = typeof birth === "string" ? new Date(birth) : birth;
  let age = ref.getFullYear() - b.getFullYear();
  if (ref.getMonth() < b.getMonth() || (ref.getMonth() === b.getMonth() && ref.getDate() < b.getDate())) age--;
  return String(age);
}
function calcYears(hire: Date | string | null | undefined, ref: Date) {
  if (!hire) return "";
  const h = typeof hire === "string" ? new Date(hire) : hire;
  let y = ref.getFullYear() - h.getFullYear();
  if (ref.getMonth() < h.getMonth() || (ref.getMonth() === h.getMonth() && ref.getDate() < h.getDate())) y--;
  return y >= 0 ? `${y}年` : "";
}
function rec(row: Row, key: string) {
  return ((row.record ?? {}) as Record<string, unknown>)[key];
}

// ---------- FacetedFilter ----------
const multiSelectFilter: FilterFn<Row> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  if (filterValue[0] === NONE_SELECTED) return false;
  return filterValue.includes(String(row.getValue(columnId) ?? ""));
};
multiSelectFilter.autoRemove = (val: string[]) => !val || val.length === 0;

function FacetedFilter({ column, title }: { column: Column<Row, unknown>; title: string }) {
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
        <button onClick={() => column.toggleSorting(sortDir === "asc")} className="flex items-center gap-1 hover:text-blue-700 flex-1 min-w-0">
          <span className="truncate">{title}</span>
          <span className="text-gray-400 shrink-0">{sortDir === "asc" ? "▲" : sortDir === "desc" ? "▼" : "⇅"}</span>
        </button>
        <button onClick={() => setOpen((v) => !v)} className={`shrink-0 px-0.5 hover:text-blue-600 ${isFiltered ? "text-blue-600" : "text-gray-400"}`} title="絞り込み">☰</button>
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-44 max-w-56 p-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="検索..."
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-blue-400" autoFocus />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs border-b border-gray-100 mb-1 pb-2">
              <input type="checkbox" checked={isAllSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-blue-600" />
              <span className="font-medium text-gray-700">（すべて選択）</span>
            </label>
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-1.5 py-1">該当なし</p>}
            {filtered.map((val) => (
              <label key={String(val)} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
                <input type="checkbox" checked={isChecked(String(val))} onChange={() => toggleValue(String(val))} className="w-3.5 h-3.5 accent-blue-600" />
                <span className="text-gray-700 truncate">{String(val) || "（空白）"}</span>
              </label>
            ))}
          </div>
          {isFiltered && (
            <button onClick={toggleAll} className="mt-2 w-full text-xs text-blue-600 hover:underline text-left px-1.5">フィルターをクリア</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- column meta type ----------
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    stickyLeft?: number;
    noFilter?: boolean;
    group?: string;
  }
}

// ---------- EditModal ----------
const MONEY_KEYS = new Set([
  "prev_annual_income",
  "curr_base_salary","curr_position_allowance","curr_salary_increase",
  "curr_summer_bonus","curr_winter_bonus",
]);
const PRESIDENT_EVAL_KEYS = new Set([
  "curr_summer_president_eval","curr_winter_president_eval",
]);
const DIRECTOR_EVAL_KEYS = new Set([
  "curr_summer_director_eval","curr_winter_director_eval",
]);
const DATE_KEYS = new Set(["hire_date","birth_date"]);
const NOTES_KEYS = new Set(["prev_notes","curr_notes"]);

function toFormData(record: EmpRecord | null): EmployeeRecordData {
  if (!record) return {};
  const r = record as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(r)) {
    if (key === "id") continue;
    if (DATE_KEYS.has(key)) {
      const v = r[key];
      result[key] = v ? new Date(v as string).toISOString().slice(0, 10) : null;
    } else {
      result[key] = r[key] ?? null;
    }
  }
  return result as EmployeeRecordData;
}

function makeEditFields(fy: number) {
  return [
    {
      section: "個人情報",
      fields: [
        { key: "job_title",        label: "役職",       span: 1 },
        { key: "employment_type",  label: "雇用形態",   span: 1 },
        { key: "hire_date",        label: "入社年月日", span: 1 },
        { key: "birth_date",       label: "生年月日",   span: 1 },
        { key: "gender",           label: "性別",       span: 1 },
        { key: "education",        label: "最終学歴",   span: 1 },
        { key: "training_period",  label: "実習生期",   span: 1 },
      ],
    },
    {
      section: `${fy}年度`,
      fields: [
        { key: "prev_annual_income",         label: "前年度年収",     span: 1 },
        { key: "curr_base_salary",           label: "基本給",         span: 1 },
        { key: "curr_position_allowance",    label: "役職手当",       span: 1 },
        { key: "curr_salary_increase",       label: "昇給額",         span: 1 },
        { key: "curr_summer_director_eval",  label: "夏期・部長評価", span: 1 },
        { key: "curr_summer_president_eval", label: "夏期・社長評価", span: 1 },
        { key: "curr_summer_bonus",          label: "夏期賞与額",     span: 1 },
        { key: "__spacer_s__",               label: "",               span: 1 },
        { key: "curr_winter_director_eval",  label: "冬期・部長評価", span: 1 },
        { key: "curr_winter_president_eval", label: "冬期・社長評価", span: 1 },
        { key: "curr_winter_bonus",          label: "冬期賞与額",     span: 1 },
        { key: "__spacer_w__",               label: "",               span: 1 },
        { key: "curr_notes",                 label: "備考",           span: 2 },
      ],
    },
  ];
}

function EditModal({ row, fiscalYear, onClose, onSaved }: { row: Row; fiscalYear: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EmployeeRecordData>(toFormData(row.record));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: string | number | null) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true); setError("");
    const res = await upsertEmployeeRecord(row.user.id, fiscalYear, form);
    setSaving(false);
    if (res.ok) onSaved();
    else setError("保存に失敗しました");
  }

  function renderField(key: string) {
    const value = (form as Record<string, unknown>)[key];
    if (DIRECTOR_EVAL_KEYS.has(key)) {
      return (
        <input type="number" min={0} value={value == null ? "" : String(value)}
          onChange={(e) => setField(key, e.target.value === "" ? null : e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      );
    }
    if (PRESIDENT_EVAL_KEYS.has(key)) {
      return (
        <select value={(value as string) ?? ""} onChange={(e) => setField(key, e.target.value || null)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">—</option>
          {PRESIDENT_EVAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (MONEY_KEYS.has(key)) {
      return (
        <input type="number" value={value == null ? "" : String(value)}
          onChange={(e) => setField(key, e.target.value === "" ? null : Number(e.target.value))}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      );
    }
    if (DATE_KEYS.has(key)) {
      return (
        <input type="date" value={(value as string) ?? ""} onChange={(e) => setField(key, e.target.value || null)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      );
    }
    if (NOTES_KEYS.has(key)) {
      return (
        <textarea value={(value as string) ?? ""} onChange={(e) => setField(key, e.target.value || null)}
          rows={3} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
      );
    }
    return (
      <input type="text" value={(value as string) ?? ""} onChange={(e) => setField(key, e.target.value || null)}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <div>
            <p className="font-bold text-lg text-gray-800">{row.user.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {[row.user.employee_number, row.user.department?.name, row.user.section?.name].filter(Boolean).join("／")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="px-6 py-4 space-y-6">
          {makeEditFields(fiscalYear).map((sec) => (
            <div key={sec.section}>
              <h3 className="text-sm font-bold text-gray-700 mb-3 pb-1 border-b">{sec.section}</h3>
              <div className="grid grid-cols-2 gap-3">
                {sec.fields.map(({ key, label, span }) =>
                  key.startsWith("__spacer") ? (
                    <div key={key} />
                  ) : (
                    <div key={key} className={span === 2 ? "col-span-2" : ""}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      {renderField(key)}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="px-6 text-red-500 text-sm">{error}</p>}
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- column definitions ----------
// グループ境界列のキーセット（右境界線を強調）
const GROUP_LAST_KEYS = new Set(["job_title", "training_period", "curr_notes"]);

function makeColumns(refDate: Date): ColumnDef<Row>[] {
  function faceted(id: string, label: string, accessorFn: (r: Row) => string, opts?: { stickyLeft?: number; noFilter?: boolean }): ColumnDef<Row> {
    return {
      id, accessorFn,
      header: label,
      filterFn: multiSelectFilter,
      meta: { stickyLeft: opts?.stickyLeft, noFilter: opts?.noFilter },
    };
  }
  return [
    // 基本情報（sticky）
    faceted("employee_number", "社員番号", (r) => r.user.employee_number ?? "", { stickyLeft: 0 }),
    faceted("name",            "氏名",     (r) => r.user.name,                  { stickyLeft: 96 }),
    faceted("department",      "部署",     (r) => r.user.department?.name ?? "", { stickyLeft: 176 }),
    faceted("section",         "課",       (r) => r.user.section?.name ?? "",    { stickyLeft: 256 }),
    faceted("job_title",       "役職",     (r) => (rec(r, "job_title") as string) ?? "", { stickyLeft: 336 }),
    // 基本情報（非sticky）
    faceted("employee_type",   "社員種別", (r) => r.user.employee_type ?? ""),
    faceted("employment_type", "雇用形態", (r) => (rec(r, "employment_type") as string) ?? ""),
    faceted("hire_date",       "入社年月日", (r) => fmtDate(rec(r, "hire_date") as string | null)),
    faceted("years",           "勤続年数",  (r) => calcYears(rec(r, "hire_date") as string | null, refDate)),
    faceted("birth_date",      "生年月日",  (r) => fmtDate(rec(r, "birth_date") as string | null)),
    faceted("age",             "年齢",      (r) => calcAge(rec(r, "birth_date") as string | null, refDate)),
    faceted("gender",           "性別",      (r) => (rec(r, "gender") as string) ?? ""),
    faceted("education",        "最終学歴",  (r) => (rec(r, "education") as string) ?? ""),
    faceted("training_period",  "実習生期",  (r) => (rec(r, "training_period") as string) ?? ""),
    // 今年度
    faceted("prev_annual_income",      "前年度年収", (r) => fmt(rec(r, "prev_annual_income") as number)),
    faceted("curr_base_salary",        "基本給",   (r) => fmt(rec(r, "curr_base_salary") as number)),
    faceted("curr_position_allowance", "役職手当", (r) => fmt(rec(r, "curr_position_allowance") as number)),
    faceted("curr_salary_increase",    "昇給額",   (r) => fmt(rec(r, "curr_salary_increase") as number)),
    faceted("curr_summer_director_eval", "夏部長評価", (r) => (rec(r, "curr_summer_director_eval") as string) ?? ""),
    faceted("curr_summer_president_eval","夏社長評価", (r) => (rec(r, "curr_summer_president_eval") as string) ?? ""),
    faceted("curr_summer_bonus",         "夏期賞与額", (r) => fmt(rec(r, "curr_summer_bonus") as number)),
    faceted("curr_summer_bonus_add",     "夏期精勤手当", (r) => { const v = rec(r, "curr_summer_bonus_add"); return v != null ? fmt(v as number) : ""; }),
    faceted("curr_summer_payment",       "夏期支給額", (r) => { const v = rec(r, "curr_summer_payment"); return v != null ? fmt(v as number) : ""; }),
    faceted("curr_winter_director_eval", "冬部長評価", (r) => (rec(r, "curr_winter_director_eval") as string) ?? ""),
    faceted("curr_winter_president_eval","冬社長評価", (r) => (rec(r, "curr_winter_president_eval") as string) ?? ""),
    faceted("curr_winter_bonus",         "冬期賞与額", (r) => fmt(rec(r, "curr_winter_bonus") as number)),
    faceted("curr_winter_bonus_add",     "冬期精勤手当", (r) => { const v = rec(r, "curr_winter_bonus_add"); return v != null ? fmt(v as number) : ""; }),
    faceted("curr_winter_payment",       "冬期支給額", (r) => { const v = rec(r, "curr_winter_payment"); return v != null ? fmt(v as number) : ""; }),
    faceted("curr_notes", "備考", (r) => (rec(r, "curr_notes") as string) ?? ""),
  ];
}

// グループヘッダー定義（列数は COLUMNS に合わせる）
function makeColGroupSpans(fy: number) {
  return [
    { label: "基本情報",     count: 14 },
    { label: `${fy}年度`, count: 14 },
  ];
}

// 列幅マップ（sticky列はpx、それ以外はtailwind）
const COL_WIDTH: Record<string, string> = {
  employee_number: "w-24", name: "w-20", department: "w-20", section: "w-20", job_title: "w-24",
  employee_type: "w-24", employment_type: "w-24",
  hire_date: "w-28", years: "w-20", birth_date: "w-28", age: "w-14", gender: "w-14", education: "w-28", training_period: "w-24",
  prev_annual_income: "w-28", curr_base_salary: "w-24", curr_position_allowance: "w-24", curr_salary_increase: "w-20",
  curr_summer_bonus_add: "w-28", curr_summer_bonus: "w-24", curr_summer_payment: "w-24", curr_summer_director_eval: "w-24", curr_summer_president_eval: "w-24",
  curr_winter_bonus_add: "w-28", curr_winter_bonus: "w-24", curr_winter_payment: "w-24", curr_winter_director_eval: "w-24", curr_winter_president_eval: "w-24",
  curr_notes: "w-36",
};

const LS_REF_DATE_KEY = "ledger_ref_date";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- main component ----------
export default function EmployeeLedgerTable({
  initialRows,
  availableYears,
  selectedYear,
  isAdmin = false,
}: {
  initialRows: Row[];
  availableYears: number[];
  selectedYear: number;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const rows = initialRows;
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { line: number; message: string }[] } | null>(null);
  const [creatingYear, setCreatingYear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fiscalYear = selectedYear;
  const colGroupSpans = useMemo(() => makeColGroupSpans(fiscalYear), [fiscalYear]);

  // 基準日（勤続年数・年齢の計算基準）
  const [refDateStr, setRefDateStr] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LS_REF_DATE_KEY) ?? todayStr();
    }
    return todayStr();
  });
  const refDate = useMemo(() => new Date(refDateStr), [refDateStr]);

  function handleRefDateChange(v: string) {
    setRefDateStr(v);
    localStorage.setItem(LS_REF_DATE_KEY, v);
  }
  function handleRefDateReset() {
    const today = todayStr();
    setRefDateStr(today);
    localStorage.setItem(LS_REF_DATE_KEY, today);
  }

  // 固定スクロールバー用 ref
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const mirrorScrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  // テーブルコンテナの位置を fixed バーに反映
  useEffect(() => {
    const tableEl = tableScrollRef.current;
    const mirror = mirrorScrollRef.current;
    const inner = innerRef.current;
    if (!tableEl || !mirror || !inner) return;

    function syncPosition() {
      const rect = tableEl!.getBoundingClientRect();
      mirror!.style.left = `${rect.left}px`;
      mirror!.style.width = `${rect.width}px`;
      inner!.style.width = `${tableEl!.scrollWidth}px`;
    }
    syncPosition();

    function onTableScroll() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      mirror!.scrollLeft = tableEl!.scrollLeft;
      syncingRef.current = false;
    }
    function onMirrorScroll() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      tableEl!.scrollLeft = mirror!.scrollLeft;
      syncingRef.current = false;
    }

    tableEl.addEventListener("scroll", onTableScroll);
    mirror.addEventListener("scroll", onMirrorScroll);
    window.addEventListener("resize", syncPosition);
    return () => {
      tableEl.removeEventListener("scroll", onTableScroll);
      mirror.removeEventListener("scroll", onMirrorScroll);
      window.removeEventListener("resize", syncPosition);
    };
  }, []);

  const [sorting, setSorting] = useState<SortingState>([{ id: "employee_number", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: "employee_type", value: ["柿原工業", "柿原技研"] },
  ]);

  const columns = useMemo(() => makeColumns(refDate), [refDate]);

  // refDate が変わったときに TanStack Table の行モデルキャッシュを破棄するため
  // data の参照を refDateStr に連動させる
  const tableData = useMemo(() => rows.map(r => ({ ...r })), [rows, refDateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const visibleRows = table.getRowModel().rows;

  async function handleSaved() {
    setEditRow(null);
    router.refresh();
  }

  function handleDownloadTemplate() {
    const headers = makeLedgerCsvHeaders(fiscalYear);
    // 社員番号 + 基本情報6列 + 対象年度 + 給与・評価10列
    // col[7]=対象年度 はデフォルトで fiscalYear を埋める
    const dataRows = rows.map((row) => {
      const cols = Array(headers.length).fill("") as string[];
      cols[0] = row.user.employee_number ?? "";
      cols[7] = String(fiscalYear); // 対象年度
      return cols;
    });
    downloadCsv("社員台帳テンプレート.csv", [headers, ...dataRows]);
  }

  function handleExport() {
    const headers = [
      "社員番号", "氏名", "部署", "課", "役職", "社員種別", "雇用形態",
      "入社年月日", "勤続年数", "生年月日", "年齢", "性別", "最終学歴", "実習生期",
      "対象年度",
      "前年度年収", "基本給", "役職手当", "昇給額",
      "夏期賞与", "夏部長評価", "夏社長評価",
      "冬期賞与", "冬部長評価", "冬社長評価", "備考",
    ];
    const dataRows = visibleRows.map((row) => {
      const r = row.original;
      return [
        r.user.employee_number ?? "",
        r.user.name,
        r.user.department?.name ?? "",
        r.user.section?.name ?? "",
        (rec(r, "job_title") as string) ?? "",
        r.user.employee_type ?? "",
        (rec(r, "employment_type") as string) ?? "",
        fmtDate(rec(r, "hire_date") as string | null),
        calcYears(rec(r, "hire_date") as string | null, refDate),
        fmtDate(rec(r, "birth_date") as string | null),
        calcAge(rec(r, "birth_date") as string | null, refDate),
        (rec(r, "gender") as string) ?? "",
        (rec(r, "education") as string) ?? "",
        (rec(r, "training_period") as string) ?? "",
        String(fiscalYear),
        fmt(rec(r, "prev_annual_income") as number),
        fmt(rec(r, "curr_base_salary") as number),
        fmt(rec(r, "curr_position_allowance") as number),
        fmt(rec(r, "curr_salary_increase") as number),
        fmt(rec(r, "curr_summer_bonus") as number),
        (rec(r, "curr_summer_director_eval") as string) ?? "",
        (rec(r, "curr_summer_president_eval") as string) ?? "",
        fmt(rec(r, "curr_winter_bonus") as number),
        (rec(r, "curr_winter_director_eval") as string) ?? "",
        (rec(r, "curr_winter_president_eval") as string) ?? "",
        (rec(r, "curr_notes") as string) ?? "",
      ];
    });
    downloadCsv(`社員台帳_${fiscalYear}年度.csv`, [headers, ...dataRows]);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const allRows = await parseCsvFile(file);
      if (allRows.length < 2) { setImportResult({ imported: 0, errors: [{ line: 1, message: "データ行がありません" }] }); return; }
      const result = await importEmployeeRecordsCsv(allRows);
      setImportResult(result);
      if (result.imported > 0) router.refresh();
    } catch {
      setImportResult({ imported: 0, errors: [{ line: 0, message: "ファイルの読み込みに失敗しました" }] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* 年度タブ */}
      {availableYears.length > 0 && (
        <div className="flex gap-1 mb-4 border-b border-gray-200 items-end flex-wrap">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => router.push(`?year=${y}`)}
              className={`px-4 py-2 text-sm font-medium rounded-t border-t border-l border-r -mb-px transition-colors ${
                y === fiscalYear
                  ? "bg-white border-gray-200 text-blue-700 border-b-white"
                  : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {y}年度
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={async () => {
                const nextYear = availableYears.length > 0 ? Math.max(...availableYears) + 1 : new Date().getFullYear();
                if (!confirm(`${nextYear}年度のタブを作成しますか？\n在籍中の社員の基本情報を前年度からコピーして新規レコードを作成します。`)) return;
                setCreatingYear(true);
                try {
                  const result = await createFiscalYearRecords(nextYear);
                  alert(`${nextYear}年度を作成しました（${result.created}名作成、${result.skipped}名スキップ）`);
                  router.push(`?year=${nextYear}`);
                  router.refresh();
                } catch {
                  alert("作成に失敗しました");
                } finally {
                  setCreatingYear(false);
                }
              }}
              disabled={creatingYear}
              className="ml-2 mb-px px-3 py-1.5 text-xs font-medium border border-dashed border-blue-400 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              {creatingYear ? "作成中..." : `＋ ${availableYears.length > 0 ? Math.max(...availableYears) + 1 : new Date().getFullYear()}年度を作成`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <span className="font-medium whitespace-nowrap">勤続年数・年齢の基準日</span>
          <input
            type="date"
            value={refDateStr}
            onChange={(e) => handleRefDateChange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {refDateStr !== todayStr() && (
            <button onClick={handleRefDateReset}
              className="text-xs text-blue-600 underline hover:text-blue-800 whitespace-nowrap">
              今日に戻す
            </button>
          )}
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={handleExport}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium">
            CSVエクスポート
          </button>
          <button onClick={handleDownloadTemplate}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium">
            テンプレートDL
          </button>
          <label className={`px-3 py-1.5 text-sm rounded font-medium cursor-pointer ${importing ? "bg-gray-100 text-gray-400" : "bg-teal-600 hover:bg-teal-700 text-white"}`}>
            {importing ? "取込中..." : "CSVインポート"}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      {importResult && (
        <div className={`mb-3 p-3 rounded text-sm ${importResult.errors.length === 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
          <p className="font-medium">{importResult.imported} 件を取り込みました</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-yellow-800">
              {importResult.errors.map((e, i) => <li key={i}>{e.line > 0 ? `${e.line}行目: ` : ""}{e.message}</li>)}
            </ul>
          )}
          <button onClick={() => setImportResult(null)} className="mt-1 text-xs text-gray-500 underline">閉じる</button>
        </div>
      )}

      {/* 固定スクロールバー（画面最下部に fixed 表示） */}
      <div
        ref={mirrorScrollRef}
        className="fixed bottom-0 overflow-x-auto z-50 bg-white border-t border-gray-300 shadow-[0_-2px_6px_rgba(0,0,0,0.08)]"
        style={{ height: 16, left: 0, width: 0 }}
      >
        <div ref={innerRef} style={{ height: 1, width: 0 }} />
      </div>

      {/* fixed バー分の底部スペーサー */}
      <div style={{ paddingBottom: 16 }} />

      <div ref={tableScrollRef} className="overflow-x-auto rounded-lg border bg-white min-h-[400px]">
        <table className="text-xs w-max">
          <thead className="bg-gray-50 border-b">
            {/* グループヘッダー */}
            <tr>
              {colGroupSpans.map((g) => (
                <th key={g.label} colSpan={g.count}
                  className="px-3 py-1 text-center font-bold text-gray-700 border border-gray-200">
                  {g.label}
                </th>
              ))}
              <th className="px-2 py-1 border border-gray-200" />
            </tr>
            {/* 列ヘッダー */}
            <tr>
              {table.getFlatHeaders().map((header) => {
                const meta = header.column.columnDef.meta;
                const isSticky = meta?.stickyLeft !== undefined;
                const id = header.column.id;
                const isGroupLast = GROUP_LAST_KEYS.has(id);
                return (
                  <th
                    key={header.id}
                    className={`py-1 text-left whitespace-nowrap font-medium text-gray-600 border-gray-100
                      ${COL_WIDTH[id] ?? "w-24"}
                      ${isGroupLast ? "border-r-2 border-r-gray-300" : "border-r"}
                      ${isSticky ? "sticky z-20 bg-gray-50 shadow-[1px_0_0_#e5e7eb]" : ""}`}
                    style={isSticky ? { left: meta!.stickyLeft } : undefined}
                  >
                    {meta?.noFilter ? (
                      <span className="flex items-center gap-1 px-1 text-xs font-medium text-gray-600 cursor-pointer hover:text-blue-700"
                        onClick={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-gray-400 text-[10px]">
                          {header.column.getIsSorted() === "asc" ? "▲" : header.column.getIsSorted() === "desc" ? "▼" : ""}
                        </span>
                      </span>
                    ) : (
                      <FacetedFilter column={header.column} title={String(header.column.columnDef.header)} />
                    )}
                  </th>
                );
              })}
              <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-16 border-r">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b group hover:bg-blue-50 transition-colors">
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const isSticky = meta?.stickyLeft !== undefined;
                  const id = cell.column.id;
                  const isGroupLast = GROUP_LAST_KEYS.has(id);
                  return (
                    <td
                      key={cell.id}
                      className={`px-2 py-1.5 whitespace-nowrap text-gray-700
                        ${isGroupLast ? "border-r-2 border-r-gray-300" : "border-r border-gray-200"}
                        ${isSticky ? "sticky z-10 bg-white group-hover:bg-blue-50 shadow-[1px_0_0_#f3f4f6]" : ""}`}
                      style={isSticky ? { left: meta!.stickyLeft } : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center border-r border-gray-200">
                  <button onClick={() => setEditRow(row.original)}
                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium">
                    編集
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-10 text-gray-400">
                  {rows.length === 0 ? "社員が登録されていません" : "絞り込み結果が0件です"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-2">{visibleRows.length} / {rows.length} 件</p>

      {editRow && (
        <EditModal row={editRow} fiscalYear={fiscalYear} onClose={() => setEditRow(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
