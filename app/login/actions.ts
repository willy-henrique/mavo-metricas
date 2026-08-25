"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { gravarSessao } from "@/lib/sessao";
import { TalkError, talkPost } from "@/lib/talk-client";

export type EstadoLogin = { erro: string | null };

const formulario = z.object({
  email: z.string().trim().email().max(254),
  senha: z.string().min(1).max(200),
});

type RespostaLogin = { token: string; expiresAt: string };

export async function entrar(_estado: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const analisado = formulario.safeParse({
    email: dados.get("email"),
    senha: dados.get("senha"),
  });
  if (!analisado.success) {
    return { erro: "Preencha um e-mail válido e a sua senha." };
  }

  try {
    const { data } = await talkPost<RespostaLogin>("/auth/login", {
      email: analisado.data.email,
      password: analisado.data.senha,
    });
    await gravarSessao(data.token, data.expiresAt);
  } catch (erro) {
    if (erro instanceof TalkError && erro.code === "forbidden") {
      return { erro: "Esta conta não tem acesso ao painel de gestão." };
    }
    if (erro instanceof TalkError && erro.code === "rate_limited") {
      return { erro: "Muitas tentativas. Aguarde um minuto e tente novamente." };
    }
    if (erro instanceof TalkError && erro.status === 401) {
      return { erro: "E-mail ou senha inválidos." };
    }
    if (erro instanceof TalkError && erro.code === "timeout") {
      return { erro: "O servidor demorou para responder. Tente novamente em instantes." };
    }
    return { erro: "O Mavo Talk não respondeu. Tente novamente em instantes." };
  }

  redirect("/");
}
