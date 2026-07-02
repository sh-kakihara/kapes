ALTER TABLE "AttendanceRecord"
  ADD COLUMN IF NOT EXISTS "base_salary"        DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "position_allowance" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "payment_amount"     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "notes"              TEXT;
