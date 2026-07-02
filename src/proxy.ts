import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === "/login";
  const isResetPage = nextUrl.pathname === "/reset-password";
  const isFirstLoginPage = nextUrl.pathname === "/first-login";

  if (isLoginPage) {
    if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
    return;
  }

  if (isResetPage) return; // 未ログインでも閲覧可

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return Response.redirect(loginUrl);
  }

  // 初回ログインユーザーは設定ページへ強制リダイレクト
  const isFirstLogin = (req.auth as { user?: { is_first_login?: boolean } })?.user?.is_first_login;
  if (isFirstLogin && !isFirstLoginPage) {
    return Response.redirect(new URL("/first-login", nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
