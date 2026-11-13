/** JST（+09:00）基準の今日の日付文字列 "YYYY-MM-DD" */
export function todayJST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Date オブジェクトを JST 日付文字列 "YYYY-MM-DD" に変換 */
export function dateJST(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 今日（JST）が開始日（JST）より前か */
export function isBeforeDateJST(d: Date): boolean {
  return todayJST() < dateJST(d);
}

/** 今日（JST）が終了日（JST）を過ぎているか */
export function isPastDateJST(d: Date): boolean {
  return todayJST() > dateJST(d);
}
