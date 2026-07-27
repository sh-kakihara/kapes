"use client";

import { useState, useRef } from "react";

export type ScatterPoint = {
  name: string;
  employeeNumber: string | null;
  department: string;
  section: string | null;
  selfTotal: number;
  directorTotal: number;
};

const MIN = 11;
const MAX = 55;
const RANGE = MAX - MIN;

const PAD = { top: 60, right: 60, bottom: 80, left: 80 };
const W = 1100;
const H = 1100;
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function toX(val: number) {
  return PAD.left + ((val - MIN) / RANGE) * PLOT_W;
}
function toY(val: number) {
  return PAD.top + ((MAX - val) / RANGE) * PLOT_H;
}

const TICKS = [11, 22, 33, 44, 55];
const ALL_TICKS = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i); // 11〜55

export default function ScatterChart({ points }: { points: ScatterPoint[] }) {
  const [tooltip, setTooltip] = useState<{ point: ScatterPoint; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 重なり対策: 同座標の点をグループ化
  const grouped = new Map<string, ScatterPoint[]>();
  for (const p of points) {
    const key = `${p.selfTotal},${p.directorTotal}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  return (
    <div className="overflow-x-auto">
      <div className="relative inline-block">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="border rounded-lg bg-white"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* 細グリッド＋小目盛り突起（1点ごと） */}
          {ALL_TICKS.map((t) => (
            <g key={t}>
              {/* グリッド線（プロット領域内） */}
              <line x1={toX(t)} y1={PAD.top} x2={toX(t)} y2={PAD.top + PLOT_H} stroke="#f3f4f6" strokeWidth={1} />
              <line x1={PAD.left} y1={toY(t)} x2={PAD.left + PLOT_W} y2={toY(t)} stroke="#f3f4f6" strokeWidth={1} />
              {/* 軸突起 */}
              <line x1={toX(t)} y1={PAD.top + PLOT_H} x2={toX(t)} y2={PAD.top + PLOT_H + 5} stroke="#9ca3af" strokeWidth={1} />
              <line x1={PAD.left - 5} y1={toY(t)} x2={PAD.left} y2={toY(t)} stroke="#9ca3af" strokeWidth={1} />
            </g>
          ))}

          {/* グリッド */}
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={toX(t)} y1={PAD.top}
                x2={toX(t)} y2={PAD.top + PLOT_H}
                stroke="#e5e7eb" strokeWidth={1}
              />
              <line
                x1={PAD.left} y1={toY(t)}
                x2={PAD.left + PLOT_W} y2={toY(t)}
                stroke="#e5e7eb" strokeWidth={1}
              />
            </g>
          ))}

          {/* 中間値(33)の十字線 */}
          <line
            x1={toX(33)} y1={PAD.top}
            x2={toX(33)} y2={PAD.top + PLOT_H}
            stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3"
          />
          <line
            x1={PAD.left} y1={toY(33)}
            x2={PAD.left + PLOT_W} y2={toY(33)}
            stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3"
          />

          {/* 象限ラベル */}
          <text x={toX(22)} y={toY(44)} textAnchor="middle" fontSize={13} fill="#94a3b8">自低・部高</text>
          <text x={toX(44)} y={toY(44)} textAnchor="middle" fontSize={13} fill="#94a3b8">自高・部高</text>
          <text x={toX(22)} y={toY(22)} textAnchor="middle" fontSize={13} fill="#94a3b8">自低・部低</text>
          <text x={toX(44)} y={toY(22)} textAnchor="middle" fontSize={13} fill="#94a3b8">自高・部低</text>

          {/* 対角線（自己評価＝部長評価） */}
          <line
            x1={toX(MIN)} y1={toY(MIN)}
            x2={toX(MAX)} y2={toY(MAX)}
            stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 4"
          />

          {/* 軸 */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="#9ca3af" strokeWidth={1.5} />
          <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="#9ca3af" strokeWidth={1.5} />

          {/* 目盛り数字（11〜55 全て） */}
          {ALL_TICKS.map((t) => (
            <g key={t}>
              <text x={toX(t)} y={PAD.top + PLOT_H + 22} textAnchor="middle" fontSize={11} fill="#6b7280">{t}</text>
              <text x={PAD.left - 10} y={toY(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">{t}</text>
            </g>
          ))}

          {/* 軸ラベル */}
          <text x={PAD.left + PLOT_W / 2} y={H - 14} textAnchor="middle" fontSize={16} fill="#374151" fontWeight="600">
            自己評価
          </text>
          <text
            x={20}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            fontSize={16}
            fill="#374151"
            fontWeight="600"
            transform={`rotate(-90, 20, ${PAD.top + PLOT_H / 2})`}
          >
            部長評価
          </text>

          {/* プロット点 */}
          {Array.from(grouped.entries()).map(([key, pts]) => {
            const cx = toX(pts[0].selfTotal);
            const cy = toY(pts[0].directorTotal);
            const isMultiple = pts.length > 1;
            return (
              <g
                key={key}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  const svgRect = svgRef.current?.getBoundingClientRect();
                  setTooltip({
                    point: pts[0],
                    x: e.clientX - (svgRect?.left ?? 0),
                    y: e.clientY - (svgRect?.top ?? 0),
                  });
                }}
                onMouseMove={(e) => {
                  const svgRect = svgRef.current?.getBoundingClientRect();
                  setTooltip((prev) => prev ? {
                    ...prev,
                    x: e.clientX - (svgRect?.left ?? 0),
                    y: e.clientY - (svgRect?.top ?? 0),
                  } : null);
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  cx={cx} cy={cy}
                  r={isMultiple ? 18 : 6}
                  fill={isMultiple ? "#3b82f6" : "#2563eb"}
                  fillOpacity={0.85}
                  stroke="#1d4ed8"
                  strokeWidth={1.5}
                />
                {/* 氏名ラベル（重複なし） */}
                {!isMultiple && (
                  <text
                    x={cx + 10} y={cy - 7}
                    fontSize={12} fill="#1e3a5f"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {pts[0].name}
                  </text>
                )}
                {/* 重複時は人数表示 */}
                {isMultiple && (
                  <text
                    x={cx} y={cy + 5}
                    textAnchor="middle"
                    fontSize={13} fill="white" fontWeight="bold"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {pts.length}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ツールチップ */}
        {tooltip && (() => {
          const pts = grouped.get(`${tooltip.point.selfTotal},${tooltip.point.directorTotal}`) ?? [];
          return (
            <div
              className="absolute z-10 bg-white border border-gray-300 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
              style={{ left: tooltip.x + 12, top: tooltip.y - 10, minWidth: 160, maxWidth: 240 }}
            >
              {pts.map((p, i) => (
                <div key={i} className={i > 0 ? "mt-1 pt-1 border-t border-gray-100" : ""}>
                  <p className="font-bold text-gray-800">{p.name}</p>
                  {p.employeeNumber && <p className="text-gray-500">社員番号: {p.employeeNumber}</p>}
                  <p className="text-gray-500">{p.department}{p.section ? `　${p.section}` : ""}</p>
                  <p className="text-blue-700 mt-0.5">自己評価: <span className="font-bold">{p.selfTotal}</span> ／ 部長評価: <span className="font-bold">{p.directorTotal}</span></p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 凡例 */}
      <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="#2563eb" fillOpacity="0.85" stroke="#1d4ed8" strokeWidth="1" /></svg>
          1名
        </span>
        <span className="flex items-center gap-1">
          <svg width="16" height="16"><circle cx="8" cy="8" r="8" fill="#3b82f6" fillOpacity="0.85" stroke="#1d4ed8" strokeWidth="1" /><text x="8" y="12" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">N</text></svg>
          複数名（円内に人数、ホバーで氏名表示）
        </span>
        <span className="flex items-center gap-1">
          <svg width="24" height="12"><line x1="0" y1="6" x2="24" y2="6" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 4" /></svg>
          自己評価＝部長評価
        </span>
      </div>
    </div>
  );
}
