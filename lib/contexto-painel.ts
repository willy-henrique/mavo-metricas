import "server-only";
import { cache } from "react";
import { lerSessao, type PerfilSessao } from "@/lib/sessao";
import { TalkError, talkGet } from "@/lib/talk-client";

type PerfilRemoto = {
  user: { id: string; name: string; email: string; role: "admin" | "gestor" };
  organization: { id: string; name: string; timezone: string };
};

export type ContextoPainel =
  | { estado: "anonimo" }
  | { estado: "invalido" }
  | { estado: "indisponivel"; sessao: PerfilSessao }
  | { estado: "pronto"; sessao: PerfilSessao; perfil: PerfilRemoto };

function perfilValido(perfil: PerfilRemoto): boolean {
  return Boolean(
    perfil?.user?.id &&
      perfil.user.name &&
      perfil.organization?.id &&
      perfil.organization.name &&
      perfil.organization.timezone,
  );
}

/** Modelo de contexto do BFF, deduplicado entre layout e página na mesma renderização. */
export const carregarContextoPainel = cache(async (): Promise<ContextoPainel> => {
  const sessao = await lerSessao();
  if (!sessao) return { estado: "anonimo" };

  try {
    const { data: perfil } = await talkGet<PerfilRemoto>("/me", { token: sessao.token });
    if (!perfilValido(perfil)) return { estado: "indisponivel", sessao };
    return { estado: "pronto", sessao, perfil };
  } catch (erro) {
    if (erro instanceof TalkError && (erro.status === 401 || erro.status === 403)) {
      return { estado: "invalido" };
    }
    return { estado: "indisponivel", sessao };
  }
});
