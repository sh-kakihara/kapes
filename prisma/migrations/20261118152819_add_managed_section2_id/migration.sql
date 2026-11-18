ALTER TABLE "User" ADD COLUMN "managed_section2_id" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_managed_section2_id_fkey"
  FOREIGN KEY ("managed_section2_id") REFERENCES "Section"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
