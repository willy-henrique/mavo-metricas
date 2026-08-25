import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parametrosMetricas, type ParametrosBusca } from "@/lib/consulta-metricas";
import { formatarDecimal, formatarDuracao, formatarNumero } from "@/lib/formato";
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
export const runtime = "nodejs";

const MAX_PDF_ROWS = 1_000;
const LINHAS_POR_PAGINA = 22;
const A4_PAISAGEM: [number, number] = [841.89, 595.28];

type PaginaValidada = { dados: RelatorioTickets; meta: MetricsMeta };

const CORES = {
  primary: rgb(0.424, 0.361, 0.906),
  primarySoft: rgb(0.933, 0.922, 1),
  ink: rgb(0.09, 0.102, 0.18),
  muted: rgb(0.4, 0.43, 0.52),
  line: rgb(0.87, 0.88, 0.92),
  surfaceSoft: rgb(0.965, 0.969, 0.984),
  success: rgb(0.09, 0.57, 0.39),
  danger: rgb(0.84, 0.29, 0.36),
};

const COLUNAS = [
  { titulo: "Contato / ticket", largura: 148 },
  { titulo: "Criado em", largura: 78 },
  { titulo: "Fila", largura: 82 },
  { titulo: "Atendente", largura: 88 },
  { titulo: "Status", largura: 78 },
  { titulo: "TME", largura: 56 },
  { titulo: "TMA", largura: 56 },
  { titulo: "SLA", largura: 55 },
  { titulo: "CSAT", largura: 43 },
] as const;

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
  const params = new URLSearchParams(base);
  params.set("limite", "200");
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

async function coletarLinhas(
  token: string,
  base: URLSearchParams,
): Promise<{ linhas: LinhaRelatorioTicket[]; meta: MetricsMeta; total: number }> {
  let pagina = await buscarPagina(token, base, null);
  const meta = pagina.meta;
  const total = pagina.dados.total;
  const linhas: LinhaRelatorioTicket[] = [];
  const cursoresVisitados = new Set<string>();

  while (linhas.length < MAX_PDF_ROWS) {
    linhas.push(...pagina.dados.linhas.slice(0, MAX_PDF_ROWS - linhas.length));
    const proximoCursor = pagina.dados.proximoCursor;
    if (!proximoCursor || pagina.dados.linhas.length === 0 || linhas.length >= MAX_PDF_ROWS) break;
    if (cursoresVisitados.has(proximoCursor)) throw new Error("Cursor repetido pelo Mavo Talk");
    cursoresVisitados.add(proximoCursor);
    pagina = await buscarPagina(token, base, proximoCursor);
  }

  return { linhas, meta, total };
}

function textoPdf(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFKC")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function limitar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string {
  const seguro = textoPdf(texto);
  if (fonte.widthOfTextAtSize(seguro, tamanho) <= largura) return seguro;
  let reduzido = seguro;
  while (reduzido.length > 1 && fonte.widthOfTextAtSize(`${reduzido}...`, tamanho) > largura) {
    reduzido = reduzido.slice(0, -1);
  }
  return `${reduzido}...`;
}

function status(statusAtual: string): string {
  const rotulos: Record<string, string> = {
    aguardando: "Na fila",
    em_atendimento: "Em atendimento",
    pendente_cliente: "Aguardando cliente",
    encerrado: "Encerrado",
  };
  return rotulos[statusAtual] ?? statusAtual.replaceAll("_", " ");
}

function cabecalhoDocumento(
  page: PDFPage,
  fonte: PDFFont,
  negrito: PDFFont,
  meta: MetricsMeta,
  total: number,
  exportadas: number,
) {
  const [largura, altura] = A4_PAISAGEM;
  page.drawRectangle({ x: 0, y: altura - 96, width: largura, height: 96, color: CORES.primary });
  page.drawText("M", { x: 36, y: altura - 57, size: 20, font: negrito, color: rgb(1, 1, 1) });
  page.drawText("Mavo Gerenciamento", { x: 68, y: altura - 45, size: 17, font: negrito, color: rgb(1, 1, 1) });
  page.drawText("Relatorio operacional de tickets", { x: 68, y: altura - 63, size: 9, font: fonte, color: rgb(0.91, 0.89, 1) });

  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: meta.timezone });
  const periodo = `${data.format(new Date(meta.period.from))} a ${data.format(new Date(meta.period.to))}`;
  page.drawText(limitar(periodo, fonte, 8, 250), { x: largura - 286, y: altura - 43, size: 8, font: fonte, color: rgb(1, 1, 1) });
  page.drawText(`Gerado em ${data.format(new Date(meta.generatedAt))}`, { x: largura - 286, y: altura - 59, size: 8, font: fonte, color: rgb(0.91, 0.89, 1) });

  const cards = [
    ["Tickets no recorte", formatarNumero(total)],
    ["Linhas neste PDF", formatarNumero(exportadas)],
    ["Limite do documento", formatarNumero(MAX_PDF_ROWS)],
    ["Fuso da empresa", meta.timezone],
  ];
  cards.forEach(([rotulo, valor], indice) => {
    const x = 36 + indice * 190;
    page.drawRectangle({ x, y: altura - 145, width: 176, height: 35, color: CORES.surfaceSoft });
    page.drawText(textoPdf(rotulo), { x: x + 10, y: altura - 124, size: 7, font: fonte, color: CORES.muted });
    page.drawText(limitar(valor, negrito, 10, 156), { x: x + 10, y: altura - 140, size: 10, font: negrito, color: CORES.ink });
  });
}

function cabecalhoTabela(page: PDFPage, negrito: PDFFont, y: number) {
  page.drawRectangle({ x: 36, y: y - 5, width: 684, height: 22, color: CORES.primarySoft });
  let x = 42;
  for (const coluna of COLUNAS) {
    page.drawText(coluna.titulo, { x, y: y + 2, size: 7, font: negrito, color: CORES.primary });
    x += coluna.largura;
  }
}

function valoresLinha(
  linha: LinhaRelatorioTicket,
  datas: Intl.DateTimeFormat,
): string[] {
  return [
    `${linha.contatoNome}  #${linha.id.slice(0, 7)}`,
    datas.format(new Date(linha.criadoEm)),
    linha.fila,
    linha.atendente,
    status(linha.status),
    formatarDuracao(linha.tmeSegundos),
    formatarDuracao(linha.tmaSegundos),
    linha.slaEstourado ? "Estourado" : "No prazo",
    linha.csat === null ? "-" : formatarDecimal(linha.csat),
  ];
}

async function criarPdf(
  linhas: LinhaRelatorioTicket[],
  meta: MetricsMeta,
  total: number,
): Promise<Uint8Array> {
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  const negrito = await documento.embedFont(StandardFonts.HelveticaBold);
  documento.setTitle("Relatorio operacional - Mavo Gerenciamento");
  documento.setAuthor("Mavo Gerenciamento");
  documento.setProducer("Mavo Gerenciamento");
  documento.setCreationDate(new Date());

  const datas = new Intl.DateTimeFormat("pt-BR", {
    timeZone: meta.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / LINHAS_POR_PAGINA));

  for (let numeroPagina = 0; numeroPagina < totalPaginas; numeroPagina += 1) {
    const page = documento.addPage(A4_PAISAGEM);
    const primeiro = numeroPagina * LINHAS_POR_PAGINA;
    const paginaLinhas = linhas.slice(primeiro, primeiro + LINHAS_POR_PAGINA);
    if (numeroPagina === 0) cabecalhoDocumento(page, fonte, negrito, meta, total, linhas.length);
    else {
      page.drawText("Mavo Gerenciamento  /  Relatorio de tickets", { x: 36, y: 565, size: 10, font: negrito, color: CORES.ink });
    }

    const tabelaY = numeroPagina === 0 ? 418 : 532;
    cabecalhoTabela(page, negrito, tabelaY);
    paginaLinhas.forEach((linha, indice) => {
      const y = tabelaY - 22 - indice * 17;
      if (indice % 2 === 1) page.drawRectangle({ x: 36, y: y - 5, width: 684, height: 17, color: CORES.surfaceSoft });
      let x = 42;
      valoresLinha(linha, datas).forEach((valor, coluna) => {
        const largura = COLUNAS[coluna].largura - 8;
        const cor = coluna === 7 ? (linha.slaEstourado ? CORES.danger : CORES.success) : CORES.ink;
        page.drawText(limitar(valor, fonte, 6.8, largura), { x, y, size: 6.8, font: fonte, color: cor });
        x += COLUNAS[coluna].largura;
      });
      page.drawLine({ start: { x: 36, y: y - 6 }, end: { x: 720, y: y - 6 }, thickness: 0.35, color: CORES.line });
    });

    const observacao = total > MAX_PDF_ROWS
      ? `Documento limitado as ${formatarNumero(MAX_PDF_ROWS)} linhas mais recentes. Use CSV para a base completa.`
      : "Documento gerado com os filtros aplicados no painel.";
    page.drawText(textoPdf(observacao), { x: 36, y: 21, size: 7, font: fonte, color: CORES.muted });
    page.drawText(`${numeroPagina + 1} / ${totalPaginas}`, { x: 770, y: 21, size: 7, font: fonte, color: CORES.muted });
  }

  return documento.save();
}

export async function GET(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return erro("unauthenticated", "Sessão expirada", 401);

  const url = new URL(request.url);
  const base = parametrosMetricas(buscaDaUrl(url));

  try {
    const { linhas, meta, total } = await coletarLinhas(sessao.token, base);
    const pdf = await criarPdf(linhas, meta, total);
    const hoje = new Date().toISOString().slice(0, 10);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="mavo-relatorio-${hoje}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (falha) {
    if (falha instanceof TalkError && (falha.status === 401 || falha.status === 403)) {
      return erro("unauthenticated", "Sessão expirada", 401);
    }
    return erro("upstream_unavailable", "Não foi possível preparar o PDF", 503);
  }
}
