import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("o proxy do Agora exige sessao e encaminha somente o token do usuario", async () => {
  const fonte = await readFile("app/api/live/route.ts", "utf8");
  assert.match(fonte, /lerSessao/);
  assert.match(fonte, /\b401\b/);
  assert.match(fonte, /talkGet[^\n]*["']\/live["']/);
  assert.match(fonte, /token:\s*sessao\.token/);
});

test("o proxy do Agora nunca e cacheado e valida a resposta do Talk", async () => {
  const fonte = await readFile("app/api/live/route.ts", "utf8");
  assert.match(fonte, /force-dynamic/);
  assert.match(fonte, /snapshotAgoraSchema\.safeParse/);
  assert.doesNotMatch(fonte, /revalidate\s*=\s*\d/);
});

test("o polling para quando a aba fica oculta e volta imediatamente ao retornar", async () => {
  const fonte = await readFile("components/coluna-agora.tsx", "utf8");
  assert.match(fonte, /visibilitychange/);
  assert.match(fonte, /document\.hidden/);
  assert.match(fonte, /clearInterval/);
  assert.match(fonte, /20_000/);
});

test("o polling libera intervalo, listener e requisicao ao desmontar", async () => {
  const fonte = await readFile("components/coluna-agora.tsx", "utf8");
  assert.match(fonte, /removeEventListener/);
  assert.match(fonte, /abort\(\)/);
  assert.match(fonte, /fetch\(["']\/api\/live["']/);
});

test("a falha preserva o ultimo estado e e comunicada em texto", async () => {
  const fonte = await readFile("components/coluna-agora.tsx", "utf8");
  assert.match(fonte, /último estado conhecido/);
  assert.match(fonte, /aria-live/);
});

test("o bloco Agora usa somente tokens de cor", async () => {
  const css = await readFile("components/coluna-agora.module.css", "utf8");
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
});
