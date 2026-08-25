import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a tela automatica consulta somente o contrato do bot no servidor", async () => {
  const fonte = await readFile("app/(painel)/automatico/page.tsx", "utf8");
  assert.match(fonte, /talkGet<unknown>\([^\n]*["'`]\/bot/);
  assert.match(fonte, /desempenhoBotSchema\.parse/);
  assert.match(fonte, /contexto\.sessao\.token/);
  assert.match(fonte, /periodoDaUrl/);
});

test("filtros de fila e atendente nao aparecem onde a API nao os aplica", async () => {
  const fonte = await readFile("app/(painel)/automatico/page.tsx", "utf8");
  assert.match(fonte, /mostrarFiltrosOperacionais=\{false\}/);
  assert.match(fonte, /params\.delete\("fila"\)/);
  assert.match(fonte, /params\.delete\("atendente"\)/);
});

test("o funil nomeia recebidas, triagem e os dois destinos", async () => {
  const fonte = await readFile("components/funil-bot.tsx", "utf8");
  assert.match(fonte, /Recebidas/);
  assert.match(fonte, /Triagem concluída/);
  assert.match(fonte, /Resolvidas sem humano/);
  assert.match(fonte, /Transferidas/);
  assert.match(fonte, /role="img"/);
});

test("a autonomia trata periodo vazio sem divisao invalida", async () => {
  const fonte = await readFile("components/funil-bot.tsx", "utf8");
  assert.match(fonte, /conversas > 0/);
  assert.doesNotMatch(fonte, /Infinity|NaN/);
});

test("Automatico esta habilitado na navegacao", async () => {
  const fonte = await readFile("components/nav-topo.tsx", "utf8");
  assert.match(fonte, /href:\s*"\/automatico"[^\n]*disponivel:\s*true/);
});

test("o funil usa somente os tokens da identidade", async () => {
  const css = await readFile("components/funil-bot.module.css", "utf8");
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
});
