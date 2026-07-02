-- CreateTable: AttendancePeriod
CREATE TABLE "AttendancePeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_key" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "AttendancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AttendanceRecord
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "employee_number" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "work_days" DECIMAL(8,2),
    "paid_leave_days" DECIMAL(8,2),
    "absent_days" DECIMAL(8,2),
    "late_early_hours" DECIMAL(8,2),
    "overtime_hours" DECIMAL(8,2),
    "night_overtime_hours" DECIMAL(8,2),
    "holiday_hours" DECIMAL(8,2),
    "legal_holiday_hours" DECIMAL(8,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePeriod_name_key" ON "AttendancePeriod"("name");
CREATE UNIQUE INDEX "AttendanceRecord_period_id_employee_number_key" ON "AttendanceRecord"("period_id", "employee_number");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "AttendancePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
