import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("toda chamada ao Talk envia o token de servico", async () => {
  const fonte = await readFile("lib/talk-client.ts", "utf8");
  assert.match(fonte, /x-mavo-service-token/i);
  assert.match(fonte, /env\.metricsToken/);
});

test("toda chamada ao Talk tem timeout", async () => {
  const fonte = await readFile("lib/talk-client.ts", "utf8");
  assert.match(fonte, /AbortSignal\.timeout|AbortController/);
});

test("o cookie de sessao e httpOnly, secure e sameSite", async () => {
  const fonte = await readFile("lib/sessao.ts", "utf8");
  assert.match(fonte, /httpOnly:\s*true/);
  assert.match(fonte, /secure:/);
  assert.match(fonte, /sameSite:\s*"lax"/);
});

test("o painel nunca expoe a URL do Talk ao cliente", async () => {
  const fonte = await readFile("lib/talk-client.ts", "utf8");
  assert.doesNotMatch(fonte, /NEXT_PUBLIC_/);
});

test("o painel nao conhece o segredo de assinatura do Talk", async () => {
  const fontes = await Promise.all([
    readFile("lib/talk-client.ts", "utf8"),
    readFile("lib/sessao.ts", "utf8"),
  ]);
  assert.doesNotMatch(fontes.join("\n"), /JWT_SECRET|jwtVerify|SignJWT/);
});

test("a sessao rejeita atendente e qualquer papel desconhecido", async () => {
  const fonte = await readFile("lib/sessao.ts", "utf8");
  assert.match(fonte, /role !== "admin"/);
  assert.match(fonte, /role !== "gestor"/);
});

test("o cookie e removido com o mesmo path usado na gravacao", async () => {
  const fonte = await readFile("lib/sessao.ts", "utf8");
  const paths = fonte.match(/path:\s*"\/"/g) || [];
  assert.ok(paths.length >= 2, "gravação e remoção precisam usar path /");
});
