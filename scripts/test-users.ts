import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const users = await prisma.user.findMany({
    where: { deleted_at: null },
    include: {
      department: { include: { sections: { where: { deleted_at: null }, include: { groups: { where: { deleted_at: null } } } } } },
      section: { include: { groups: { where: { deleted_at: null } } } },
      section2: { include: { groups: { where: { deleted_at: null } } } },
      group: true,
    },
    orderBy: [{ department: { name: "asc" } }, { section: { name: "asc" } }, { name: "asc" }],
    take: 1,
  });
  console.log("getUsers OK, count:", users.length);

  const depts = await prisma.department.findMany({
    where: { deleted_at: null },
    include: { sections: { where: { deleted_at: null }, include: { groups: { where: { deleted_at: null } } } } },
  });
  console.log("getDepartments OK, count:", depts.length);
}

main().catch((e) => console.error("ERROR:", e.message, e.stack)).finally(() => prisma.$disconnect());
