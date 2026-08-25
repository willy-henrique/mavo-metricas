import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("login oferece caminho de recuperacao de senha", async () => {
  const fonte = await readFile("app/login/formulario.tsx", "utf8");
  assert.match(fonte, /href="\/esqueci"/);
  assert.match(fonte, /Esqueci minha senha/);
});

test("formularios cliente nunca conhecem URL ou token de servico do Talk", async () => {
  const fontes = await Promise.all([
    readFile("app/esqueci/formulario.tsx", "utf8"),
    readFile("app/redefinir/formulario.tsx", "utf8"),
  ]);
  assert.doesNotMatch(fontes.join("\n"), /TALK_BASE_URL|MAVO_METRICS_TOKEN|\/api\/metrics\/v1/);
});

test("pedido de recuperacao mantem resposta neutra sobre o email", async () => {
  const [acao, formulario] = await Promise.all([
    readFile("app/esqueci/actions.ts", "utf8"),
    readFile("app/esqueci/formulario.tsx", "utf8"),
  ]);
  assert.match(acao, /talkPost/);
  assert.match(acao, /\/auth\/password\/forgot/);
  assert.match(formulario, /Se a conta estiver habilitada/);
  assert.doesNotMatch(formulario, /e-mail encontrado|conta encontrada/i);
});

test("redefinicao exige 10 caracteres e confirmacao igual", async () => {
  const fonte = await readFile("app/redefinir/actions.ts", "utf8");
  assert.match(fonte, /min\(10/);
  assert.match(fonte, /max\(128/);
  assert.match(fonte, /confirmacao/);
  assert.match(fonte, /senhas não coincidem/i);
  assert.match(fonte, /\/auth\/password\/reset/);
});

test("token ausente ou malformado nao abre formulario de senha", async () => {
  const fonte = await readFile("app/redefinir/page.tsx", "utf8");
  assert.match(fonte, /tokenValido/);
  assert.match(fonte, /Link inválido/);
  assert.match(fonte, /FormularioRedefinicao/);
});

test("senha e token nunca sao registrados em log", async () => {
  const fontes = await Promise.all([
    readFile("app/esqueci/actions.ts", "utf8"),
    readFile("app/redefinir/actions.ts", "utf8"),
  ]);
  assert.doesNotMatch(fontes.join("\n"), /console\.(log|info|warn|error)/);
  assert.doesNotMatch(fontes.join("\n"), /erro\.stack/);
});

test("telas de conta usam os tokens visuais da Mavo", async () => {
  const arquivos = [
    "app/esqueci/page.tsx",
    "app/esqueci/formulario.tsx",
    "app/redefinir/page.tsx",
    "app/redefinir/formulario.tsx",
    "app/login/login.module.css",
  ];
  for (const arquivo of arquivos) {
    const fonte = await readFile(arquivo, "utf8");
    assert.doesNotMatch(fonte, /#[\da-f]{3,8}\b/i, `${arquivo} contém cor fora dos tokens`);
  }
});
