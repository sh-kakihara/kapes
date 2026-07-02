"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EVALUATION_ITEMS } from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";

// MANAGER/ADMIN、または課なし部署所属者（isDeptViewer）を許可
async function requireManagerOrDeptViewer(userId: string, role: string) {
  if (["MANAGER", "ADMIN"].includes(role)) return;
  if (["DIRECTOR", "EXECUTIVE", "COUNSELOR", "PRESIDENT", "LEADER"].includes(role)) forbidden();
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { section_id: true, department_id: true } });
  if (!me || me.section_id || !me.department_id) forbidden();
}

function isWithinDeadline(deadline: Date | null): boolean {
  if (!deadline) return false;
  return new Date() <= new Date(deadline);
}

// 自分の評価を取得（なければ作成）
export async function getOrCreateMyEvaluation(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");

  // 実習生・評価対象外部署は評価フロー除外
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, include: { department: true } });
  if (me?.employee_type === "実習生") throw new Error("実習生は評価対象外です");
  if (me?.department?.skip_evaluation) throw new Error("所属部署は評価対象外です");

  const existing = await prisma.evaluation.findUnique({
    where: { period_id_employee_id: { period_id: periodId, employee_id: session.user.id } },
    include: { scores: true, period: true },
  });
  if (existing) return existing;

  return prisma.evaluation.create({
    data: {
      period_id: periodId,
      employee_id: session.user.id,
      scores: {
        create: EVALUATION_ITEMS.map((item) => ({
          item_code: item.code,
          evaluator: "self",
        })),
      },
    },
    include: { scores: true, period: true },
  });
}

// 自己評価を保存
export async function saveSelfEvaluation(
  evaluationId: string,
  scores: { item_code: string; score: number | null; comment: string }[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { period: true },
  });
  if (!evaluation || evaluation.employee_id !== session.user.id) throw new Error("権限なし");

  const canEdit =
    evaluation.status === "DRAFT" ||
    isWithinDeadline(evaluation.period.self_deadline);
  if (!canEdit) throw new Error("修正期限を過ぎているため編集できません");

  for (const s of scores) {
    await prisma.evaluationScore.upsert({
      where: { evaluation_id_item_code_evaluator: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "self" } },
      update: { score: s.score, comment: s.comment || null },
      create: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "self", score: s.score, comment: s.comment || null },
    });
  }

  revalidatePath("/evaluation");
  return { ok: true };
}

// 次のステップへ提出（ロールに応じて提出先が変わる）
export async function submitFromEmployee(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      employee: { include: { department: true, section: true, group: true } },
      period: true,
    },
  });
  if (!evaluation || evaluation.employee_id !== session.user.id) throw new Error("権限なし");

  const canSubmit =
    evaluation.status === "DRAFT" ||
    isWithinDeadline(evaluation.period.self_deadline);
  if (!canSubmit) throw new Error("修正期限を過ぎています");

  const employeeRole = evaluation.employee.role;
  const hasLeader = evaluation.employee.section?.has_leader ?? false;

  // 執行役員自身 → 社長へ
  if (employeeRole === "EXECUTIVE") {
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date() },
    });
    revalidatePath("/evaluation");
    return { ok: true };
  }

  // 部長自身 → 社長へ
  if (employeeRole === "DIRECTOR") {
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date() },
    });
    revalidatePath("/evaluation");
    return { ok: true };
  }

  // 課長自身 → skip_director 部署なら社長へ、それ以外は部長へ
  if (employeeRole === "MANAGER") {
    const deptId = evaluation.employee.department_id;
    if (evaluation.employee.department?.skip_director) {
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date() },
      });
    } else {
      const director = deptId
        ? await prisma.user.findFirst({
            where: { department_id: deptId, role: "DIRECTOR", is_active: true, deleted_at: null },
          })
        : null;
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: {
          status: "SUBMITTED_TO_DIRECTOR",
          submitted_to_director_at: new Date(),
          director_id: director?.id ?? null,
        },
      });
    }
    revalidatePath("/evaluation");
    return { ok: true };
  }

  // リーダー自身 → 課長へ直接提出
  if (employeeRole === "LEADER") {
    const manager = evaluation.employee.section_id
      ? await prisma.user.findFirst({
          where: { section_id: evaluation.employee.section_id, role: "MANAGER", is_active: true, deleted_at: null },
        })
      : null;
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: "SUBMITTED_TO_MANAGER",
        submitted_to_manager_at: new Date(),
        manager_id: manager?.id ?? null,
      },
    });
    revalidatePath("/evaluation");
    return { ok: true };
  }

  // 課長が実在するか確認（課なし or 課に課長がいない場合は部長へ直接）
  const manager = evaluation.employee.section_id
    ? await prisma.user.findFirst({
        where: { section_id: evaluation.employee.section_id, role: "MANAGER", is_active: true, deleted_at: null },
      })
    : null;
  const hasManager = !!manager;

  // 一般社員 → リーダー評価あり課ならリーダーへ、課長ありならリーダーなしで課長へ、課長なしなら部長へ
  if (hasLeader) {
    const leader = evaluation.employee.group_id
      ? await prisma.user.findFirst({
          where: { group_id: evaluation.employee.group_id, role: "LEADER", is_active: true, deleted_at: null },
        })
      : null;
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: "SUBMITTED_TO_LEADER",
        submitted_to_leader_at: new Date(),
        leader_id: leader?.id ?? null,
      },
    });
  } else if (hasManager) {
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: "SUBMITTED_TO_MANAGER",
        submitted_to_manager_at: new Date(),
        manager_id: manager!.id,
      },
    });
  } else {
    // 課長不在
    const dept = evaluation.employee.department;
    const deptId = evaluation.employee.department_id;
    // 顧問のいる部では skip_director に関わらず部長へ（次長など）
    const executive = deptId
      ? await prisma.user.findFirst({
          where: { department_id: deptId, role: "EXECUTIVE", is_active: true, deleted_at: null },
        })
      : null;
    if (!executive && dept?.skip_director) {
      // 顧問なし + skip_director → 社長へ
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date() },
      });
    } else {
      // 顧問あり or 通常部署 → 部長へ
      const director = deptId
        ? await prisma.user.findFirst({
            where: { department_id: deptId, role: "DIRECTOR", is_active: true, deleted_at: null },
          })
        : null;
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: {
          status: "SUBMITTED_TO_DIRECTOR",
          submitted_to_director_at: new Date(),
          director_id: director?.id ?? null,
        },
      });
    }
  }

  revalidatePath("/evaluation");
  return { ok: true };
}

// リーダー評価を保存
export async function saveLeaderEvaluation(
  evaluationId: string,
  scores: { item_code: string; score: number | null; comment: string }[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["LEADER", "ADMIN"].includes(session.user.role)) forbidden();

  for (const s of scores) {
    await prisma.evaluationScore.upsert({
      where: { evaluation_id_item_code_evaluator: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "leader" } },
      update: { score: s.score, comment: s.comment || null },
      create: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "leader", score: s.score, comment: s.comment || null },
    });
  }

  revalidatePath("/leader");
  return { ok: true };
}

// リーダー → 課長へ提出
export async function submitFromLeader(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["LEADER", "ADMIN"].includes(session.user.role)) forbidden();

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { employee: { include: { section: true } } },
  });
  if (!evaluation) throw new Error("評価が見つかりません");

  const manager = evaluation.employee.section_id
    ? await prisma.user.findFirst({
        where: { section_id: evaluation.employee.section_id, role: "MANAGER", is_active: true, deleted_at: null },
      })
    : null;

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      status: "SUBMITTED_TO_MANAGER",
      submitted_to_manager_at: new Date(),
      manager_id: manager?.id ?? null,
    },
  });

  revalidatePath("/leader");
  return { ok: true };
}

// 課長評価を保存
export async function saveManagerEvaluation(
  evaluationId: string,
  scores: { item_code: string; score: number | null; comment: string }[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  await requireManagerOrDeptViewer(session.user.id, session.user.role);

  for (const s of scores) {
    await prisma.evaluationScore.upsert({
      where: { evaluation_id_item_code_evaluator: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "manager" } },
      update: { score: s.score, comment: s.comment || null },
      create: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "manager", score: s.score, comment: s.comment || null },
    });
  }

  revalidatePath("/manager");
  return { ok: true };
}

// 課長 → 部長へ提出（部長スキップ設定の部署は社長へ直接）
export async function submitFromManager(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  await requireManagerOrDeptViewer(session.user.id, session.user.role);

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { employee: { include: { department: true } } },
  });
  if (!evaluation) throw new Error("評価が見つかりません");

  // 部長スキップ設定の部署は社長へ直接提出
  if (evaluation.employee.department?.skip_director) {
    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date() },
    });
    revalidatePath("/manager");
    return { ok: true };
  }

  const deptId = evaluation.employee.department_id;
  const director = deptId
    ? await prisma.user.findFirst({
        where: { department_id: deptId, role: "DIRECTOR", is_active: true, deleted_at: null },
      })
    : null;

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      status: "SUBMITTED_TO_DIRECTOR",
      submitted_to_director_at: new Date(),
      director_id: director?.id ?? null,
    },
  });

  revalidatePath("/manager");
  return { ok: true };
}

// 部長評価を保存
export async function saveDirectorEvaluation(
  evaluationId: string,
  scores: { item_code: string; score: number | null; comment: string }[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["DIRECTOR", "ADMIN"].includes(session.user.role)) forbidden();

  for (const s of scores) {
    await prisma.evaluationScore.upsert({
      where: { evaluation_id_item_code_evaluator: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "director" } },
      update: { score: s.score, comment: s.comment || null },
      create: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "director", score: s.score, comment: s.comment || null },
    });
  }

  revalidatePath("/director");
  return { ok: true };
}

// 部長評価スコア合計を社員台帳に反映するヘルパー
// 期間名から "2026年度冬期" → fiscal_year=2026, season="冬期" を取得
async function syncDirectorEvalToRecord(evaluationId: string, evaluatorKey: string) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { period: true, scores: { where: { evaluator: evaluatorKey } } },
  });
  if (!evaluation) return;

  const scores = evaluation.scores;
  if (scores.length === 0) return;

  const nameMatch = evaluation.period.name.match(/(\d{4})年度(夏期|冬期)/);
  if (!nameMatch) return; // 期間名が規定フォーマット外の場合はスキップ

  const fiscal_year = parseInt(nameMatch[1]);
  const season = nameMatch[2];
  const total = scores.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const updateData = season === "夏期"
    ? { curr_summer_director_eval: String(total) }
    : { curr_winter_director_eval: String(total) };

  await prisma.employeeRecord.upsert({
    where: { user_id_fiscal_year: { user_id: evaluation.employee_id, fiscal_year } },
    update: updateData,
    create: { user_id: evaluation.employee_id, fiscal_year, ...updateData },
  });
}

// 部長 → 社長へ提出
export async function submitFromDirector(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["DIRECTOR", "ADMIN"].includes(session.user.role)) forbidden();

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date() },
  });

  await syncDirectorEvalToRecord(evaluationId, "director");

  revalidatePath("/director");
  return { ok: true };
}

// 執行役員評価を保存（部長評価と同じ evaluator キー "director" を使用）
export async function saveExecutiveEvaluation(
  evaluationId: string,
  scores: { item_code: string; score: number | null; comment: string }[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["EXECUTIVE", "ADMIN"].includes(session.user.role)) forbidden();

  for (const s of scores) {
    await prisma.evaluationScore.upsert({
      where: { evaluation_id_item_code_evaluator: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "executive" } },
      update: { score: s.score, comment: s.comment || null },
      create: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "executive", score: s.score, comment: s.comment || null },
    });
  }

  revalidatePath("/director");
  return { ok: true };
}

// 執行役員 → 社長へ提出
export async function submitFromExecutive(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["EXECUTIVE", "ADMIN"].includes(session.user.role)) forbidden();

  // 執行役員スコアを "director" キーにコピー（社長・他画面での表示用）
  const executiveScores = await prisma.evaluationScore.findMany({
    where: { evaluation_id: evaluationId, evaluator: "executive" },
  });
  for (const s of executiveScores) {
    await prisma.evaluationScore.upsert({
      where: { evaluation_id_item_code_evaluator: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "director" } },
      update: { score: s.score, comment: s.comment },
      create: { evaluation_id: evaluationId, item_code: s.item_code, evaluator: "director", score: s.score, comment: s.comment },
    });
  }

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      status: "SUBMITTED_TO_PRESIDENT",
      submitted_to_president_at: new Date(),
    },
  });

  // executiveスコアはこの時点で "director" キーにコピー済み
  await syncDirectorEvalToRecord(evaluationId, "director");

  revalidatePath("/director");
  return { ok: true };
}

// 有効な評価期間を取得
export async function getActivePeriods() {
  return prisma.evaluationPeriod.findMany({
    where: { is_active: true },
    orderBy: { start_date: "desc" },
  });
}

export async function getAllPeriods() {
  return prisma.evaluationPeriod.findMany({
    orderBy: { start_date: "desc" },
  });
}

const employeeWithOrgInclude = {
  department: true,
  section: true,
  group: true,
} as const;

const evalWithScoresInclude = {
  scores: true,
  employee: { include: employeeWithOrgInclude },
} as const;

type EmployeeWithOrg = Awaited<ReturnType<typeof prisma.user.findMany<{ include: typeof employeeWithOrgInclude }>>>[number];
type EvalWithScores = Awaited<ReturnType<typeof prisma.evaluation.findMany<{ include: typeof evalWithScoresInclude }>>>[number];

async function mergeUsersWithEvaluations(
  employees: Awaited<ReturnType<typeof prisma.user.findMany<{ include: typeof employeeWithOrgInclude }>>>,
  evaluations: EvalWithScores[]
) {
  // 課長が存在する section_id の集合を取得
  const sectionIds = [...new Set(employees.map((e) => e.section_id).filter(Boolean))] as string[];
  const managedSections = sectionIds.length > 0
    ? await prisma.user.findMany({
        where: { section_id: { in: sectionIds }, role: "MANAGER", is_active: true, deleted_at: null },
        select: { section_id: true },
      })
    : [];
  const managedSectionSet = new Set(managedSections.map((m) => m.section_id));

  return employees.map((emp) => {
    const ev = evaluations.find((e) => e.employee_id === emp.id);
    const hasManager = emp.section_id ? managedSectionSet.has(emp.section_id) : false;
    return {
      evalId: ev?.id ?? null,
      employee: { ...emp, hasManager },
      status: ev?.status ?? null,
      scores: ev?.scores ?? [],
      skip_reason: ev?.skip_reason ?? null,
    };
  });
}

// リーダー: 担当課の全社員一覧（未開始含む）
export async function getLeaderEvaluationList(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["LEADER", "ADMIN"].includes(session.user.role)) forbidden();

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");

  const employees = await prisma.user.findMany({
    where: { group_id: me.group_id ?? undefined, deleted_at: null, is_active: true, role: { notIn: ["MANAGER", "DIRECTOR", "EXECUTIVE", "PRESIDENT", "ADMIN"] }, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
    include: employeeWithOrgInclude,
    orderBy: [{ employee_number: "asc" }, { name: "asc" }],
  });

  const evaluations = await prisma.evaluation.findMany({
    where: { period_id: periodId, employee_id: { in: employees.map((e) => e.id) } },
    include: evalWithScoresInclude,
  });

  return await mergeUsersWithEvaluations(employees, evaluations);
}

// 課長: 全評価をスキップして社長へ直送（育休・長期病欠など）
export async function skipEvaluation(periodId: string, employeeId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  await requireManagerOrDeptViewer(session.user.id, session.user.role);

  // 評価レコードがなければ作成する
  const existing = await prisma.evaluation.findUnique({
    where: { period_id_employee_id: { period_id: periodId, employee_id: employeeId } },
  });

  if (existing) {
    // すでに課長より先に進んでいる場合はスキップ不可
    const skipable = ["DRAFT", "SUBMITTED_TO_LEADER"].includes(existing.status) || existing.status === null;
    if (!skipable) throw new Error("この評価はすでに課長評価以降に進んでいるためスキップできません");
    await prisma.evaluation.update({
      where: { id: existing.id },
      data: { status: "SUBMITTED_TO_PRESIDENT", submitted_to_president_at: new Date(), skip_reason: reason },
    });
  } else {
    await prisma.evaluation.create({
      data: {
        period_id: periodId,
        employee_id: employeeId,
        status: "SUBMITTED_TO_PRESIDENT",
        submitted_to_president_at: new Date(),
        skip_reason: reason,
      },
    });
  }

  revalidatePath("/manager");
  revalidatePath("/president");
  return { ok: true };
}

// 課長: スキップを解除してDRAFTに戻す
export async function undoSkipEvaluation(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  await requireManagerOrDeptViewer(session.user.id, session.user.role);

  const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) throw new Error("評価が見つかりません");
  if (evaluation.status !== "SUBMITTED_TO_PRESIDENT") throw new Error("社長提出済み以外の評価は解除できません");

  await prisma.evaluation.update({
    where: { id: evaluationId },
    data: { status: "DRAFT", submitted_to_president_at: null, skip_reason: null },
  });

  revalidatePath("/manager");
  revalidatePath("/president");
  return { ok: true };
}

// 課長: 担当課の全社員一覧（未開始含む）
export async function getManagerEvaluationList(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) forbidden();

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");

  const employees = await prisma.user.findMany({
    where: { section_id: me.section_id ?? undefined, deleted_at: null, is_active: true, role: { notIn: ["DIRECTOR", "EXECUTIVE", "PRESIDENT", "ADMIN"] }, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
    include: employeeWithOrgInclude,
    orderBy: [{ employee_number: "asc" }, { name: "asc" }],
  });

  const evaluations = await prisma.evaluation.findMany({
    where: { period_id: periodId, employee_id: { in: employees.map((e) => e.id) } },
    include: evalWithScoresInclude,
  });

  return await mergeUsersWithEvaluations(employees, evaluations);
}

// 部長/執行役員: 担当部署の全社員一覧（未開始含む）
export async function getDirectorEvaluationList(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  const isDirectorRole = ["DIRECTOR", "ADMIN"].includes(session.user.role);
  if (!isDirectorRole) {
    const viewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { can_view_evaluations: true } });
    if (!viewer?.can_view_evaluations) forbidden();
  }

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");

  const employees = await prisma.user.findMany({
    where: { department_id: me.department_id ?? undefined, deleted_at: null, is_active: true, role: { notIn: ["EXECUTIVE", "PRESIDENT", "ADMIN"] }, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
    include: employeeWithOrgInclude,
    orderBy: [{ employee_number: "asc" }, { name: "asc" }],
  });

  const evaluations = await prisma.evaluation.findMany({
    where: { period_id: periodId, employee_id: { in: employees.map((e) => e.id) } },
    include: evalWithScoresInclude,
  });

  return await mergeUsersWithEvaluations(employees, evaluations);
}

// 課なし閲覧者: 自部署の全課の課長評価一覧（閲覧専用）
export async function getDeptViewerEvaluationList(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");
  if (!me.department_id) throw new Error("部署未所属");
  if (me.section_id) throw new Error("課所属ユーザーは使用不可");
  if (["DIRECTOR", "EXECUTIVE", "COUNSELOR", "PRESIDENT", "ADMIN", "MANAGER"].includes(me.role)) forbidden();

  const employees = await prisma.user.findMany({
    where: {
      department_id: me.department_id,
      deleted_at: null,
      is_active: true,
      role: { notIn: ["DIRECTOR", "EXECUTIVE", "COUNSELOR", "PRESIDENT", "ADMIN"] },
      employee_type: { not: "実習生" },
      department: { skip_evaluation: false },
    },
    include: employeeWithOrgInclude,
    orderBy: [{ section: { name: "asc" } }, { employee_number: "asc" }, { name: "asc" }],
  });

  const evaluations = await prisma.evaluation.findMany({
    where: { period_id: periodId, employee_id: { in: employees.map((e) => e.id) } },
    include: evalWithScoresInclude,
  });

  return await mergeUsersWithEvaluations(employees, evaluations);
}

// リーダー: 担当社員の評価一覧（SUBMITTED_TO_LEADER以降）
export async function getLeaderEvaluations(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["LEADER", "ADMIN"].includes(session.user.role)) forbidden();

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");

  return prisma.evaluation.findMany({
    where: {
      period_id: periodId,
      employee: { section_id: me.section_id ?? undefined, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
      status: { in: ["SUBMITTED_TO_LEADER", "SUBMITTED_TO_MANAGER", "SUBMITTED_TO_DIRECTOR", "SUBMITTED_TO_PRESIDENT", "COMPLETED"] },
    },
    include: { employee: { include: employeeWithOrgInclude }, scores: true, period: true },
    orderBy: { employee: { name: "asc" } },
  });
}

// 課長: 担当社員の評価一覧
export async function getManagerEvaluations(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["MANAGER", "ADMIN"].includes(session.user.role)) forbidden();

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");

  return prisma.evaluation.findMany({
    where: {
      period_id: periodId,
      employee: { section_id: me.section_id ?? undefined, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
      status: { in: ["SUBMITTED_TO_MANAGER", "SUBMITTED_TO_DIRECTOR", "SUBMITTED_TO_PRESIDENT", "COMPLETED"] },
    },
    include: { employee: { include: employeeWithOrgInclude }, scores: true, period: true },
    orderBy: { employee: { name: "asc" } },
  });
}

// 部長/執行役員: 担当部署の評価一覧（自分宛のステータスのみ）
export async function getDirectorEvaluations(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["DIRECTOR", "EXECUTIVE", "ADMIN"].includes(session.user.role)) forbidden();

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!me) throw new Error("ユーザー情報取得失敗");

  const isExecutive = session.user.role === "EXECUTIVE";
  const statuses = isExecutive
    ? ["SUBMITTED_TO_EXECUTIVE", "SUBMITTED_TO_PRESIDENT", "COMPLETED"] as ("SUBMITTED_TO_EXECUTIVE" | "SUBMITTED_TO_PRESIDENT" | "COMPLETED")[]
    : ["SUBMITTED_TO_DIRECTOR", "SUBMITTED_TO_PRESIDENT", "COMPLETED"] as ("SUBMITTED_TO_DIRECTOR" | "SUBMITTED_TO_PRESIDENT" | "COMPLETED")[];

  return prisma.evaluation.findMany({
    where: {
      period_id: periodId,
      employee: { department_id: me.department_id ?? undefined, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
      status: { in: statuses },
    },
    include: { employee: { include: employeeWithOrgInclude }, scores: true, period: true },
    orderBy: { employee: { name: "asc" } },
  });
}

// 社長: 全社員の評価一覧（未開始含む）
// 在籍中の社員は未開始でも表示、退職済みは評価データがある場合のみ表示
export async function getPresidentEvaluations(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["PRESIDENT", "ADMIN"].includes(session.user.role)) forbidden();

  // 在籍中の社員（未開始含めて表示）
  const activeEmployees = await prisma.user.findMany({
    where: { deleted_at: null, is_active: true, role: { notIn: ["PRESIDENT", "ADMIN"] }, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
    include: employeeWithOrgInclude,
    orderBy: [{ department: { name: "asc" } }, { employee_number: "asc" }, { name: "asc" }],
  });

  // 退職済み社員の評価（その期間に評価データがあるもの）
  const deletedEvaluations = await prisma.evaluation.findMany({
    where: {
      period_id: periodId,
      employee: { deleted_at: { not: null }, employee_type: { not: "実習生" }, department: { skip_evaluation: false } },
    },
    include: { employee: { include: employeeWithOrgInclude }, scores: true },
  });

  const evaluations = await prisma.evaluation.findMany({
    where: { period_id: periodId, employee_id: { in: activeEmployees.map((e) => e.id) } },
    include: evalWithScoresInclude,
  });

  const activeItems = await mergeUsersWithEvaluations(activeEmployees, evaluations);

  // 退職済み社員の評価を追加（重複しないように）
  const activeIds = new Set(activeEmployees.map((e) => e.id));
  const deletedItems = deletedEvaluations
    .filter((ev) => !activeIds.has(ev.employee_id))
    .map((ev) => ({
      evalId: ev.id,
      employee: { ...ev.employee, hasManager: undefined },
      status: ev.status,
      scores: ev.scores,
      skip_reason: ev.skip_reason ?? null,
    }));

  return [...activeItems, ...deletedItems];
}

// 管理者: 全評価一覧（admin閲覧用）
export async function getAdminEvaluations(periodId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");
  if (!["ADMIN", "PRESIDENT"].includes(session.user.role)) forbidden();

  return prisma.evaluation.findMany({
    where: { period_id: periodId },
    include: {
      employee: { include: employeeWithOrgInclude },
      scores: true,
      period: true,
    },
    orderBy: [{ employee: { department: { name: "asc" } } }, { employee: { name: "asc" } }],
  });
}

// 評価詳細を取得（IDから）
// 自分の過去の評価履歴を全期間取得
export async function getMyEvaluationHistory() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");

  return prisma.evaluation.findMany({
    where: { employee_id: session.user.id },
    include: {
      scores: true,
      period: true,
    },
    orderBy: { period: { start_date: "desc" } },
  });
}

export async function getEvaluationById(evaluationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未認証");

  return prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      employee: { include: employeeWithOrgInclude },
      scores: true,
      period: true,
    },
  });
}
