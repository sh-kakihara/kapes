import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        login_id: { label: "ログインID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (credentials) => {
        const loginId = credentials?.login_id as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!loginId || !password) return null;

        const user = await prisma.user.findFirst({
          where: { login_id: loginId, is_active: true, deleted_at: null },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { last_login_at: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          login_id: user.login_id,
          employee_number: user.employee_number,
          role: user.role,
          is_first_login: user.is_first_login,
        };
      },
    }),
  ],
});
