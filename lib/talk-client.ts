import "server-only";
import { env } from "@/lib/env";

const TIMEOUT_PADRAO_MS = 12_000;

export class TalkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TalkError";
  }
}

type OpcoesRequisicao = {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
};

type RespostaJson = {
  body: unknown;
};

function urlDoTalk(caminho: string): string {
  if (
    !caminho.startsWith("/") ||
    caminho.startsWith("//") ||
    caminho.includes("\\") ||
    caminho.includes("#") ||
    /[\r\n]/.test(caminho)
  ) {
    throw new TalkError("invalid_path", "Caminho interno do Talk inválido", 500);
  }

  try {
    const pathname = decodeURIComponent(caminho.split("?", 1)[0]);
    if (pathname.split("/").some((segmento) => segmento === "." || segmento === "..")) {
      throw new TalkError("invalid_path", "Caminho interno do Talk inválido", 500);
    }
  } catch (erro) {
    if (erro instanceof TalkError) throw erro;
    throw new TalkError("invalid_path", "Caminho interno do Talk inválido", 500);
  }

  return `${env.talkBaseUrl}/api/metrics/v1${caminho}`;
}

function headersDoTalk(token?: string, temCorpo = false): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    "x-mavo-service-token": env.metricsToken,
  };
  if (temCorpo) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function erroHttp(resposta: Response, body: unknown): TalkError {
  const envelope =
    typeof body === "object" && body !== null && "error" in body
      ? (body as { error?: unknown }).error
      : null;
  const detalhe = typeof envelope === "object" && envelope !== null ? envelope : {};
  const codeCandidate = (detalhe as { code?: unknown }).code;
  const messageCandidate = (detalhe as { message?: unknown }).message;
  const code =
    typeof codeCandidate === "string" && /^[a-z0-9_:-]{1,80}$/i.test(codeCandidate)
      ? codeCandidate
      : "upstream_error";
  const message =
    typeof messageCandidate === "string" && messageCandidate.trim()
      ? messageCandidate.trim().slice(0, 240)
      : "Não foi possível consultar o Mavo Talk";
  return new TalkError(code, message, resposta.status);
}

function erroDeTransporte(erro: unknown): TalkError {
  if (erro instanceof TalkError) return erro;
  const nome = erro instanceof Error ? erro.name : "";
  if (nome === "TimeoutError" || nome === "AbortError") {
    return new TalkError("timeout", "O Mavo Talk demorou para responder", 504);
  }
  if (erro instanceof TypeError) {
    return new TalkError("unavailable", "O Mavo Talk está temporariamente indisponível", 503);
  }
  return new TalkError("bad_gateway", "Não foi possível consultar o Mavo Talk", 502);
}

async function requisitarJson(
  caminho: string,
  opcoes: OpcoesRequisicao = {},
): Promise<RespostaJson> {
  let body: string | undefined;
  try {
    body = opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body);
  } catch {
    throw new TalkError("invalid_body", "Não foi possível preparar a requisição", 500);
  }

  try {
    const resposta = await fetch(urlDoTalk(caminho), {
      method: opcoes.method ?? "GET",
      headers: headersDoTalk(opcoes.token, body !== undefined),
      body,
      signal: AbortSignal.timeout(opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS),
      cache: "no-store",
    });

    let respostaBody: unknown;
    try {
      respostaBody = await resposta.json();
    } catch {
      throw new TalkError("bad_gateway", "O Mavo Talk enviou uma resposta inválida", 502);
    }
    if (!resposta.ok) throw erroHttp(resposta, respostaBody);
    return { body: respostaBody };
  } catch (erro) {
    throw erroDeTransporte(erro);
  }
}

function envelopeDeDados<T>(body: unknown): { data: T; meta: unknown } {
  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw new TalkError("bad_gateway", "O Mavo Talk enviou uma resposta incompleta", 502);
  }
  const envelope = body as { data: T; meta?: unknown };
  return { data: envelope.data, meta: envelope.meta ?? null };
}

export async function talkGet<T>(
  caminho: string,
  opcoes: { token?: string; timeoutMs?: number } = {},
): Promise<{ data: T; meta: unknown }> {
  const resposta = await requisitarJson(caminho, opcoes);
  return envelopeDeDados<T>(resposta.body);
}

export async function talkPost<T>(
  caminho: string,
  corpo: unknown,
  opcoes: { token?: string } = {},
): Promise<{ data: T }> {
  const resposta = await requisitarJson(caminho, {
    method: "POST",
    token: opcoes.token,
    body: corpo,
  });
  const envelope = envelopeDeDados<T>(resposta.body);
  return { data: envelope.data };
}

/** Acorda o Render sem sessão; indisponibilidade aqui não bloqueia a tela de login. */
export async function acordarTalk(): Promise<boolean> {
  try {
    await requisitarJson("/health", { timeoutMs: 60_000 });
    return true;
  } catch {
    return false;
  }
}
