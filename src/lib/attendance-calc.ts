/**
 * 支給額計算
 * - 対象外（時給等）: 基本額 + 役職手当 をそのまま返す
 * - 対象: INT((基本額 + 役職手当) × (1 - 欠勤日数/100 - 遅早時間/800) / 100) × 100
 * 基本額 = 夏/冬期賞与額 + 精勤手当（役職手当は別引数）
 */
export function calcPayment(
  eligible: boolean,
  baseAmount: number | null,
  positionAllowance: number | null,
  absentDays: number | null,
  lateEarlyHours: number | null
): number | null {
  const total = (baseAmount ?? 0) + (positionAllowance ?? 0);
  if (total === 0) return null;
  if (!eligible) return total;
  const absent = absentDays ?? 0;
  const late = lateEarlyHours ?? 0;
  return Math.floor(total * (1 - absent / 100 - late / 800) / 100) * 100;
}

/**
 * 精勤手当計算
 * 有休日数・欠勤日数・遅早時間÷8 のスコアから判定
 */
export function calcBonus(
  eligible: boolean,
  paid: number | null,
  absent: number | null,
  late: number | null
): number {
  if (!eligible) return 0;
  if (paid == null && absent == null && late == null) return 0;
  const p = paid ?? 0;
  const a = absent ?? 0;
  const l = late ?? 0;
  if (p === 0 && a === 0 && l === 0) return 15000;
  const score = p + a + l / 8;
  if (score <= 1) return 10000;
  if (score <= 2) return 5000;
  if (score <= 3) return 3000;
  return 0;
}
