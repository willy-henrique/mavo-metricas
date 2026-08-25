import { NextResponse } from "next/server";
import { snapshotAgoraSchema } from "@/lib/metricas";
import { lerSessao } from "@/lib/sessao";
import { TalkError, talkGet } from "@/lib/talk-client";

export const dynamic = "force-dynamic";

function erro(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return erro("unauthenticated", "Sessão expirada", 401);

  try {
    const { data } = await talkGet<unknown>("/live", {
      token: sessao.token,
      timeoutMs: 8_000,
    });
    const snapshot = snapshotAgoraSchema.safeParse(data);
    if (!snapshot.success) {
      return erro("bad_gateway", "O Mavo Talk enviou dados incompletos", 502);
    }
    return NextResponse.json(snapshot.data, {
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (falha) {
    if (falha instanceof TalkError && falha.status === 401) {
      return erro("unauthenticated", "Sessão expirada", 401);
    }
    if (falha instanceof TalkError && falha.status === 429) {
      return erro("rate_limited", "Atualizações temporariamente limitadas", 429);
    }
    return erro("unavailable", "Estado atual temporariamente indisponível", 503);
  }
}
