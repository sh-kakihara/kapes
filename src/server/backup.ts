"use server";

import { auth } from "@/auth";
import { forbidden } from "next/navigation";
import { spawn } from "child_process";
import { revalidatePath } from "next/cache";

function pgBin(name: string) {
  const dir = process.env.PG_BIN_DIR;
  if (dir) return `${dir}/${name}`;
  if (process.platform === "win32") return `C:\\Program Files\\PostgreSQL\\17\\bin\\${name}.exe`;
  return name;
}
const PG_DUMP    = pgBin("pg_dump");
const PG_RESTORE = pgBin("pg_restore");
const PSQL       = pgBin("psql");

function parseDbUrl(url: string) {
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error("DATABASE_URL のパースに失敗しました");
  return { user: m[1], password: m[2], host: m[3], port: m[4], dbname: m[5] };
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) forbidden();
  if (session.user.role !== "ADMIN") forbidden();
  return session.user;
}

/** バックアップ: pg_dump の出力を Buffer で返す */
export async function createBackup(): Promise<{ ok: true; data: number[]; filename: string } | { ok: false; error: string }> {
  await requireAdmin();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { ok: false, error: "DATABASE_URL が未設定です" };

  const { user, password, host, port, dbname } = parseDbUrl(dbUrl);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `jinji_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.dump`;

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn(PG_DUMP, [
      "-h", host, "-p", port, "-U", user,
      "-F", "c",   // custom format（pg_restore 対応）
      "-d", dbname,
    ], {
      env: { ...process.env, PGPASSWORD: password },
    });

    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr.on("data", (d: Buffer) => errChunks.push(d));

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: Buffer.concat(errChunks).toString() });
      } else {
        const buf = Buffer.concat(chunks);
        resolve({ ok: true, data: Array.from(buf), filename });
      }
    });
  });
}

/** リストア: アップロードされたバイト列を pg_restore で適用 */
export async function restoreBackup(
  bytes: number[],
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { ok: false, message: "DATABASE_URL が未設定です" };

  const { user, password, host, port, dbname } = parseDbUrl(dbUrl);
  const buf = Buffer.from(bytes);

  return new Promise((resolve) => {
    const errChunks: Buffer[] = [];

    const restore = spawn(PG_RESTORE, [
      "-h", host, "-p", port, "-U", user,
      "-d", dbname,
      "--clean", "--if-exists", "--no-owner", "--no-privileges",
      "-F", "c",
    ], {
      env: { ...process.env, PGPASSWORD: password },
      stdio: ["pipe", "pipe", "pipe"],
    });

    restore.stdin.write(buf);
    restore.stdin.end();
    // stdout を捨てないとバッファが詰まってハングする
    restore.stdout.resume();
    restore.stderr.on("data", (d: Buffer) => errChunks.push(d));

    restore.on("close", (code) => {
      revalidatePath("/", "layout");
      if (code !== 0) {
        const errText = Buffer.concat(errChunks).toString();
        // pg_restore は警告でも非0を返すことがある
        const hasRealError = errText.split("\n").some(
          (l) => l.includes("ERROR:") && !l.includes("does not exist")
        );
        if (hasRealError) {
          resolve({ ok: false, message: `リストアエラー:\n${errText}` });
        } else {
          resolve({ ok: true, message: "リストアが完了しました（警告あり）" });
        }
      } else {
        resolve({ ok: true, message: "リストアが完了しました" });
      }
    });
  });
}
