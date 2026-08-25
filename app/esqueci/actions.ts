"use server";

import { z } from "zod";
import { TalkError, talkPost } from "@/lib/talk-client";

export type EstadoPedidoRecuperacao = {
  estado: "inicial" | "sucesso";
  erro: string | null;
};

const formulario = z.object({
  email: z.string().trim().email().max(254),
});

const respostaSchema = z.object({ accepted: z.literal(true) });

export async function solicitarRecuperacao(
  _estado: EstadoPedidoRecuperacao,
  dados: FormData,
): Promise<EstadoPedidoRecuperacao> {
  const analisado = formulario.safeParse({ email: dados.get("email") });
  if (!analisado.success) {
    return { estado: "inicial", erro: "Informe um e-mail válido." };
  }

  try {
    const resposta = await talkPost<unknown>("/auth/password/forgot", {
      email: analisado.data.email,
    });
    respostaSchema.parse(resposta.data);
    return { estado: "sucesso", erro: null };
  } catch (erro) {
    if (erro instanceof TalkError && erro.code === "rate_limited") {
      return {
        estado: "inicial",
        erro: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
      };
    }
    if (erro instanceof TalkError && erro.code === "timeout") {
      return { estado: "inicial", erro: "O servidor demorou para responder. Tente novamente." };
    }
    return { estado: "inicial", erro: "Não foi possível fazer o pedido agora. Tente novamente." };
  }
}
