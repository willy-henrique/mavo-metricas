import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("o login dispara o ping de aquecimento", async () => {
  const fonte = await readFile("app/login/page.tsx", "utf8");
  assert.match(fonte, /acordarTalk/);
});

test("a acao de login nao repassa mensagem crua de erro do Talk", async () => {
  const fonte = await readFile("app/login/actions.ts", "utf8");
  assert.match(fonte, /TalkError/);
  assert.doesNotMatch(fonte, /erro\.stack/);
});

test("o middleware protege o grupo painel", async () => {
  const fonte = await readFile("middleware.ts", "utf8");
  assert.match(fonte, /login/);
  assert.match(fonte, /matcher/);
});

test("a senha nunca e registrada em log", async () => {
  const fonte = await readFile("app/login/actions.ts", "utf8");
  assert.doesNotMatch(fonte, /console\.(log|info|warn|error)\([^)]*senha/i);
  assert.doesNotMatch(fonte, /console\.(log|info|warn|error)\([^)]*password/i);
});

test("arquivos visuais novos usam somente tokens de cor", async () => {
  const arquivos = [
    "app/login/page.tsx",
    "app/login/formulario.tsx",
    "app/login/login.module.css",
    "app/(painel)/layout.tsx",
    "app/(painel)/page.tsx",
    "app/(painel)/painel.module.css",
    "components/nav-topo.tsx",
    "components/nav-topo.module.css",
  ];
  for (const arquivo of arquivos) {
    const fonte = await readFile(arquivo, "utf8");
    assert.doesNotMatch(fonte, /#[\da-f]{3,8}\b/i, `${arquivo} contém cor fora dos tokens`);
  }
});

test("componentes cliente nao conhecem segredo nem URL do Talk", async () => {
  const fontes = await Promise.all([
    readFile("app/login/formulario.tsx", "utf8"),
    readFile("components/nav-topo.tsx", "utf8"),
  ]);
  assert.doesNotMatch(fontes.join("\n"), /MAVO_METRICS_TOKEN|TALK_BASE_URL|https?:\/\//);
});
