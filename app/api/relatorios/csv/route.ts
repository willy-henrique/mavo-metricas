import { NextResponse } from "next/server";
import { parametrosMetricas, type ParametrosBusca } from "@/lib/consulta-metricas";
import { formatarDecimal, formatarDuracao } from "@/lib/formato";
import {
  metricsMetaSchema,
  relatorioTicketsSchema,
  type LinhaRelatorioTicket,
  type MetricsMeta,
  type RelatorioTickets,
} from "@/lib/metricas";
import { lerSessao } from "@/lib/sessao";
import { TalkError, talkGet } from "@/lib/talk-client";

export const dynamic = "force-dynamic";

const MAX_CSV_ROWS = 5_000;
const PARAMETRO_PAGINA = "limite=200";

type PaginaValidada = { dados: RelatorioTickets; meta: MetricsMeta };

function erro(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buscaDaUrl(url: URL): ParametrosBusca {
  const entrada: ParametrosBusca = {};
  for (const [chave, valor] of url.searchParams) entrada[chave] = valor;
  return entrada;
}

async function buscarPagina(
  token: string,
  base: URLSearchParams,
  cursor: string | null,
): Promise<PaginaValidada> {
  const params = new URLSearchParams(PARAMETRO_PAGINA);
  for (const [chave, valor] of base) params.set(chave, valor);
  if (cursor) params.set("cursor", cursor);

  const resposta = await talkGet<unknown>(`/reports/tickets?${params.toString()}`, {
    token,
    timeoutMs: 20_000,
  });
  return {
    dados: relatorioTicketsSchema.parse(resposta.data),
    meta: metricsMetaSchema.parse(resposta.meta),
  };
}

function protegerFormula(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function campoCsv(valor: string | number | null): string {
  const texto = protegerFormula(valor === null ? "" : String(valor));
  return `"${texto.replaceAll('"', '""')}"`;
}

function rotuloStatus(status: string): string {
  const rotulos: Record<string, string> = {
    aguardando: "Na fila",
    em_atendimento: "Em atendimento",
    pendente_cliente: "Aguardando cliente",
    encerrado: "Encerrado",
  };
  return rotulos[status] ?? status.replaceAll("_", " ");
}

function serializarLinhas(linhas: LinhaRelatorioTicket[], timezone: string): string {
  const datas = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  return linhas
    .map((linha) =>
      [
        linha.id,
        datas.format(new Date(linha.criadoEm)),
        linha.encerradoEm ? datas.format(new Date(linha.encerradoEm)) : "",
        linha.contatoNome,
        linha.contatoTelefone,
        linha.fila,
        linha.atendente,
        rotuloStatus(linha.status),
        linha.motivoEncerramento,
        formatarDuracao(linha.tmeSegundos),
        formatarDuracao(linha.tmaSegundos),
        linha.slaEstourado ? "Sim" : "Não",
        linha.csat === null ? "" : formatarDecimal(linha.csat),
      ]
        .map(campoCsv)
        .join(";"),
    )
    .join("\r\n");
}

export async function GET(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return erro("unauthenticated", "Sessão expirada", 401);

  const url = new URL(request.url);
  const base = parametrosMetricas(buscaDaUrl(url));

  let primeira: PaginaValidada;
  try {
    primeira = await buscarPagina(sessao.token, base, null);
  } catch (falha) {
    if (falha instanceof TalkError && (falha.status === 401 || falha.status === 403)) {
      return erro("unauthenticated", "Sessão expirada", 401);
    }
    return erro("upstream_unavailable", "Não foi possível preparar o CSV", 503);
  }

  const encoder = new TextEncoder();
  const cabecalho = [
    "Ticket",
    "Criado em",
    "Encerrado em",
    "Contato",
    "WhatsApp",
    "Fila",
    "Atendente",
    "Status",
    "Motivo do encerramento",
    "TME",
    "TMA",
    "SLA estourado",
    "CSAT",
  ]
    .map(campoCsv)
    .join(";");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\uFEFFsep=;\r\n${cabecalho}\r\n`));
        let pagina = primeira;
        let exportadas = 0;
        const cursoresVisitados = new Set<string>();

        while (exportadas < MAX_CSV_ROWS) {
          const restantes = MAX_CSV_ROWS - exportadas;
          const linhas = pagina.dados.linhas.slice(0, restantes);
          if (linhas.length > 0) {
            controller.enqueue(
              encoder.encode(`${serializarLinhas(linhas, primeira.meta.timezone)}\r\n`),
            );
            exportadas += linhas.length;
          }

          const proximoCursor = pagina.dados.proximoCursor;
          if (!proximoCursor || exportadas >= MAX_CSV_ROWS || linhas.length === 0) break;
          if (cursoresVisitados.has(proximoCursor)) {
            throw new Error("O Talk repetiu o cursor do relatório");
          }
          cursoresVisitados.add(proximoCursor);
          pagina = await buscarPagina(sessao.token, base, proximoCursor);
        }
        controller.close();
      } catch (falha) {
        controller.error(falha instanceof Error ? falha : new Error("Exportação interrompida"));
      }
    },
  });

  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="mavo-tickets-${hoje}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
