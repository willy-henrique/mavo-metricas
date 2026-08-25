import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a tela de equipe busca agentes e filtros em paralelo", async () => {
  const fonte = await readFile("app/(painel)/equipe/page.tsx", "utf8");
  assert.match(fonte, /Promise\.all/);
  assert.match(fonte, /\/agents/);
  assert.match(fonte, /\/filters/);
  assert.match(fonte, /agentesSchema\.parse/);
  assert.match(fonte, /session|sessao/);
});

test("a tabela permite ordenar inclusive por TME", async () => {
  const fonte = await readFile("components/tabela-equipe.tsx", "utf8");
  assert.match(fonte, /"use client"/);
  assert.match(fonte, /tmeSegundos/);
  assert.match(fonte, /aria-sort/);
  assert.match(fonte, /setOrdenacao/);
});

test("a tabela oferece vazio honesto e nao transforma ausencia em zero", async () => {
  const fonte = await readFile("components/tabela-equipe.tsx", "utf8");
  assert.match(fonte, /Nenhum atendente ativo|Sem atendentes ativos/);
  assert.match(fonte, /formatarDuracao/);
  assert.match(fonte, /formatarDecimal/);
});

test("Equipe esta habilitada na navegacao e o ativo vem da rota", async () => {
  const fonte = await readFile("components/nav-topo.tsx", "utf8");
  assert.match(fonte, /href:\s*"\/equipe"[^\n]*disponivel:\s*true/);
  assert.match(fonte, /usePathname/);
});

test("a tabela usa tokens de cor e permanece navegavel em tela estreita", async () => {
  const css = await readFile("components/tabela-equipe.module.css", "utf8");
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.match(css, /overflow-x:\s*auto/);
});

test("componente cliente da equipe nunca conhece o Talk", async () => {
  const fonte = await readFile("components/tabela-equipe.tsx", "utf8");
  assert.doesNotMatch(fonte, /TALK_BASE_URL|MAVO_METRICS_TOKEN|talkGet/);
});
