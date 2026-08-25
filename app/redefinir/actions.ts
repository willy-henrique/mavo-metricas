"use server";

import { z } from "zod";
import { TalkError, talkPost } from "@/lib/talk-client";

export type EstadoRedefinicao = {
  estado: "inicial" | "sucesso";
  erro: string | null;
};

const formulario = z
  .object({
    token: z.string().min(40).max(512).regex(/^[A-Za-z0-9_-]+$/),
    senha: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.").max(128),
    confirmacao: z.string().max(128),
  })
  .superRefine((dados, contexto) => {
    if (dados.senha !== dados.confirmacao) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmacao"],
        message: "As senhas não coincidem.",
      });
    }
  });

const respostaSchema = z.object({ reset: z.literal(true) });

export async function redefinirSenha(
  _estado: EstadoRedefinicao,
  dados: FormData,
): Promise<EstadoRedefinicao> {
  const analisado = formulario.safeParse({
    token: dados.get("token"),
    senha: dados.get("senha"),
    confirmacao: dados.get("confirmacao"),
  });
  if (!analisado.success) {
    return {
      estado: "inicial",
      erro: analisado.error.issues[0]?.message || "Revise os campos informados.",
    };
  }

  try {
    const resposta = await talkPost<unknown>("/auth/password/reset", {
      token: analisado.data.token,
      password: analisado.data.senha,
    });
    respostaSchema.parse(resposta.data);
    return { estado: "sucesso", erro: null };
  } catch (erro) {
    if (erro instanceof TalkError && erro.code === "rate_limited") {
      return { estado: "inicial", erro: "Muitas tentativas. Aguarde alguns minutos." };
    }
    if (erro instanceof TalkError && erro.code === "invalid_request") {
      return { estado: "inicial", erro: "Este link é inválido ou expirou. Peça um novo." };
    }
    return { estado: "inicial", erro: "Não foi possível alterar a senha agora. Tente novamente." };
  }
}
