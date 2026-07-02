/**
 * インフレ手当自動計算
 *
 * ルール（支給日基準）:
 *   在籍 3ヶ月未満                          → 10,000円
 *   在籍 3ヶ月以上:
 *     65歳以上                              → 10,000円
 *     60〜64歳                              → 20,000円
 *     実習生                                → 20,000円
 *     月給・日給月給 かつ 59歳以下           → 30,000円
 *     時給・日給   かつ 59歳以下            → 20,000円
 *     上記以外                              → 20,000円
 */
export function calcInflationAmount(
  hireDate: Date | null,
  birthDate: Date | null,
  employmentType: string | null,
  trainingPeriod: string | null,
  noticeDate: Date
): number {
  if (!hireDate || isLessThan3Months(hireDate, noticeDate)) return 10000;

  const age = birthDate ? calcAge(birthDate, noticeDate) : 0;

  if (age >= 65) return 10000;
  if (age >= 60) return 20000;

  const type = (employmentType ?? "").trim();
  if (trainingPeriod || type === "実習生") return 20000;
  if (["月給", "日給月給"].includes(type)) return 30000;
  return 20000;
}

/** hire_date から notice_date までが 3ヶ月未満かどうか */
function isLessThan3Months(hireDate: Date, noticeDate: Date): boolean {
  const threshold = new Date(hireDate);
  threshold.setMonth(threshold.getMonth() + 3);
  return noticeDate < threshold;
}

/** 基準日時点の年齢を計算 */
function calcAge(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const dm = referenceDate.getMonth() - birthDate.getMonth();
  if (dm < 0 || (dm === 0 && referenceDate.getDate() < birthDate.getDate())) age--;
  return age;
}

/** 勤務年数（端数切り捨て） */
export function calcYearsEmployed(hireDate: Date, referenceDate: Date): number {
  let years = referenceDate.getFullYear() - hireDate.getFullYear();
  const dm = referenceDate.getMonth() - hireDate.getMonth();
  if (dm < 0 || (dm === 0 && referenceDate.getDate() < hireDate.getDate())) years--;
  return Math.max(0, years);
}
