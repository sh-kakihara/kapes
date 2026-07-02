/** 西暦 → 和暦文字列（令和/平成） */
export function toWareki(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (y > 2019 || (y === 2019 && m >= 5)) {
    return `令和${y - 2018}年${m}月${day}日`;
  }
  if (y >= 1989) {
    return `平成${y - 1988}年${m}月${day}日`;
  }
  return `${y}年${m}月${day}日`;
}

/** 基準日時点の年齢を計算 */
export function calcAgeAt(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const dm = referenceDate.getMonth() - birthDate.getMonth();
  if (dm < 0 || (dm === 0 && referenceDate.getDate() < birthDate.getDate())) age--;
  return age;
}

/**
 * 昇給通知の左側テキストを生成する。
 * noticeDateStr: YYYY-MM-DD形式の昇給開始日
 * wareki: toWareki(noticeDateStr) の結果
 */
export function getSalaryNoticeText(
  birthDate: Date | null,
  gender: string | null,
  salaryIncrease: number | null,
  noticeDateStr: string,
  wareki: string,
): string {
  const amount = salaryIncrease ?? 0;
  const noticeDate = new Date(noticeDateStr);
  const isMale = gender ? ["男性", "男", "M"].includes(gender) : null;

  if (isMale === null || !birthDate) {
    return amount > 0
      ? `${wareki}より基本給は\n下記の金額に昇給します。`
      : "その他の理由で基本給は現状の額です。";
  }

  const stopAge = isMale ? 55 : 60;
  const age = calcAgeAt(birthDate, noticeDate);

  if (amount > 0) {
    if (age >= stopAge) {
      return `昇給停止年齢"${stopAge}歳"に達しましたが、\n今後の活躍を期待し特別昇給します。`;
    }
    return `${wareki}より基本給は\n下記の金額に昇給します。`;
  } else {
    if (age > stopAge) {
      return `${stopAge}歳以上につき昇給はありません。\n基本給は現状の額です。`;
    }
    if (age === stopAge) {
      return `昇給停止年齢"55歳"に達したので、\n基本給は現状の額です。`;
    }
    return "その他の理由で基本給は現状の額です。";
  }
}

/** 数値を金額フォーマット（例: 266000 → "266,000円"） */
export function fmtAmount(n: number): string {
  return n.toLocaleString("ja-JP") + "円";
}

/** 社員種別 → 会社名 */
export function employeeTypeToCompany(type: string | null): string {
  if (type === "柿原技研") return "有限会社柿原技研";
  return "柿原工業株式会社";
}
