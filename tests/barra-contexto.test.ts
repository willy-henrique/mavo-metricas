import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("as pilulas aplicam filtros imediatamente pela URL", async () => {
  const [barra, pilula] = await Promise.all([
    readFile("components/barra-contexto.tsx", "utf8"),
    readFile("components/pilula-filtro.tsx", "utf8"),
  ]);
  assert.match(barra, /router\.push/);
  assert.match(pilula, /router\.push/);
  assert.doesNotMatch(`${barra}\n${pilula}`, />\s*Aplicar\s*</i);
});

test("componentes visuais usam tokens e nao conhecem o Talk", async () => {
  const fontes = await Promise.all([
    readFile("components/barra-contexto.tsx", "utf8"),
    readFile("components/pilula-filtro.tsx", "utf8"),
    readFile("components/barra-contexto.module.css", "utf8"),
  ]);
  const fonte = fontes.join("\n");
  assert.doesNotMatch(fonte, /#[\da-f]{3,8}\b/i);
  assert.doesNotMatch(fonte, /MAVO_METRICS_TOKEN|TALK_BASE_URL|https?:\/\//);
});

test("periodo personalizado nao usa Date nem fuso do navegador", async () => {
  const fonte = await readFile("components/barra-contexto.tsx", "utf8");
  assert.doesNotMatch(fonte, /new Date|Date\.now|Intl\.DateTimeFormat/);
  assert.match(fonte, /type="date"/);
});
