CREATE TABLE "EmployeeRecord" (
  "id"                          TEXT NOT NULL,
  "user_id"                     TEXT NOT NULL,
  "employment_type"             TEXT,
  "hire_date"                   TIMESTAMP(3),
  "birth_date"                  TIMESTAMP(3),
  "gender"                      TEXT,
  "education"                   TEXT,
  "prev_annual_income"          INTEGER,
  "prev_base_salary"            INTEGER,
  "prev_position_allowance"     INTEGER,
  "prev_salary_increase"        INTEGER,
  "prev_summer_bonus"           INTEGER,
  "prev_summer_director_eval"   TEXT,
  "prev_summer_president_eval"  TEXT,
  "prev_winter_bonus"           INTEGER,
  "prev_winter_director_eval"   TEXT,
  "prev_winter_president_eval"  TEXT,
  "prev_notes"                  TEXT,
  "curr_base_salary"            INTEGER,
  "curr_position_allowance"     INTEGER,
  "curr_salary_increase"        INTEGER,
  "curr_summer_bonus"           INTEGER,
  "curr_summer_director_eval"   TEXT,
  "curr_summer_president_eval"  TEXT,
  "curr_winter_bonus"           INTEGER,
  "curr_winter_director_eval"   TEXT,
  "curr_winter_president_eval"  TEXT,
  "curr_notes"                  TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by"                  TEXT,
  "updated_by"                  TEXT,
  CONSTRAINT "EmployeeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeRecord_user_id_key" ON "EmployeeRecord"("user_id");

ALTER TABLE "EmployeeRecord" ADD CONSTRAINT "EmployeeRecord_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
