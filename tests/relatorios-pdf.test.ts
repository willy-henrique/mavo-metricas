import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PDF exige sessão e preserva os filtros do relatório", async () => {
  const fonte = await readFile("app/api/relatorios/pdf/route.ts", "utf8");
  assert.match(fonte, /lerSessao/);
  assert.match(fonte, /401/);
  assert.match(fonte, /parametrosMetricas/);
  assert.match(fonte, /\/reports\/tickets/);
});

test("PDF pagina por cursor com teto explícito", async () => {
  const fonte = await readFile("app/api/relatorios/pdf/route.ts", "utf8");
  assert.match(fonte, /MAX_PDF_ROWS\s*=\s*1_000/);
  assert.match(fonte, /proximoCursor/);
  assert.match(fonte, /while\s*\(/);
});

test("PDF é um anexo gerado no servidor", async () => {
  const fonte = await readFile("app/api/relatorios/pdf/route.ts", "utf8");
  assert.match(fonte, /PDFDocument\.create/);
  assert.match(fonte, /application\/pdf/);
  assert.match(fonte, /Content-Disposition/);
  assert.match(fonte, /runtime\s*=\s*"nodejs"/);
});

test("tabela oferece PDF e CSV com a mesma query", async () => {
  const fonte = await readFile("components/tabela-relatorio.tsx", "utf8");
  assert.match(fonte, /hrefPdf/);
  assert.match(fonte, /Exportar PDF/);
  assert.match(fonte, /Exportar CSV/);
});
