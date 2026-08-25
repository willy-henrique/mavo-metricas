import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const OBRIGATORIOS = [
  ["--primary", "#6C5CE7"],
  ["--primary-dark", "#5543DA"],
  ["--primary-soft", "#EEEBFF"],
  ["--page", "#F6F7FB"],
  ["--surface", "#FFFFFF"],
  ["--ink", "#171A2E"],
  ["--muted", "#70778D"],
  ["--line", "#E7E9F0"],
  ["--success", "#17A673"],
  ["--warning", "#E99620"],
  ["--danger", "#D64B5D"],
];

test("a paleta Mavo esta declarada por inteiro", async () => {
  const css = await readFile("app/globals.css", "utf8");
  for (const [token, valor] of OBRIGATORIOS) {
    assert.ok(css.includes(`${token}: ${valor}`), `falta ${token}: ${valor}`);
  }
});

test("env exige as variaveis do Talk", async () => {
  const fonte = await readFile("lib/env.ts", "utf8");
  assert.match(fonte, /TALK_BASE_URL/);
  assert.match(fonte, /MAVO_METRICS_TOKEN/);
});

test("o exemplo de ambiente nao carrega segredo de verdade", async () => {
  const exemplo = await readFile(".env.example", "utf8");
  assert.doesNotMatch(exemplo, /=[A-Za-z0-9_\-]{20,}/);
});
