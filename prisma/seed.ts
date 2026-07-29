import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // 部署
  const dept1 = await prisma.department.upsert({
    where: { name: "営業部" },
    update: {},
    create: { name: "営業部" },
  });
  const dept2 = await prisma.department.upsert({
    where: { name: "製造部" },
    update: {},
    create: { name: "製造部" },
  });

  // 課
  const sec1 = await prisma.section.upsert({
    where: { department_id_name: { department_id: dept1.id, name: "第一営業課" } },
    update: {},
    create: { name: "第一営業課", department_id: dept1.id },
  });
  const sec2 = await prisma.section.upsert({
    where: { department_id_name: { department_id: dept2.id, name: "製造一課" } },
    update: {},
    create: { name: "製造一課", department_id: dept2.id },
  });

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  async function upsertUser(login_id: string, data: Parameters<typeof prisma.user.create>[0]["data"]) {
    const existing = await prisma.user.findFirst({ where: { login_id } });
    if (!existing) await prisma.user.create({ data });
    return (await prisma.user.findFirst({ where: { login_id } }))!;
  }

  // 社長
  await upsertUser("president", { login_id: "president", name: "社長 太郎", password_hash: hash("president123"), role: "PRESIDENT" });

  // 管理者
  await upsertUser("admin", { login_id: "admin", name: "管理者", password_hash: hash("admin123"), role: "ADMIN" });

  // 部長
  const director = await upsertUser("director1", { login_id: "director1", name: "部長 一郎", password_hash: hash("director123"), role: "DIRECTOR", department_id: dept1.id });

  // 課長
  const manager = await upsertUser("manager1", { login_id: "manager1", name: "課長 二郎", password_hash: hash("manager123"), role: "MANAGER", department_id: dept1.id, section_id: sec1.id });
  await upsertUser("manager2", { login_id: "manager2", name: "課長 五郎", password_hash: hash("manager123"), role: "MANAGER", department_id: dept2.id, section_id: sec2.id });

  // 社員
  await upsertUser("staff1", { login_id: "staff1", name: "社員 三郎", password_hash: hash("staff123"), role: "STAFF", department_id: dept1.id, section_id: sec1.id });
  await upsertUser("staff2", { login_id: "staff2", name: "社員 四郎", password_hash: hash("staff123"), role: "STAFF", department_id: dept1.id, section_id: sec1.id });

  // 評価期間
  await prisma.evaluationPeriod.upsert({
    where: { name: "2026年度上期" },
    update: {},
    create: { name: "2026年度上期", start_date: new Date("2026-04-01"), end_date: new Date("2026-09-30"), is_active: true },
  });

  console.log("シードデータを登録しました");
  console.log("ログイン情報:");
  console.log("  社長: president / president123");
  console.log("  管理者: admin / admin123");
  console.log("  部長: director1 / director123");
  console.log("  課長: manager1, manager2 / manager123");
  console.log("  社員: staff1, staff2 / staff123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
