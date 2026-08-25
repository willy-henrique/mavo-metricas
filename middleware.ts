import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nomeDoCookie = process.env.SESSION_COOKIE_NAME || "mavo_gerenciamento";
  if (request.cookies.get(nomeDoCookie)?.value) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("motivo", "sessao");
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/",
    "/equipe/:path*",
    "/automatico/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
  ],
};
