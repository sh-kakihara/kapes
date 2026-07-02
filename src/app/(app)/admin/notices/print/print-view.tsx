"use client";

import { useState } from "react";
import { toWareki, getSalaryNoticeText, fmtAmount, employeeTypeToCompany } from "@/lib/wareki";

type NoticeItem = {
  id: string;
  name: string;
  employee_type: string;
  birth_date: string | null;
  gender: string | null;
  employment_type: string | null;
  salary_increase: number | null;
};

type Props = {
  fiscal_year: number;
  notice_date: string;
  comment: string;
  representative: string;
  items: NoticeItem[];
};

export default function PrintView({ fiscal_year, notice_date, comment, representative, items }: Props) {
  const wareki = notice_date ? toWareki(notice_date) : "";

  // 3人ずつのページに分割（全ページ）
  const allPages: NoticeItem[][] = [];
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
        <a href={`/admin/notices/salary?year=${fiscal_year}`} className="text-sm text-gray-300 hover:text-white">← 戻る</a>
        <span className="text-sm text-gray-300">{fiscal_year}年度 昇給通知</span>
        {!notice_date && (
          <span className="text-yellow-300 text-xs">⚠ 昇給日が未設定です。戻って設定してください。</span>
        )}

        {/* ページ範囲 */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">全{totalPages}ページ（{items.length}名）</span>
          <span className="text-sm text-gray-300">印刷範囲:</span>
          <input
            type="number"
            min={1}
            max={totalPages || 1}
            value={fromPage}
            onChange={(e) => {
              const v = clamp(Number(e.target.value));
              setFromPage(v);
              if (v > toPage) setToPage(v);
            }}
            className="w-14 px-2 py-1 text-sm text-gray-900 rounded border border-gray-500 bg-gray-700 text-white text-center"
          />
          <span className="text-gray-400 text-sm">〜</span>
          <input
            type="number"
            min={1}
            max={totalPages || 1}
            value={toPage}
            onChange={(e) => {
              const v = clamp(Number(e.target.value));
              setToPage(v);
              if (v < fromPage) setFromPage(v);
            }}
            className="w-14 px-2 py-1 text-sm text-gray-900 rounded border border-gray-500 bg-gray-700 text-white text-center"
          />
          <span className="text-xs text-gray-400">ページ</span>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-white text-gray-800 px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-100"
        >
          印刷
        </button>
      </div>

      {/* 印刷スタイル */}
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          /* アプリヘッダー・コントロールバーを非表示 */
          header { display: none !important; }
          .no-print { display: none !important; }
          /* レイアウトの余白をリセット */
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
          }
          .notice-slot {
            height: 99mm;
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
          }
          .notice-slot {
            min-height: 99mm;
            box-sizing: border-box;
          }
          body { background: #e5e7eb; }
        }
      `}</style>

      {visiblePages.length === 0 && (
        <div className="text-center py-32 text-gray-500" style={{ marginTop: "70px" }}>
          印刷対象のデータがありません
        </div>
      )}

      {visiblePages.map((group, gi) => (
        <div key={gi} className="print-page">
          {group.map((item, idx) => (
            <NoticeSlot
              key={item.id}
              item={item}
              notice_date={notice_date}
              wareki={wareki}
              comment={comment}
              representative={representative}
              isLast={idx === group.length - 1 && gi === visiblePages.length - 1}
            />
          ))}
          {group.length < 3 && Array.from({ length: 3 - group.length }).map((_, i) => (
            <div key={`empty-${i}`} className="notice-slot" />
          ))}
        </div>
      ))}
    </>
  );
}

function NoticeSlot({
  item,
  notice_date,
  wareki,
  comment,
  representative,
}: {
  item: NoticeItem;
  notice_date: string;
  wareki: string;
  comment: string;
  representative: string;
  isLast: boolean;
}) {
  const amount = item.salary_increase ?? 0;
  const companyName = employeeTypeToCompany(item.employee_type);

  const leftText = getSalaryNoticeText(
    item.birth_date ? new Date(item.birth_date) : null,
    item.gender,
    item.salary_increase,
    notice_date || new Date().toISOString().slice(0, 10),
    wareki,
  );

  return (
    <div
      className="notice-slot"
      style={{
        display: "flex",
        padding: "7mm 12mm 5mm",
        fontFamily: "\"Hiragino Mincho ProN\", \"Yu Mincho\", \"MS Mincho\", serif",
        boxSizing: "border-box",
      }}
    >
      {/* 左カラム */}
      <div style={{ width: "44%", paddingRight: "8mm", display: "flex", flexDirection: "column" }}>
        <p style={{ fontSize: "24pt", fontWeight: "bold", marginBottom: "4mm", letterSpacing: "0.25em", lineHeight: 1.2 }}>
          {item.name}　殿
        </p>
        <div style={{ fontSize: "12pt", lineHeight: 1.6, marginBottom: "3mm", whiteSpace: "pre-line" }}>
          {leftText}
        </div>
        {amount > 0 && item.employment_type && (
          <div style={{ fontSize: "12pt", marginLeft: "10mm", marginTop: "1mm", letterSpacing: "0.05em" }}>
            {item.employment_type}　　{fmtAmount(amount)}
          </div>
        )}
      </div>

      {/* 右カラム */}
      <div style={{ width: "56%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <p style={{ fontSize: "10.5pt", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {comment}
        </p>
        <div style={{ textAlign: "right", fontSize: "10.5pt", marginTop: "4mm", lineHeight: 1.8 }}>
          <div>{companyName}</div>
          <div>{representative}</div>
        </div>
      </div>
    </div>
  );
}
