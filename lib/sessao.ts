import "server-only";
import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { env } from "@/lib/env";

export type PerfilSessao = {
  token: string;
  userId: string;
  organizationId: string;
  role: "admin" | "gestor";
  name: string;
  email: string;
};

type ClaimsSessao = Omit<PerfilSessao, "token"> & { expiraEmMs: number };

function textoObrigatorio(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Decodificação local serve apenas à UI; a verificação criptográfica pertence ao Talk. */
function claimsDaSessao(token: string): ClaimsSessao | null {
  try {
    const carga = decodeJwt(token) as Record<string, unknown>;
    const userId = textoObrigatorio(carga.userId);
    const organizationId = textoObrigatorio(carga.organizationId);
    const name = textoObrigatorio(carga.name);
    const email = textoObrigatorio(carga.email);
    const role = carga.role;
    const expiraEmMs = typeof carga.exp === "number" ? carga.exp * 1000 : Number.NaN;

    if (!userId || !organizationId || !name || !email) return null;
    if (role !== "admin" && role !== "gestor") return null;
    if (!Number.isFinite(expiraEmMs) || expiraEmMs <= Date.now()) return null;

    return { userId, organizationId, role, name, email, expiraEmMs };
  } catch {
    return null;
  }
}

export async function gravarSessao(token: string, expiraEm: string): Promise<void> {
  const claims = claimsDaSessao(token);
  const expiracaoDeclaradaMs = Date.parse(expiraEm);
  if (!claims || !Number.isFinite(expiracaoDeclaradaMs) || expiracaoDeclaradaMs <= Date.now()) {
    throw new Error("Sessão recebida é inválida");
  }

  const store = await cookies();
  store.set(env.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Math.min(expiracaoDeclaradaMs, claims.expiraEmMs)),
  });
}

export async function lerSessao(): Promise<PerfilSessao | null> {
  const store = await cookies();
  const token = store.get(env.cookieName)?.value;
  if (!token) return null;

  const claims = claimsDaSessao(token);
  if (!claims) return null;
  return {
    token,
    userId: claims.userId,
    organizationId: claims.organizationId,
    role: claims.role,
    name: claims.name,
    email: claims.email,
  };
}

export async function encerrarSessao(): Promise<void> {
  const store = await cookies();
  store.delete({ name: env.cookieName, path: "/" });
}
