import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PERIOD_ID = "cmqyvv2qa000ajgdlcyxtvbcw"; // 2026年度冬期

async function main() {
  // 1. EvaluationScore を削除（Evaluation 経由で period を絞る）
  const evaluations = await prisma.evaluation.findMany({
    where: { period_id: PERIOD_ID },
    select: { id: true },
  });
  const evalIds = evaluations.map((e) => e.id);
  console.log(`対象 Evaluation 件数: ${evalIds.length}`);

  const scoreResult = await prisma.evaluationScore.deleteMany({
    where: { evaluation_id: { in: evalIds } },
  });
  console.log(`EvaluationScore 削除: ${scoreResult.count}件`);

  const evalResult = await prisma.evaluation.deleteMany({
    where: { period_id: PERIOD_ID },
  });
  console.log(`Evaluation 削除: ${evalResult.count}件`);

  // 2. EmployeeRecord の冬期評価カラムをクリア
  const erResult = await prisma.employeeRecord.updateMany({
    where: { fiscal_year: 2026 },
    data: { curr_winter_director_eval: null, curr_winter_president_eval: null },
  });
  console.log(`EmployeeRecord 冬期評価クリア: ${erResult.count}件`);

  console.log("完了");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
