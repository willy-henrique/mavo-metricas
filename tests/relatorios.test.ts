import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("relatorios carregam tabela, clientes, filas e filtros em paralelo", async () => {
  const fonte = await readFile("app/(painel)/relatorios/page.tsx", "utf8");
  assert.match(fonte, /Promise\.all/);
  assert.match(fonte, /\/reports\/tickets/);
  assert.match(fonte, /\/queues/);
  assert.match(fonte, /\/customers/);
  assert.match(fonte, /\/filters/);
  assert.match(fonte, /TabelaRelatorio/);
  assert.match(fonte, /PainelClientes/);
});

test("tela valida todas as respostas vindas do Talk", async () => {
  const fonte = await readFile("app/(painel)/relatorios/page.tsx", "utf8");
  assert.match(fonte, /relatorioTicketsSchema\.parse/);
  assert.match(fonte, /metricasFilasSchema\.parse/);
  assert.match(fonte, /metricasClientesSchema\.parse/);
  assert.match(fonte, /opcoesContextoSchema\.parse/);
  assert.match(fonte, /metricsMetaSchema\.parse/);
});

test("relatorios mostram recorrencia e quem mais abriu chamados", async () => {
  const painel = await readFile("components/painel-clientes.tsx", "utf8");
  assert.match(painel, /Quem mais abriu chamados/);
  assert.match(painel, /Clientes atendidos/);
  assert.match(painel, /Recorrentes/);
  assert.match(painel, /Precisam de atenção/);
  assert.match(painel, /SLA/);
  assert.match(painel, /nota baixa/);
});

test("navegacao responde imediatamente enquanto a rota carrega", async () => {
  const [nav, loading, css] = await Promise.all([
    readFile("components/nav-topo.tsx", "utf8"),
    readFile("app/(painel)/loading.tsx", "utf8"),
    readFile("components/nav-topo.module.css", "utf8"),
  ]);
  assert.match(nav, /router\.push/);
  assert.match(nav, /data-carregando/);
  assert.match(nav, /role="status"/);
  assert.match(loading, /Abrindo o painel/);
  assert.match(css, /progressoNavegacao/);
});

test("tabela tem cabecalho acessivel, vazio honesto e paginacao por cursor", async () => {
  const fonte = await readFile("components/tabela-relatorio.tsx", "utf8");
  assert.match(fonte, /<table/);
  assert.match(fonte, /scope="col"/);
  assert.match(fonte, /scope="row"/);
  assert.match(fonte, /proximoCursor/);
  assert.match(fonte, /Nenhum ticket/);
});

test("exportacao CSV exige sessao e respeita os filtros da URL", async () => {
  const fonte = await readFile("app/api/relatorios/csv/route.ts", "utf8");
  assert.match(fonte, /lerSessao/);
  assert.match(fonte, /401/);
  assert.match(fonte, /parametrosMetricas/);
  assert.match(fonte, /\/reports\/tickets/);
});

test("CSV pagina por cursor ate o teto de 5000 linhas", async () => {
  const fonte = await readFile("app/api/relatorios/csv/route.ts", "utf8");
  assert.match(fonte, /MAX_CSV_ROWS\s*=\s*5_000/);
  assert.match(fonte, /proximoCursor/);
  assert.match(fonte, /while\s*\(/);
  assert.match(fonte, /limite=200/);
});

test("CSV usa streaming, BOM UTF-8 e formato amigavel ao Excel brasileiro", async () => {
  const fonte = await readFile("app/api/relatorios/csv/route.ts", "utf8");
  assert.match(fonte, /ReadableStream/);
  assert.match(fonte, /TextEncoder/);
  assert.match(fonte, /\\uFEFF/);
  assert.match(fonte, /text\/csv; charset=utf-8/);
  assert.match(fonte, /Content-Disposition/);
  assert.match(fonte, /;/);
});

test("navegacao libera a tela de relatorios", async () => {
  const fonte = await readFile("components/nav-topo.tsx", "utf8");
  assert.match(
    fonte,
    /\{ chave: "relatorios", rotulo: "Relatórios", href: "\/relatorios", disponivel: true \}/,
  );
});
