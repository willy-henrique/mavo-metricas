import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("tema respeita o sistema antes da hidratação e evita flash", async () => {
  const fonte = await readFile("app/layout.tsx", "utf8");
  assert.match(fonte, /prefers-color-scheme:\s*dark/);
  assert.match(fonte, /suppressHydrationWarning/);
  assert.match(fonte, /mavo-theme/);
});

test("alternância de tema é persistente e acessível", async () => {
  const fonte = await readFile("components/tema-toggle.tsx", "utf8");
  assert.match(fonte, /localStorage\.setItem\("mavo-theme"/);
  assert.match(fonte, /aria-label/);
  assert.match(fonte, /aria-pressed/);
});

test("tema escuro redefine superfícies, texto e divisores", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /--surface:/);
  assert.match(css, /--ink:/);
  assert.match(css, /--line:/);
});
