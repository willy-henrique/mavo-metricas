import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("configuracoes lista usuarios somente para admin e valida o contrato", async () => {
  const fonte = await readFile("app/(painel)/configuracoes/page.tsx", "utf8");
  assert.match(fonte, /role !== "admin"/);
  assert.match(fonte, /talkGet/);
  assert.match(fonte, /\/users/);
  assert.match(fonte, /usuariosGerenciadosSchema\.parse/);
  assert.match(fonte, /GerenciadorUsuarios/);
});

test("cliente do Talk oferece mutacoes PATCH e DELETE somente no servidor", async () => {
  const fonte = await readFile("lib/talk-client.ts", "utf8");
  assert.match(fonte, /export async function talkPatch/);
  assert.match(fonte, /export async function talkDelete/);
  assert.match(fonte, /method:\s*"PATCH"/);
  assert.match(fonte, /method:\s*"DELETE"/);
  assert.match(fonte, /server-only/);
});

test("acoes usam sessao, validam resposta e revalidam a tela", async () => {
  const fonte = await readFile("app/(painel)/configuracoes/actions.ts", "utf8");
  assert.match(fonte, /lerSessao/);
  assert.match(fonte, /talkPost/);
  assert.match(fonte, /talkPatch/);
  assert.match(fonte, /talkDelete/);
  assert.match(fonte, /usuarioGerenciadoSchema\.parse/);
  assert.match(fonte, /revalidatePath\("\/configuracoes"\)/);
});

test("formulario exige senha de 10 caracteres e WhatsApp para gestor e admin", async () => {
  const [acoes, componente] = await Promise.all([
    readFile("app/(painel)/configuracoes/actions.ts", "utf8"),
    readFile("components/gerenciador-usuarios.tsx", "utf8"),
  ]);
  assert.match(acoes, /min\(10/);
  assert.match(acoes, /max\(128/);
  assert.match(acoes, /recoveryPhone/);
  assert.match(componente, /WhatsApp de recuperação/);
  assert.match(componente, /Recuperação pendente/);
});

test("interface comunica protecao da propria conta e desativacao reversivel", async () => {
  const fonte = await readFile("components/gerenciador-usuarios.tsx", "utf8");
  assert.match(fonte, /Esta é sua conta/);
  assert.match(fonte, /Desativar acesso/);
  assert.match(fonte, /Reativar acesso/);
  assert.match(fonte, /Não excluímos o histórico/);
});

test("componente cliente nunca fala diretamente com o Talk", async () => {
  const fonte = await readFile("components/gerenciador-usuarios.tsx", "utf8");
  assert.doesNotMatch(fonte, /talk(Get|Post|Patch|Delete)|TALK_BASE_URL|MAVO_METRICS_TOKEN/);
});

test("configuracoes aparecem no menu apenas para administrador", async () => {
  const [nav, layout] = await Promise.all([
    readFile("components/nav-topo.tsx", "utf8"),
    readFile("app/(painel)/layout.tsx", "utf8"),
  ]);
  assert.match(nav, /role === "admin"/);
  assert.match(nav, /href="\/configuracoes"/);
  assert.match(layout, /role=/);
});

test("tela permanece responsiva e usa somente tokens de cor", async () => {
  const css = `${await readFile("app/(painel)/configuracoes/configuracoes.module.css", "utf8")}\n${await readFile("components/gerenciador-usuarios.module.css", "utf8")}`;
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.match(css, /@media/);
});
