"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { calcBonus, calcPayment } from "@/lib/attendance-calc";
import {
  createAttendancePeriod,
  getAttendanceRecords,
  importAttendanceRecords,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  deleteAllAttendanceRecords,
  type AttendancePeriodRow,
  type AttendanceRecordRow,
  type ImportAttendanceRow,
} from "@/server/attendance";
import { downloadCsv, parseCsvFile } from "@/lib/csv-utils";

const CSV_HEADERS = [
  "社員番号", "氏名", "出勤日数", "有休日数", "欠勤日数",
  "遅早時間", "普通残業時間", "深夜残業時間", "休日出勤時間", "法定休出時間",
];

type EditState = {
  work_days: string;
  paid_leave_days: string;
  absent_days: string;
  late_early_hours: string;
  overtime_hours: string;
  night_overtime_hours: string;
  holiday_hours: string;
  legal_holiday_hours: string;
  bonus_eligible: boolean;
  notes: string;
  _employee_bonus: number | null;
  _employee_position_allowance: number | null;
};

function fmt(n: number | string | null | undefined): string {
  if (n == null || n === "") return "";
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num % 1 === 0 ? String(num) : num.toFixed(2);
}

function parseNum(v: string): number | null {
  const s = v.trim();
  if (s === "" || s === "-") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function previewBonus(edit: EditState): number {
  return calcBonus(
    edit.bonus_eligible,
    parseNum(edit.paid_leave_days),
    parseNum(edit.absent_days),
    parseNum(edit.late_early_hours)
  );
}

function previewBaseAmount(edit: EditState): number {
  const bonus = previewBonus(edit);
  return (edit._employee_bonus ?? 0) + bonus;
}

function previewPayment(edit: EditState): number {
  const base = previewBaseAmount(edit);
  return calcPayment(
    edit.bonus_eligible,
    base || null,
    edit._employee_position_allowance,
    parseNum(edit.absent_days),
    parseNum(edit.late_early_hours)
  ) ?? 0;
}

// ---------- EditModal ----------
const EDIT_FIELDS: { key: keyof EditState; label: string; unit?: string }[] = [
  { key: "work_days",            label: "出勤日数",     unit: "日" },
  { key: "paid_leave_days",      label: "有休日数",     unit: "日" },
  { key: "absent_days",          label: "欠勤日数",     unit: "日" },
  { key: "late_early_hours",     label: "遅早時間",     unit: "時間" },
  { key: "overtime_hours",       label: "普通残業時間", unit: "時間" },
  { key: "night_overtime_hours", label: "深夜残業時間", unit: "時間" },
  { key: "holiday_hours",        label: "休日出勤時間", unit: "時間" },
  { key: "legal_holiday_hours",  label: "法定休出時間", unit: "時間" },
  { key: "notes",                label: "備考" },
];

function EditModal({
  row,
  editState,
  saving,
  onClose,
  onSave,
  onChange,
}: {
  row: AttendanceRecordRow;
  editState: EditState;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: <K extends keyof EditState>(key: K, value: EditState[K]) => void;
}) {
  const liveBonus   = previewBonus(editState);
  const liveBase    = previewBaseAmount(editState);
  const livePayment = previewPayment(editState);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <div>
            <p className="font-bold text-lg text-gray-800">{row.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {[row.employee_number, row.department, row.section].filter(Boolean).join("　／　")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        {/* 入力フィールド */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3">
          {EDIT_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className={key === "notes" ? "col-span-2" : ""}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {key === "notes" ? (
                <input
                  type="text"
                  value={editState.notes}
                  onChange={(e) => onChange("notes", e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editState[key] as string}
                    onChange={(e) => onChange(key, e.target.value as never)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {unit && <span className="text-xs text-gray-500 whitespace-nowrap">{unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 計算結果プレビュー */}
        <div className="mx-6 mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">精勤手当</span>
          <span className="text-right font-medium text-blue-700">{liveBonus.toLocaleString()}円</span>
          <span className="text-gray-500">基本額</span>
          <span className="text-right font-medium text-gray-700">{liveBase.toLocaleString()}円</span>
          <span className="text-gray-500">役職手当</span>
          <span className="text-right font-medium text-gray-700">
            {(editState._employee_position_allowance ?? 0).toLocaleString()}円
          </span>
          <span className="text-gray-500 font-medium">支給額</span>
          <span className="text-right font-bold text-green-700">{livePayment.toLocaleString()}円</span>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button onClick={onSave} disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- main ----------
type Props = { initialPeriods: AttendancePeriodRow[] };

export default function AttendanceMain({ initialPeriods }: Props) {
  const [periods] = useState<AttendancePeriodRow[]>(initialPeriods);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(
    initialPeriods.length > 0 ? initialPeriods[0].id : null
  );
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [loadedPeriodId, setLoadedPeriodId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newSeason, setNewSeason] = useState<"夏期" | "冬期">("夏期");
  const [createError, setCreateError] = useState("");
  const [isPending, startTransition] = useTransition();

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; error: boolean } | null>(null);

  const [editingRow, setEditingRow] = useState<AttendanceRecordRow | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    if (activePeriodId && loadedPeriodId !== activePeriodId) {
      getAttendanceRecords(activePeriodId).then((rows) => {
        setRecords(rows);
        setLoadedPeriodId(activePeriodId);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectTab(id: string) {
    setActivePeriodId(id);
    setEditingRow(null);
    setEditState(null);
    if (loadedPeriodId !== id) {
      const rows = await getAttendanceRecords(id);
      setRecords(rows);
      setLoadedPeriodId(id);
    }
  }

  async function handleCreatePeriod() {
    const name = `${newYear}年度${newSeason}`;
    setCreateError("");
    startTransition(async () => {
      const res = await createAttendancePeriod(name);
      if (!res.ok) { setCreateError(res.error ?? "エラーが発生しました"); return; }
      window.location.reload();
    });
  }

  function startEdit(row: AttendanceRecordRow) {
    setEditState({
      work_days:            fmt(row.work_days),
      paid_leave_days:      fmt(row.paid_leave_days),
      absent_days:          fmt(row.absent_days),
      late_early_hours:     fmt(row.late_early_hours),
      overtime_hours:       fmt(row.overtime_hours),
      night_overtime_hours: fmt(row.night_overtime_hours),
      holiday_hours:        fmt(row.holiday_hours),
      legal_holiday_hours:  fmt(row.legal_holiday_hours),
      bonus_eligible:       row.bonus_eligible,
      notes:                row.notes ?? "",
      _employee_bonus:             row.employee_bonus,
      _employee_position_allowance: row.employee_position_allowance,
    });
    setEditingRow(row);
    setImportMsg(null);
  }

  function handleChange<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEditState((s) => s ? { ...s, [key]: value } : s);
  }

  function cancelEdit() {
    setEditingRow(null);
    setEditState(null);
  }

  async function handleDeleteAll() {
    if (!activePeriodId || !activePeriod) return;
    if (!confirm(`「${activePeriod.name}」のデータを全件削除しますか？\nこの操作は元に戻せません。`)) return;
    setDeletingAll(true);
    try {
      await deleteAllAttendanceRecords(activePeriodId);
      setRecords([]);
    } finally {
      setDeletingAll(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」の行を削除しますか？`)) return;
    setDeletingId(id);
    try {
      await deleteAttendanceRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function saveEdit() {
    if (!editState || !editingRow) return;
    setSaving(true);
    try {
      await updateAttendanceRecord(editingRow.id, {
        work_days:            editState.work_days,
        paid_leave_days:      editState.paid_leave_days,
        absent_days:          editState.absent_days,
        late_early_hours:     editState.late_early_hours,
        overtime_hours:       editState.overtime_hours,
        night_overtime_hours: editState.night_overtime_hours,
        holiday_hours:        editState.holiday_hours,
        legal_holiday_hours:  editState.legal_holiday_hours,
        bonus_eligible:       editState.bonus_eligible,
        notes:                editState.notes,
      });
      if (activePeriodId) {
        const updated = await getAttendanceRecords(activePeriodId);
        setRecords(updated);
        setLoadedPeriodId(activePeriodId);
      }
      setEditingRow(null);
      setEditState(null);
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadTemplate() {
    downloadCsv("精勤手当_支給額_テンプレート.csv", [CSV_HEADERS]);
  }

  function handleDownloadCsv() {
    if (!records.length) return;
    const activeName = periods.find((p) => p.id === activePeriodId)?.name ?? "data";
    const rows: string[][] = [
      [...CSV_HEADERS, "精勤手当", "基本額", "役職手当", "支給額", "備考"],
      ...records.map((r) => {
        const liveBonus = calcBonus(r.bonus_eligible, r.paid_leave_days, r.absent_days, r.late_early_hours);
        const liveBase = (r.employee_bonus ?? 0) + liveBonus;
        const p = calcPayment(r.bonus_eligible, liveBase || null, r.employee_position_allowance, r.absent_days, r.late_early_hours) ?? 0;
        return [
          r.employee_number, r.name,
          fmt(r.work_days), fmt(r.paid_leave_days), fmt(r.absent_days),
          fmt(r.late_early_hours), fmt(r.overtime_hours), fmt(r.night_overtime_hours),
          fmt(r.holiday_hours), fmt(r.legal_holiday_hours),
          String(liveBonus),
          String(liveBase),
          r.employee_position_allowance != null ? String(r.employee_position_allowance) : "",
          String(p),
          r.notes ?? "",
        ];
      }),
    ];
    downloadCsv(`精勤手当_${activeName}.csv`, rows);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePeriodId) return;
    setImportMsg(null);
    setImporting(true);
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.length < 2) { setImportMsg({ text: "データ行がありません", error: true }); return; }
      const header = parsed[0];
      const idx = (label: string) => header.findIndex((h) => h.trim() === label);
      const col = {
        empNo: idx("社員番号"), name: idx("氏名"),
        work: idx("出勤日数"), paid: idx("有休日数"), absent: idx("欠勤日数"),
        late: idx("遅早時間"), ot: idx("普通残業時間"), nightOt: idx("深夜残業時間"),
        holiday: idx("休日出勤時間"), legalHoliday: idx("法定休出時間"),
      };
      if (col.empNo === -1) { setImportMsg({ text: "「社員番号」列が見つかりません", error: true }); return; }
      const dataRows: ImportAttendanceRow[] = parsed.slice(1).map((r) => ({
        employee_number:      r[col.empNo] ?? "",
        name:                 col.name >= 0 ? (r[col.name] ?? "") : "",
        work_days:            col.work >= 0 ? (r[col.work] ?? "") : "",
        paid_leave_days:      col.paid >= 0 ? (r[col.paid] ?? "") : "",
        absent_days:          col.absent >= 0 ? (r[col.absent] ?? "") : "",
        late_early_hours:     col.late >= 0 ? (r[col.late] ?? "") : "",
        overtime_hours:       col.ot >= 0 ? (r[col.ot] ?? "") : "",
        night_overtime_hours: col.nightOt >= 0 ? (r[col.nightOt] ?? "") : "",
        holiday_hours:        col.holiday >= 0 ? (r[col.holiday] ?? "") : "",
        legal_holiday_hours:  col.legalHoliday >= 0 ? (r[col.legalHoliday] ?? "") : "",
      }));
      const result = await importAttendanceRecords(activePeriodId, dataRows);
      setImportMsg({
        text: `${result.imported}件取込完了${result.errors.length > 0 ? `（エラー${result.errors.length}件）` : ""}`,
        error: result.errors.length > 0,
      });
      const newRecords = await getAttendanceRecords(activePeriodId);
      setRecords(newRecords);
      setLoadedPeriodId(activePeriodId);
    } catch (err) {
      setImportMsg({ text: String(err), error: true });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const activePeriod = periods.find((p) => p.id === activePeriodId);
  const displayRecords = activePeriodId === loadedPeriodId ? records : [];

  return (
    <div>
      {/* タブ行 */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6 flex-wrap">
        {periods.map((p) => (
          <button key={p.id} onClick={() => selectTab(p.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activePeriodId === p.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}>
            {p.name}
          </button>
        ))}
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded ml-2">
            ＋ 期間を追加
          </button>
        ) : (
          <div className="flex items-center gap-2 ml-2">
            <select value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i).map((y) => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
            <select value={newSeason} onChange={(e) => setNewSeason(e.target.value as "夏期" | "冬期")} className="border rounded px-2 py-1 text-sm">
              <option value="夏期">夏期</option>
              <option value="冬期">冬期</option>
            </select>
            <button onClick={handleCreatePeriod} disabled={isPending} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">作成</button>
            <button onClick={() => { setShowCreate(false); setCreateError(""); }} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900">キャンセル</button>
            {createError && <span className="text-red-600 text-sm">{createError}</span>}
          </div>
        )}
      </div>

      {!activePeriod && <p className="text-gray-500 text-sm">期間を追加してください。</p>}

      {activePeriod && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-sm font-medium text-gray-700">{activePeriod.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleDownloadTemplate} className="px-3 py-1.5 text-sm border rounded text-gray-700 hover:bg-gray-50">CSVテンプレート</button>
            <label className={`px-3 py-1.5 text-sm border rounded cursor-pointer text-gray-700 hover:bg-gray-50 ${importing ? "opacity-50" : ""}`}>
              {importing ? "取込中..." : "CSV取込"}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} disabled={importing} />
            </label>
            {displayRecords.length > 0 && (
              <button onClick={handleDownloadCsv} className="px-3 py-1.5 text-sm border rounded text-gray-700 hover:bg-gray-50">CSVダウンロード</button>
            )}
            {displayRecords.length > 0 && (
              <button onClick={handleDeleteAll} disabled={deletingAll}
                className="px-3 py-1.5 text-sm border border-red-300 rounded text-red-600 hover:bg-red-50 disabled:opacity-50">
                {deletingAll ? "削除中..." : "全件削除"}
              </button>
            )}
          </div>
        </div>
      )}

      {importMsg && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${importMsg.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {importMsg.text}
        </div>
      )}

      {activePeriod && (
        <>
          {displayRecords.length === 0 ? (
            <p className="text-sm text-gray-500">データがありません。CSVで取り込んでください。</p>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">社員番号</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">氏名</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">出勤日数</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">有休日数</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">欠勤日数</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">遅早時間</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">普通残業時間</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">深夜残業時間</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">休日出勤時間</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">法定休出時間</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap border-r border-gray-200">備考</th>
                    <th className="px-3 py-2 text-right font-medium text-blue-700 whitespace-nowrap border-r border-gray-200 bg-slate-100">精勤手当</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200 bg-slate-100">基本額</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 whitespace-nowrap border-r border-gray-200 bg-slate-100">役職手当</th>
                    <th className="px-3 py-2 text-right font-medium text-green-700 whitespace-nowrap border-r border-gray-200 bg-slate-100">支給額</th>
                    <th className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayRecords.map((r) => {
                    const liveBonus = calcBonus(r.bonus_eligible, r.paid_leave_days, r.absent_days, r.late_early_hours);
                    const liveBase  = (r.employee_bonus ?? 0) + liveBonus;
                    const livePayment = calcPayment(r.bonus_eligible, liveBase || null, r.employee_position_allowance, r.absent_days, r.late_early_hours) ?? 0;

                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{r.employee_number}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.work_days)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.paid_leave_days)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.absent_days)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.late_early_hours)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.overtime_hours)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.night_overtime_hours)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.holiday_hours)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap">{fmt(r.legal_holiday_hours)}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap text-gray-600">{r.notes ?? ""}</td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap font-medium text-blue-700 bg-slate-50">
                          {liveBonus.toLocaleString()}円
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap text-gray-700 bg-slate-50">
                          {liveBase.toLocaleString()}円
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap text-gray-700 bg-slate-50">
                          {(r.employee_position_allowance ?? 0).toLocaleString()}円
                        </td>
                        <td className="px-3 py-1.5 border-r border-gray-100 text-right whitespace-nowrap font-medium text-green-700 bg-slate-50">
                          {livePayment.toLocaleString()}円
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(r)}
                              className="px-2 py-0.5 text-xs border rounded text-gray-600 hover:bg-gray-100">
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.name || r.employee_number)}
                              disabled={deletingId === r.id}
                              className="px-2 py-0.5 text-xs border border-red-200 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === r.id ? "削除中" : "削除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 編集モーダル */}
      {editingRow && editState && (
        <EditModal
          row={editingRow}
          editState={editState}
          saving={saving}
          onClose={cancelEdit}
          onSave={saveEdit}
          onChange={handleChange}
        />
      )}
    </div>
  );
}
