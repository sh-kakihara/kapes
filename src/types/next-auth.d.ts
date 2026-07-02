import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      login_id: string;
      is_first_login: boolean;
      employee_number: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    login_id: string;
    is_first_login: boolean;
    employee_number: string | null;
  }
}
