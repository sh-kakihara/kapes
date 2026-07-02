import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
        token.login_id = (user as { login_id: string }).login_id;
        token.name = user.name;
        token.is_first_login = (user as { is_first_login: boolean }).is_first_login;
        token.employee_number = (user as { employee_number: string | null }).employee_number;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.login_id = token.login_id as string;
        session.user.name = token.name as string;
        session.user.is_first_login = token.is_first_login as boolean;
        session.user.employee_number = token.employee_number as string | null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
