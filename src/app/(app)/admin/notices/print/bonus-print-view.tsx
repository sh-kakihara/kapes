"use client";

import { useState } from "react";
import { toWareki, employeeTypeToCompany } from "@/lib/wareki";
import type { BonusNoticeEmployee } from "@/server/notice";

type Props = {
  fiscal_year: number;
  season: string;
  notice_date: string;
  representative: string;
  comment: string;
  items: BonusNoticeEmployee[];
};

/** カンマ区切り数値（円なし） */
function fmtNum(n: number | null | undefined): string {
  if (n == null) return "0";
  return n.toLocaleString("ja-JP");
}

/** 有給・欠勤・遅早の表示 */
function fmtPaid(n: number | null): string {
  if (n == null) return "0.0日";
  return `${n.toFixed(1)}日`;
}
function fmtAbsent(n: number | null): string {
  if (n == null) return "0日";
  return `${n}日`;
}
function fmtLate(n: number | null): string {
  if (n == null) return "0.00時間";
  return `${n.toFixed(2)}時間`;
}

export default function BonusPrintView({
  fiscal_year,
  season,
  notice_date,
  representative,
  comment,
  items,
}: Props) {
  const wareki = notice_date ? toWareki(notice_date) : "";

  // 3人ずつのページに分割
  const allPages: BonusNoticeEmployee[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    allPages.push(items.slice(i, i + 3));
  }
  const totalPages = allPages.length;

  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(totalPages || 1);

  const clamp = (v: number) => Math.max(1, Math.min(totalPages || 1, v));
  const visiblePages = allPages.slice(clamp(fromPage) - 1, clamp(toPage));

  return (
    <>
      {/* コントロールバー（印刷時非表示） */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white px-6 py-3 flex items-center gap-4 flex-wrap">
        <a href={`/admin/notices/bonus?year=${fiscal_year}`} className="text-sm text-gray-300 hover:text-white">← 戻る</a>
        <span className="text-sm text-gray-300">{fiscal_year}年度{season} 賞与通知</span>
        {!notice_date && (
          <span className="text-yellow-300 text-xs">⚠ 支給日が未設定です。戻って設定してください。</span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">全{totalPages}ページ（{items.length}名）</span>
          <span className="text-sm text-gray-300">印刷範囲:</span>
          <input
            type="number" min={1} max={totalPages || 1} value={fromPage}
            onChange={(e) => { const v = clamp(Number(e.target.value)); setFromPage(v); if (v > toPage) setToPage(v); }}
            className="w-14 px-2 py-1 text-sm rounded border border-gray-500 bg-gray-700 text-white text-center"
          />
          <span className="text-gray-400 text-sm">〜</span>
          <input
            type="number" min={1} max={totalPages || 1} value={toPage}
            onChange={(e) => { const v = clamp(Number(e.target.value)); setToPage(v); if (v < fromPage) setFromPage(v); }}
            className="w-14 px-2 py-1 text-sm rounded border border-gray-500 bg-gray-700 text-white text-center"
          />
          <span className="text-xs text-gray-400">ページ</span>
        </div>
        <button onClick={() => window.print()} className="bg-white text-gray-800 px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-100">
          印刷
        </button>
      </div>

      {/* 印刷スタイル */}
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          header { display: none !important; }
          .no-print { display: none !important; }
          html, body { margin: 0; padding: 0; background: white; }
          body > div { display: contents; }
          main { padding: 0 !important; margin: 0 !important; }
          .print-page {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .bonus-slot {
            flex: 1;
            height: 99mm;
            max-height: 99mm;
            box-sizing: border-box;
            overflow: hidden;
          }
        }
        @media screen {
          .print-page {
            width: 210mm;
            background: white;
            margin: 70px auto 40px;
            box-shadow: 0 2px 16px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
          }
          .bonus-slot {
            height: 99mm;
            box-sizing: border-box;
          }
          body { background: #e5e7eb; }
        }
      `}</style>

      {visiblePages.length === 0 && (
        <div className="text-center py-32 text-gray-500" style={{ marginTop: "70px" }}>
          印刷対象のデータがありません。精勤手当・支給額設定で{fiscal_year}年度{season}のデータを取り込んでください。
        </div>
      )}

      {visiblePages.map((group, gi) => (
        <div key={gi} className="print-page">
          {group.map((item) => (
            <BonusSlot
              key={item.id}
              item={item}
              wareki={wareki}
              notice_date={notice_date}
              comment={comment}
              representative={representative}
            />
          ))}
          {/* 人数が3未満の場合は空スロットで埋める */}
          {group.length < 3 && Array.from({ length: 3 - group.length }).map((_, i) => (
            <div key={`empty-${i}`} className="bonus-slot" />
          ))}
        </div>
      ))}
    </>
  );
}

function BonusSlot({
  item,
  wareki,
  notice_date,
  comment,
  representative,
}: {
  item: BonusNoticeEmployee;
  wareki: string;
  notice_date: string;
  comment: string;
  representative: string;
}) {
  const companyName = employeeTypeToCompany(item.employee_type);

  const FF = '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif';

  return (
    <div
      className="bonus-slot"
      style={{
        display: "flex",
        flexDirection: "row",
        padding: "6mm 12mm 5mm 14mm",
        fontFamily: FF,
        boxSizing: "border-box",
        gap: "6mm",
      }}
    >
      {/* 左カラム: 氏名・コメント・会社名 */}
      <div style={{ flex: "0 0 58%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 氏名 */}
        <div style={{ fontSize: "20pt", fontWeight: "bold", letterSpacing: "0.15em", marginBottom: "3mm", whiteSpace: "nowrap" }}>
          {item.name}　殿
        </div>

        {/* コメント */}
        <div style={{ fontSize: "11pt", lineHeight: 1.75, whiteSpace: "pre-wrap", flex: 1, overflow: "hidden" }}>
          {comment}
        </div>

        {/* 会社名・代表者（右寄せ・下） */}
        <div style={{ textAlign: "right", fontSize: "11.5pt", lineHeight: 1.8, marginTop: "2mm" }}>
          <div>{companyName}</div>
          <div>{representative}</div>
        </div>
      </div>

      {/* 右カラム: 数値テーブル（社長コメントの開始位置に合わせる） */}
      <div style={{ flex: "0 0 38%", paddingTop: "12mm" }}>
        <table style={{
          borderCollapse: "collapse",
          width: "100%",
          fontSize: "9pt",
          fontFamily: FF,
        }}>
          <thead>
            <tr>
              <th style={thStyle}>支給額</th>
              <th style={thStyle}>精勤手当</th>
              <th style={thStyle}>インフレ手当</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>{fmtNum(item.payment)}</td>
              <td style={tdStyle}>{fmtNum(item.bonus_add)}</td>
              <td style={tdStyle}>
                {item.inflation_enabled ? fmtNum(item.inflation_amount) : "－"}
              </td>
            </tr>
          </tbody>
          <thead>
            <tr>
              <th style={thStyle}>有給</th>
              <th style={thStyle}>欠勤</th>
              <th style={thStyle}>遅早時間</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>{fmtPaid(item.paid_leave_days)}</td>
              <td style={tdStyle}>{fmtAbsent(item.absent_days)}</td>
              <td style={tdStyle}>{fmtLate(item.late_early_hours)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "1mm 2mm",
  textAlign: "center",
  fontWeight: "normal",
  backgroundColor: "#f5f5f5",
  fontSize: "8.5pt",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "1mm 2mm",
  textAlign: "right",
  fontSize: "9pt",
  whiteSpace: "nowrap",
};
