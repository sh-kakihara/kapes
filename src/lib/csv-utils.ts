/** CSVダウンロード（UTF-8 BOM付き） */
export function downloadCsv(filename: string, rows: string[][]): void {
  const BOM = "﻿";
  const content = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** CSVファイルを行×列の文字列配列に解析 */
export function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = (e.target?.result as string) ?? "";
        // BOM除去
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        resolve(parseCsvText(text));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsText(file, "utf-8");
  });
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === "") continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      if (line[i] === ",") i++;
      fields.push(field);
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) { fields.push(line.slice(i)); i = line.length; }
      else { fields.push(line.slice(i, end)); i = end + 1; }
    }
  }
  return fields;
}
