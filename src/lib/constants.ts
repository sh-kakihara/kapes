export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理者",
  PRESIDENT: "社長",
  EXECUTIVE: "顧問",
  DIRECTOR: "部長",
  MANAGER: "課長",
  LEADER: "リーダー",
  STAFF: "社員",
};

export const STATUS_LABELS: Record<string, string> = {
  NO_EVAL: "自己評価未入力",
  DRAFT: "自己評価入力中",
  SUBMITTED_TO_LEADER: "リーダー入力中",
  SUBMITTED_TO_MANAGER: "課長入力中",
  SUBMITTED_TO_DIRECTOR: "部長入力中",
  SUBMITTED_TO_EXECUTIVE: "顧問入力中",
  SUBMITTED_TO_PRESIDENT: "社長",
  COMPLETED: "完了",
};

export const STATUS_COLORS: Record<string, string> = {
  NO_EVAL: "bg-gray-100 text-gray-400",
  DRAFT: "bg-yellow-100 text-yellow-700",
  SUBMITTED_TO_LEADER: "bg-orange-100 text-orange-700",
  SUBMITTED_TO_MANAGER: "bg-blue-100 text-blue-700",
  SUBMITTED_TO_DIRECTOR: "bg-purple-100 text-purple-700",
  SUBMITTED_TO_EXECUTIVE: "bg-indigo-100 text-indigo-700",
  SUBMITTED_TO_PRESIDENT: "bg-green-100 text-green-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

export const EVALUATION_ITEMS = [
  { code: "ITEM_01", label: "上司・部下への姿勢", description: "上司を積極的に助け、部下や後輩に対しては適切な教育・指導・育成ができているか？" },
  { code: "ITEM_02", label: "仕事に対する勤勉・努力指導性", description: "遅刻、早退、欠勤、その他の勤務態度に問題はないか？社会人として常識的な行動、自己管理ができているか？社会の規則、ルール、マナーを正しく理解し、適切に行動できているか？" },
  { code: "ITEM_03", label: "勤怠及び勤務態度", description: "業務内容を正確に理解・把握し、効率的に作業が出来ているか？困難な場面、問題が発生した場合も問題なく業務を遂行出来ているか？" },
  { code: "ITEM_04", label: "仕事の成果", description: "自分の立場でやらなければならない事に対して責任感を持ち、その場の気分や雰囲気に流される事無く役割を果たしているか？" },
  { code: "ITEM_05", label: "仕事に対する適応性", description: "経験年数に応じた技術力、幅広い（あるいは深い）知識を備え、業務において発揮できているか？" },
  { code: "ITEM_06", label: "業務の知識・技能", description: "業務において発生する問題（障害発生、人間関係、工程遅延など）に対して、適切な判断ができているか？また問題をスムーズに解決するための調整を行い適切に対処できているか？" },
  { code: "ITEM_07", label: "判断力", description: "他人と協力し目的の達成の為の良好なコミュニケーション、十分な協調性を持って行動できているか？上司や同僚への接し方、態度も問題ないか？" },
  { code: "ITEM_08", label: "協調性", description: "自ら進んで業務の効率化や改善につながることを考え、会社に有益となる行動をすることができているか？" },
  { code: "ITEM_09", label: "企画力・研究心", description: "積極的に新しいスキルや知識の習得に努めているか？" },
  { code: "ITEM_10", label: "積極性・将来性", description: "「強く、良い会社」を目指す全社方針に前向きに協力しているか？" },
  { code: "ITEM_11", label: "会社への協力性・所属部門目標達成度", description: "所属部門で立てた目標を達成できているか？" },
] as const;

export type EvaluationItemCode = typeof EVALUATION_ITEMS[number]["code"];
