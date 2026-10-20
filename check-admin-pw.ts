import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const user = await prisma.user.findFirst({
    where: { login_id: "admin" },
    select: { login_id: true, is_active: true, deleted_at: true, password_hash: true },
  });
  console.log("user:", JSON.stringify({ ...user, password_hash: user?.password_hash?.slice(0, 20) + "..." }));
  if (user) {
    const ok = await bcrypt.compare("admin123", user.password_hash);
    console.log("admin123 照合結果:", ok);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
