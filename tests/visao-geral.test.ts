import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a visao geral busca as fontes operacionais e de clientes em paralelo", async () => {
  const fonte = await readFile("app/(painel)/page.tsx", "utf8");
  assert.match(fonte, /Promise\.all/);
  assert.match(fonte, /\/overview/);
  assert.match(fonte, /\/timeseries/);
  assert.match(fonte, /\/filters/);
  assert.match(fonte, /\/live/);
  assert.match(fonte, /\/customers/);
});

test("a pagina trata o Talk hibernando sem quebrar", async () => {
  const fonte = await readFile("app/(painel)/page.tsx", "utf8");
  assert.match(fonte, /catch/);
  assert.match(fonte, /acordando|indisponível|Mavo Talk/i);
});

test("todos os contratos HTTP sao validados antes de renderizar", async () => {
  const fonte = await readFile("app/(painel)/page.tsx", "utf8");
  assert.match(fonte, /snapshotAgoraSchema\.parse/);
  assert.match(fonte, /overviewSchema\.parse/);
  assert.match(fonte, /serieTemporalSchema\.parse/);
  assert.match(fonte, /opcoesContextoSchema\.parse/);
  assert.match(fonte, /metricasClientesSchema\.parse/);
});

test("a visao geral mostra recorrencia e quem mais abriu chamados", async () => {
  const pagina = await readFile("app/(painel)/page.tsx", "utf8");
  const painel = await readFile("components/painel-clientes.tsx", "utf8");
  assert.match(pagina, /PainelClientes/);
  assert.match(painel, /Quem mais abriu chamados/);
  assert.match(painel, /Clientes atendidos/);
  assert.match(painel, /Recorrentes/);
  assert.match(painel, /Precisam de atenção/);
  assert.match(painel, /SLA/);
  assert.match(painel, /nota baixa/);
});

test("os graficos nao codificam informacao so por cor", async () => {
  const fonte = await readFile("components/ritmo-periodo.tsx", "utf8");
  assert.match(fonte, /aria-label|<title|role="img"/);
  assert.match(fonte, /Pico/);
  assert.match(fonte, /mensagens/);
});

test("os numeros usam a classe tabular", async () => {
  const heroi = await readFile("components/metrica-heroi.tsx", "utf8");
  const secundaria = await readFile("components/metrica-secundaria.tsx", "utf8");
  assert.match(heroi, /className="numero"/);
  assert.match(secundaria, /className="numero"/);
});

test("componentes do periodo usam apenas tokens de cor", async () => {
  for (const arquivo of [
    "components/metrica-heroi.module.css",
    "components/metrica-secundaria.module.css",
    "components/ritmo-periodo.module.css",
  ]) {
    const fonte = await readFile(arquivo, "utf8");
    assert.doesNotMatch(fonte, /#[\da-f]{3,8}\b/i, `${arquivo} contém cor fora dos tokens`);
  }
});
