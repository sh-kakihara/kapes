-- AddColumn section2_id to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "section2_id" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_section2_id_fkey" FOREIGN KEY ("section2_id") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
