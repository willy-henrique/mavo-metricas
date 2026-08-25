"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { usuarioGerenciadoSchema } from "@/lib/metricas";
import { lerSessao } from "@/lib/sessao";
import { TalkError, talkDelete, talkPatch, talkPost } from "@/lib/talk-client";

export type EstadoUsuario = { erro: string | null; sucesso: string | null };

const telefone = z
  .string()
  .trim()
  .max(30)
  .transform((valor) => valor.replace(/\D/g, ""))
  .refine((valor) => valor === "" || /^[0-9]{10,15}$/.test(valor), "WhatsApp inválido");

const criarSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo.").max(120),
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    password: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.").max(128),
    role: z.enum(["admin", "gestor", "atendente"]),
    recoveryPhone: telefone,
  })
  .superRefine((dados, contexto) => {
    if (dados.role !== "atendente" && !dados.recoveryPhone) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recoveryPhone"],
        message: "Informe o WhatsApp de recuperação.",
      });
    }
  });

const editarSchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().trim().min(2, "Informe o nome completo.").max(120),
    email: z.string().trim().email("Informe um e-mail válido.").max(254),
    password: z.string().max(128),
    role: z.enum(["admin", "gestor", "atendente"]),
    recoveryPhone: telefone,
  })
  .superRefine((dados, contexto) => {
    if (dados.password && dados.password.length < 10) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "A nova senha precisa ter ao menos 10 caracteres.",
      });
    }
    if (dados.role !== "atendente" && !dados.recoveryPhone) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recoveryPhone"],
        message: "Informe o WhatsApp de recuperação.",
      });
    }
  });

function falha(erro: unknown): EstadoUsuario {
  if (erro instanceof TalkError && erro.code === "conflict") {
    return { erro: "Este e-mail já está em uso ou a última conta admin seria removida.", sucesso: null };
  }
  if (erro instanceof TalkError && erro.code === "invalid_request") {
    return { erro: "Não foi possível aplicar a alteração. Revise os dados e as permissões.", sucesso: null };
  }
  if (erro instanceof TalkError && erro.code === "not_found") {
    return { erro: "Esta conta não existe mais.", sucesso: null };
  }
  if (erro instanceof TalkError && erro.status === 403) {
    return { erro: "Somente administradores podem gerenciar contas.", sucesso: null };
  }
  return { erro: "O Mavo Talk não concluiu a operação. Tente novamente.", sucesso: null };
}

async function tokenAdmin(): Promise<string | null> {
  const sessao = await lerSessao();
  return sessao?.role === "admin" ? sessao.token : null;
}

export async function criarUsuario(
  _estado: EstadoUsuario,
  dados: FormData,
): Promise<EstadoUsuario> {
  const analisado = criarSchema.safeParse({
    name: dados.get("name"),
    email: dados.get("email"),
    password: dados.get("password"),
    role: dados.get("role"),
    recoveryPhone: dados.get("recoveryPhone") ?? "",
  });
  if (!analisado.success) {
    return { erro: analisado.error.issues[0]?.message || "Revise os dados.", sucesso: null };
  }
  const token = await tokenAdmin();
  if (!token) return { erro: "Sua sessão administrativa expirou.", sucesso: null };

  try {
    const resposta = await talkPost<unknown>("/users", {
      ...analisado.data,
      recoveryPhone:
        analisado.data.role === "atendente" ? null : analisado.data.recoveryPhone,
    }, { token });
    usuarioGerenciadoSchema.parse((resposta.data as { user?: unknown })?.user);
    revalidatePath("/configuracoes");
    return { erro: null, sucesso: "Conta criada com sucesso." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function atualizarUsuario(
  _estado: EstadoUsuario,
  dados: FormData,
): Promise<EstadoUsuario> {
  const analisado = editarSchema.safeParse({
    id: dados.get("id"),
    name: dados.get("name"),
    email: dados.get("email"),
    password: dados.get("password"),
    role: dados.get("role"),
    recoveryPhone: dados.get("recoveryPhone") ?? "",
  });
  if (!analisado.success) {
    return { erro: analisado.error.issues[0]?.message || "Revise os dados.", sucesso: null };
  }
  const token = await tokenAdmin();
  if (!token) return { erro: "Sua sessão administrativa expirou.", sucesso: null };

  const { id, password, ...campos } = analisado.data;
  const corpo: Record<string, unknown> = {
    ...campos,
    recoveryPhone: campos.role === "atendente" ? null : campos.recoveryPhone,
  };
  if (password) corpo.password = password;

  try {
    const resposta = await talkPatch<unknown>(`/users/${encodeURIComponent(id)}`, corpo, { token });
    usuarioGerenciadoSchema.parse((resposta.data as { user?: unknown })?.user);
    revalidatePath("/configuracoes");
    return { erro: null, sucesso: "Alterações salvas." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function alterarStatusUsuario(
  _estado: EstadoUsuario,
  dados: FormData,
): Promise<EstadoUsuario> {
  const id = z.string().min(1).max(160).safeParse(dados.get("id"));
  const acao = z.enum(["desativar", "reativar"]).safeParse(dados.get("acao"));
  if (!id.success || !acao.success) return { erro: "Conta inválida.", sucesso: null };
  const token = await tokenAdmin();
  if (!token) return { erro: "Sua sessão administrativa expirou.", sucesso: null };

  try {
    const resposta = acao.data === "desativar"
      ? await talkDelete<unknown>(`/users/${encodeURIComponent(id.data)}`, { token })
      : await talkPatch<unknown>(`/users/${encodeURIComponent(id.data)}`, { isActive: true }, { token });
    usuarioGerenciadoSchema.parse((resposta.data as { user?: unknown })?.user);
    revalidatePath("/configuracoes");
    return {
      erro: null,
      sucesso: acao.data === "desativar" ? "Acesso desativado." : "Acesso reativado.",
    };
  } catch (erro) {
    return falha(erro);
  }
}
