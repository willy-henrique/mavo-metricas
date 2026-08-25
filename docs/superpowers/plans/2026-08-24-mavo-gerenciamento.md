# Mavo Gerenciamento — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para rastreio.

**Goal:** Construir o painel onde o dono da empresa cliente acompanha o próprio atendimento
de WhatsApp, alimentado por uma API de métricas nova dentro do Mavo Talk.

**Architecture:** Dois repositórios. O **Mavo Talk** ganha `app/api/metrics/v1/*`, que lê o
Supabase por SQL agregado com escopo de tenant e devolve um envelope `{data, meta}`. O
**Mavo Gerenciamento** é um Next.js novo cujo servidor (BFF) é o único que fala com o Talk;
o browser nunca vê token nem URL do Talk.

**Tech Stack:** Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 · Recharts · Zod ·
jose · `node --test` via tsx · Vercel (painel) · Render + Supabase (Talk).

**Spec:** `docs/superpowers/specs/2026-08-24-mavo-gerenciamento-design.md`

---

## Global Constraints

Valem para **toda** tarefa deste plano.

- **Node:** `>=22 <25` (herdado do `engines` do Talk).
- **Orçamento zero.** Painel no Vercel free, Talk no Render free. Nenhuma tarefa pode
  introduzir serviço pago, cron job pago ou worker dedicado.
- **Commits sem coautoria.** **Nunca** incluir `Co-Authored-By` nas mensagens de commit.
- **Mensagens de commit em português**, prefixo convencional (`feat:`, `test:`, `fix:`).
- **Fases 0 a 4 não criam nenhuma migração de banco.** A única migração do projeto está na
  Fase 5 (`password_reset_tokens`).
- **Todo SQL de métrica** usa `queryTenantDatabase(organizationId, sql, values)` de
  `lib/db.ts` **e** repete o filtro `organization_id = $1` explicitamente no `WHERE`. A RLS
  é a segunda barreira, não a primeira.
- **Janela máxima de consulta:** 90 dias. Acima disso a rota responde `period_too_long`.
- **Fuso:** todo corte de dia usa o fuso da organização, resolvido no servidor. Nunca o
  relógio do navegador.
- **Envelope:** toda rota de leitura responde `{ "data": …, "meta": … }`. Todo erro responde
  `{ "error": { "code": …, "message": … } }`.
- **Isolamento entre empresas:** `organization_id` sai sempre da sessão. Nenhuma rota aceita
  organização por parâmetro. Toda rota nova precisa do teste de isolamento.
- **Segredos:** `MAVO_METRICS_TOKEN` e `JWT_SECRET` só em variável de ambiente. Nunca em
  `.bat`, doc, teste ou exemplo versionado.
- **Idioma da interface:** português do Brasil. Números e datas em `pt-BR`.

---

## Estrutura de arquivos

### Repositório A — Mavo Talk (`C:\willydev\willtalk`)

| Arquivo | Responsabilidade |
|---|---|
| `lib/metrics/envelope.ts` | Monta `{data, meta}` e o corpo de erro padronizado |
| `lib/metrics/guard.ts` | Token de serviço + sessão + papel + auditoria em uma função |
| `lib/metrics/period.ts` | Períodos nomeados → janela absoluta no fuso da organização; janela anterior; teto de 90 dias |
| `lib/metrics/live.ts` | Consulta do bloco **Agora** |
| `lib/metrics/overview.ts` | Cartões do período e a comparação |
| `lib/metrics/timeseries.ts` | Série por hora ou por dia |
| `lib/metrics/filters.ts` | Filas e atendentes para as pílulas |
| `lib/metrics/types.ts` | Tipos compartilhados das respostas |
| `app/api/metrics/v1/**/route.ts` | Rotas HTTP — finas, só orquestram guard + consulta + envelope |
| `tests/unit/metrics-*.test.ts` | Período, envelope, guard, isolamento |
| `tests/integration/metrics-queries.test.ts` | SQL contra banco real, atrás de `RUN_DATABASE_INTEGRATION_TESTS` |

Os arquivos de consulta são separados por pergunta de negócio, não por camada técnica: quem
mexe no bloco Agora abre `live.ts` e mais nada.

### Repositório B — Mavo Gerenciamento (`C:\willydev\mavo-gerenciamento`)

| Arquivo | Responsabilidade |
|---|---|
| `lib/env.ts` | Lê e valida as variáveis de ambiente uma única vez |
| `lib/talk-client.ts` | Único ponto que fala com o Talk: header de serviço, timeout, erro tipado |
| `lib/sessao.ts` | Cookie httpOnly, leitura do perfil, expiração |
| `lib/periodo.ts` | Período nomeado ↔ URL (`?periodo=30d`) |
| `lib/formato.ts` | Número, duração e porcentagem em pt-BR |
| `app/globals.css` | Tokens Mavo — única fonte de cor do projeto |
| `app/login/page.tsx` · `actions.ts` | Login e ping de aquecimento |
| `app/(painel)/layout.tsx` | Navegação no topo + barra de contexto |
| `app/(painel)/page.tsx` | Visão geral |
| `app/api/live/route.ts` | Proxy do bloco Agora para o polling do cliente |
| `components/*.tsx` | Um componente por bloco visual |
| `tests/*.test.ts` | Período, formato, cliente do Talk, sessão |

---

# FASE 0 — Fundação

Pronta quando: o cliente entra com e-mail e senha e vê o nome da própria empresa.

---

### Task 1: Envelope e erros da API de métricas

**Files:**
- Create: `C:\willydev\willtalk\lib\metrics\types.ts`
- Create: `C:\willydev\willtalk\lib\metrics\envelope.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-envelope.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type MetricsMeta = { period: { from: string; to: string }; comparison: { from: string; to: string } | null; timezone: string; generatedAt: string; filters: Record<string, string | null> }`
  - `metricsEnvelope<T>(data: T, meta: MetricsMeta): NextResponse`
  - `type MetricsErrorCode = "unauthenticated" | "forbidden" | "invalid_period" | "period_too_long" | "rate_limited" | "internal"`
  - `metricsError(code: MetricsErrorCode, message: string): NextResponse`

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-envelope.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { metricsEnvelope, metricsError } from "../../lib/metrics/envelope";

test("envelope carrega data e meta juntos", async () => {
  const resposta = metricsEnvelope(
    { tickets: 32 },
    {
      period: { from: "2026-08-24T00:00:00-03:00", to: "2026-08-25T00:00:00-03:00" },
      comparison: null,
      timezone: "America/Sao_Paulo",
      generatedAt: "2026-08-24T14:02:11-03:00",
      filters: { queueId: null, assigneeId: null },
    },
  );
  const corpo = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.equal(corpo.data.tickets, 32);
  assert.equal(corpo.meta.timezone, "America/Sao_Paulo");
});

test("cada código de erro tem o status HTTP certo", async () => {
  assert.equal(metricsError("unauthenticated", "x").status, 401);
  assert.equal(metricsError("forbidden", "x").status, 403);
  assert.equal(metricsError("invalid_period", "x").status, 400);
  assert.equal(metricsError("period_too_long", "x").status, 400);
  assert.equal(metricsError("rate_limited", "x").status, 429);
  assert.equal(metricsError("internal", "x").status, 500);
});

test("erro nunca vaza detalhe interno no corpo", async () => {
  const corpo = await metricsError("internal", "Falha ao consultar").json();
  assert.deepEqual(Object.keys(corpo), ["error"]);
  assert.deepEqual(Object.keys(corpo.error).sort(), ["code", "message"]);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-envelope.test.ts
```

Esperado: FAIL com `Cannot find module '../../lib/metrics/envelope'`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/metrics/types.ts`:

```ts
export type MetricsPeriod = { from: string; to: string };

export type MetricsMeta = {
  period: MetricsPeriod;
  comparison: MetricsPeriod | null;
  timezone: string;
  generatedAt: string;
  filters: Record<string, string | null>;
};

export type MetricsErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "invalid_period"
  | "period_too_long"
  | "rate_limited"
  | "internal";
```

`lib/metrics/envelope.ts`:

```ts
import { NextResponse } from "next/server";
import type { MetricsErrorCode, MetricsMeta } from "@/lib/metrics/types";

const STATUS: Record<MetricsErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_period: 400,
  period_too_long: 400,
  rate_limited: 429,
  internal: 500,
};

export function metricsEnvelope<T>(data: T, meta: MetricsMeta): NextResponse {
  return NextResponse.json({ data, meta });
}

export function metricsError(code: MetricsErrorCode, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-envelope.test.ts
```

Esperado: `pass 3`.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/types.ts lib/metrics/envelope.ts tests/unit/metrics-envelope.test.ts
git commit -m "feat: envelope e erros padronizados da API de metricas"
```

---

### Task 2: Períodos no fuso da organização

**Files:**
- Create: `C:\willydev\willtalk\lib\metrics\period.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-period.test.ts`

**Interfaces:**
- Consumes: `MetricsPeriod` da Task 1.
- Produces:
  - `const MAX_PERIOD_DAYS = 90`
  - `type PeriodName = "hoje" | "ontem" | "semana" | "mes" | "7d" | "30d" | "90d" | "custom"`
  - `type ResolvedPeriod = { from: Date; to: Date; comparison: { from: Date; to: Date }; timezone: string }`
  - `resolvePeriod(input: { name?: string; from?: string; to?: string; timezone: string; now?: Date }): ResolvedPeriod` — lança `PeriodError` com `code` `"invalid_period"` ou `"period_too_long"`
  - `class PeriodError extends Error { code: "invalid_period" | "period_too_long" }`

A janela é sempre semiaberta: `from` inclusivo, `to` exclusivo. Isso evita perder ou contar
duas vezes o evento que cai exatamente na virada.

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-period.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { resolvePeriod, PeriodError, MAX_PERIOD_DAYS } from "../../lib/metrics/period";

const FUSO = "America/Sao_Paulo";

test("hoje comeca a meia-noite do fuso da organizacao, nao em UTC", () => {
  // 24/08/2026 02:00 UTC = 23/08/2026 23:00 em Sao Paulo
  const agora = new Date("2026-08-24T02:00:00Z");
  const p = resolvePeriod({ name: "hoje", timezone: FUSO, now: agora });
  assert.equal(p.from.toISOString(), "2026-08-23T03:00:00.000Z");
  assert.equal(p.to.toISOString(), "2026-08-24T03:00:00.000Z");
});

test("a janela de comparacao tem a mesma duracao e termina onde a atual comeca", () => {
  const agora = new Date("2026-08-24T15:00:00Z");
  const p = resolvePeriod({ name: "7d", timezone: FUSO, now: agora });
  const duracaoAtual = p.to.getTime() - p.from.getTime();
  const duracaoAnterior = p.comparison.to.getTime() - p.comparison.from.getTime();
  assert.equal(duracaoAnterior, duracaoAtual);
  assert.equal(p.comparison.to.getTime(), p.from.getTime());
});

test("periodo personalizado acima de 90 dias e recusado", () => {
  assert.throws(
    () =>
      resolvePeriod({
        name: "custom",
        from: "2026-01-01T00:00:00-03:00",
        to: "2026-06-01T00:00:00-03:00",
        timezone: FUSO,
      }),
    (erro: unknown) => erro instanceof PeriodError && erro.code === "period_too_long",
  );
});

test("periodo personalizado invertido e recusado", () => {
  assert.throws(
    () =>
      resolvePeriod({
        name: "custom",
        from: "2026-06-01T00:00:00-03:00",
        to: "2026-01-01T00:00:00-03:00",
        timezone: FUSO,
      }),
    (erro: unknown) => erro instanceof PeriodError && erro.code === "invalid_period",
  );
});

test("nome desconhecido e recusado", () => {
  assert.throws(
    () => resolvePeriod({ name: "trimestre", timezone: FUSO }),
    (erro: unknown) => erro instanceof PeriodError && erro.code === "invalid_period",
  );
});

test("o teto e de 90 dias", () => {
  assert.equal(MAX_PERIOD_DAYS, 90);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-period.test.ts
```

Esperado: FAIL com `Cannot find module '../../lib/metrics/period'`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/metrics/period.ts`:

```ts
export const MAX_PERIOD_DAYS = 90;
const DIA_MS = 24 * 60 * 60 * 1000;

const NOMES = ["hoje", "ontem", "semana", "mes", "7d", "30d", "90d", "custom"] as const;
export type PeriodName = (typeof NOMES)[number];

export class PeriodError extends Error {
  constructor(
    public readonly code: "invalid_period" | "period_too_long",
    message: string,
  ) {
    super(message);
    this.name = "PeriodError";
  }
}

export type ResolvedPeriod = {
  from: Date;
  to: Date;
  comparison: { from: Date; to: Date };
  timezone: string;
};

/** Deslocamento do fuso, em ms, no instante dado. Positivo a leste de Greenwich. */
function offsetMs(instante: Date, timezone: string): number {
  const formatador = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    formatador.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === "24" ? "0" : p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return comoUtc - instante.getTime();
}

/** Meia-noite local do dia que contém `instante`, devolvida como instante absoluto. */
function inicioDoDia(instante: Date, timezone: string): Date {
  const local = new Date(instante.getTime() + offsetMs(instante, timezone));
  const meiaNoiteLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const aproximado = new Date(meiaNoiteLocal - offsetMs(instante, timezone));
  // Segunda passada resolve a virada de horário de verão.
  return new Date(meiaNoiteLocal - offsetMs(aproximado, timezone));
}

function somaDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA_MS);
}

export function resolvePeriod(input: {
  name?: string;
  from?: string;
  to?: string;
  timezone: string;
  now?: Date;
}): ResolvedPeriod {
  const agora = input.now ?? new Date();
  const nome = (input.name ?? "hoje") as PeriodName;
  if (!NOMES.includes(nome)) {
    throw new PeriodError("invalid_period", `Período desconhecido: ${input.name}`);
  }

  let from: Date;
  let to: Date;

  if (nome === "custom") {
    if (!input.from || !input.to) {
      throw new PeriodError("invalid_period", "Período personalizado exige from e to");
    }
    from = new Date(input.from);
    to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new PeriodError("invalid_period", "Datas inválidas");
    }
    if (to.getTime() <= from.getTime()) {
      throw new PeriodError("invalid_period", "A data final precisa ser depois da inicial");
    }
  } else {
    const hoje = inicioDoDia(agora, input.timezone);
    if (nome === "hoje") {
      from = hoje;
      to = somaDias(hoje, 1);
    } else if (nome === "ontem") {
      from = somaDias(hoje, -1);
      to = hoje;
    } else if (nome === "semana") {
      from = somaDias(hoje, -6);
      to = somaDias(hoje, 1);
    } else if (nome === "mes") {
      from = somaDias(hoje, -29);
      to = somaDias(hoje, 1);
    } else {
      const dias = Number(nome.replace("d", ""));
      from = somaDias(hoje, -(dias - 1));
      to = somaDias(hoje, 1);
    }
  }

  const duracao = to.getTime() - from.getTime();
  if (duracao > MAX_PERIOD_DAYS * DIA_MS) {
    throw new PeriodError(
      "period_too_long",
      `A consulta cobre no máximo ${MAX_PERIOD_DAYS} dias`,
    );
  }

  return {
    from,
    to,
    comparison: { from: new Date(from.getTime() - duracao), to: from },
    timezone: input.timezone,
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-period.test.ts
```

Esperado: `pass 6`.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/period.ts tests/unit/metrics-period.test.ts
git commit -m "feat: resolucao de periodo no fuso da organizacao com teto de 90 dias"
```

---

### Task 3: Guard das rotas de métricas

**Files:**
- Create: `C:\willydev\willtalk\lib\metrics\guard.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-guard.test.ts`

**Interfaces:**
- Consumes: `metricsError` (Task 1); `getSession` e `SessionPayload` de `lib/auth.ts`;
  `consumeRateLimit` e `rateLimitSubject` de `lib/security/rate-limit.ts`.
- Produces:
  - `requireMetricsAccess(request: Request): Promise<{ error: NextResponse; session: null } | { error: null; session: SessionPayload }>`

Ordem das verificações, e o motivo: **token de serviço primeiro** (barato, e recusa quem
nem deveria estar batendo na porta antes de tocar em JWT ou Redis), depois sessão, depois
papel, depois rate limit.

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-guard.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("o guard checa o token de servico antes de qualquer outra coisa", async () => {
  const fonte = await readFile("lib/metrics/guard.ts", "utf8");
  const posServico = fonte.indexOf("MAVO_METRICS_TOKEN");
  const posSessao = fonte.indexOf("getSession");
  assert.ok(posServico > -1, "guard precisa ler MAVO_METRICS_TOKEN");
  assert.ok(posSessao > -1, "guard precisa resolver a sessão");
  assert.ok(posServico < posSessao, "o token de serviço é checado antes da sessão");
});

test("o guard recusa o papel atendente", async () => {
  const fonte = await readFile("lib/metrics/guard.ts", "utf8");
  assert.match(fonte, /atendente/);
  assert.match(fonte, /forbidden/);
});

test("o guard usa comparacao de tempo constante no token de servico", async () => {
  const fonte = await readFile("lib/metrics/guard.ts", "utf8");
  assert.match(fonte, /timingSafeEqual/);
});

test("nenhuma rota de metricas aceita organizacao por parametro", async () => {
  const fonte = await readFile("lib/metrics/guard.ts", "utf8");
  assert.doesNotMatch(fonte, /searchParams\.get\(["']org/);
  assert.match(fonte, /session\.organizationId|sessao\.organizationId/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-guard.test.ts
```

Esperado: FAIL com `ENOENT: no such file or directory, open 'lib/metrics/guard.ts'`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/metrics/guard.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { metricsError } from "@/lib/metrics/envelope";
import { consumeRateLimit, rateLimitSubject } from "@/lib/security/rate-limit";

type Resultado =
  | { error: NextResponse; session: null }
  | { error: null; session: SessionPayload };

function tokenDeServicoConfere(recebido: string | null): boolean {
  const esperado = process.env.MAVO_METRICS_TOKEN || "";
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireMetricsAccess(request: Request): Promise<Resultado> {
  if (!tokenDeServicoConfere(request.headers.get("x-mavo-service-token"))) {
    return { error: metricsError("unauthenticated", "Origem não autorizada"), session: null };
  }

  const session = await getSession();
  if (!session) {
    return { error: metricsError("unauthenticated", "Sessão expirada"), session: null };
  }

  if (session.role === "atendente") {
    return {
      error: metricsError("forbidden", "Este painel é para gestão"),
      session: null,
    };
  }

  const limite = await consumeRateLimit(
    "metrics",
    rateLimitSubject(`${session.organizationId}:${session.userId}`),
    60,
    60,
  );
  if (!limite.allowed) {
    return {
      error: metricsError("rate_limited", "Muitas consultas. Aguarde um instante."),
      session: null,
    };
  }

  return { error: null, session };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-guard.test.ts
```

Esperado: `pass 4`.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/guard.ts tests/unit/metrics-guard.test.ts
git commit -m "feat: guard das rotas de metricas com token de servico e papel"
```

---

### Task 4: Rotas `/health`, `/auth/login` e `/me`

**Files:**
- Create: `C:\willydev\willtalk\app\api\metrics\v1\health\route.ts`
- Create: `C:\willydev\willtalk\app\api\metrics\v1\auth\login\route.ts`
- Create: `C:\willydev\willtalk\app\api\metrics\v1\me\route.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-auth-route.test.ts`

**Interfaces:**
- Consumes: `requireMetricsAccess` (Task 3); `metricsError` (Task 1); `getUserByEmail` e
  `recordUserLogin` de `lib/repo`; `signSession` de `lib/auth`; `checkDatabaseConnection`
  de `lib/db`; `bcrypt` de `bcryptjs`.
- Produces: contrato HTTP consumido pelo painel —
  - `GET /api/metrics/v1/health` → `{ status: "ok", database: boolean }` (só token de serviço)
  - `POST /api/metrics/v1/auth/login` `{ email, password }` → `{ data: { token, expiresAt, user: { id, name, email, role }, organization: { id, name, timezone } } }`
  - `GET /api/metrics/v1/me` → o mesmo bloco `user` + `organization`

`/health` **não** exige sessão: é o ping que acorda o Render enquanto o usuário digita a senha.

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-auth-route.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("login de metricas recusa atendente", async () => {
  const fonte = await readFile("app/api/metrics/v1/auth/login/route.ts", "utf8");
  assert.match(fonte, /atendente/);
  assert.match(fonte, /forbidden/);
});

test("login de metricas passa por rate limit e compara hash com bcrypt", async () => {
  const fonte = await readFile("app/api/metrics/v1/auth/login/route.ts", "utf8");
  assert.match(fonte, /consumeRateLimit/);
  assert.match(fonte, /bcrypt\.compare/);
});

test("login nao revela se o e-mail existe", async () => {
  const fonte = await readFile("app/api/metrics/v1/auth/login/route.ts", "utf8");
  const mensagens = fonte.match(/metricsError\("unauthenticated", "([^"]+)"/g) || [];
  const distintas = new Set(mensagens);
  assert.equal(distintas.size, 1, "usuário inexistente e senha errada devem responder igual");
});

test("health nao exige sessao de usuario", async () => {
  const fonte = await readFile("app/api/metrics/v1/health/route.ts", "utf8");
  assert.doesNotMatch(fonte, /requireMetricsAccess/);
  assert.match(fonte, /MAVO_METRICS_TOKEN|x-mavo-service-token/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-auth-route.test.ts
```

Esperado: FAIL com `ENOENT` em `app/api/metrics/v1/auth/login/route.ts`.

- [ ] **Step 3: Escrever a implementação mínima**

`app/api/metrics/v1/health/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

function autorizado(request: Request): boolean {
  const esperado = process.env.MAVO_METRICS_TOKEN || "";
  const recebido = request.headers.get("x-mavo-service-token") || "";
  if (!esperado || !recebido || esperado.length !== recebido.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Origem não autorizada" } },
      { status: 401 },
    );
  }
  const database = await checkDatabaseConnection();
  return NextResponse.json({ status: "ok", database });
}
```

`app/api/metrics/v1/auth/login/route.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { signSession } from "@/lib/auth";
import { metricsError } from "@/lib/metrics/envelope";
import { getUserByEmail, recordUserLogin } from "@/lib/repo";
import { loginSchema } from "@/lib/schemas";
import { consumeRateLimit, rateLimitSubject } from "@/lib/security/rate-limit";
import { organizationTimezone } from "@/lib/organization-timezone";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CREDENCIAL_INVALIDA = "E-mail ou senha inválidos";

function servicoAutorizado(request: Request): boolean {
  const esperado = process.env.MAVO_METRICS_TOKEN || "";
  const recebido = request.headers.get("x-mavo-service-token") || "";
  if (!esperado || !recebido || esperado.length !== recebido.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function POST(request: Request) {
  if (!servicoAutorizado(request)) {
    return metricsError("unauthenticated", CREDENCIAL_INVALIDA);
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return metricsError("invalid_period", "JSON inválido");
  }

  const analisado = loginSchema.safeParse(corpo);
  if (!analisado.success) {
    return metricsError("unauthenticated", CREDENCIAL_INVALIDA);
  }

  const { email, password } = analisado.data;
  const origem = (request.headers.get("x-forwarded-for") || "desconhecido").split(",")[0];
  const limite = await consumeRateLimit(
    "metrics-login",
    rateLimitSubject(`${origem}:${email.toLowerCase()}`),
    10,
    60,
  );
  if (!limite.allowed) {
    return metricsError("rate_limited", "Muitas tentativas. Tente novamente em instantes.");
  }

  const usuario = await getUserByEmail(email);
  if (!usuario || usuario.isActive === false) {
    return metricsError("unauthenticated", CREDENCIAL_INVALIDA);
  }

  const senhaConfere = await bcrypt.compare(password, String(usuario.passwordHash || ""));
  if (!senhaConfere) {
    return metricsError("unauthenticated", CREDENCIAL_INVALIDA);
  }

  if (usuario.role === "atendente") {
    return metricsError("forbidden", "Este painel é para gestão");
  }

  const token = await signSession({
    userId: usuario.id,
    organizationId: usuario.organizationId,
    role: usuario.role,
    name: usuario.name,
    email: usuario.email,
  });
  await recordUserLogin(usuario.organizationId, usuario.id);

  return NextResponse.json({
    data: {
      token,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      user: {
        id: usuario.id,
        name: usuario.name,
        email: usuario.email,
        role: usuario.role,
      },
      organization: {
        id: usuario.organizationId,
        name: usuario.organizationName ?? "",
        timezone: await organizationTimezone(usuario.organizationId),
      },
    },
  });
}
```

`app/api/metrics/v1/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireMetricsAccess } from "@/lib/metrics/guard";
import { organizationTimezone } from "@/lib/organization-timezone";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acesso = await requireMetricsAccess(request);
  if (acesso.error) return acesso.error;
  const { session } = acesso;

  return NextResponse.json({
    data: {
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      },
      organization: {
        id: session.organizationId,
        timezone: await organizationTimezone(session.organizationId),
      },
    },
  });
}
```

> Ao implementar, confirme os nomes reais exportados por `lib/repo` (`getUserByEmail`,
> `recordUserLogin`) e por `lib/organization-timezone`. Se a assinatura divergir, ajuste a
> chamada — **não** crie funções paralelas.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-auth-route.test.ts && npm run typecheck
```

Esperado: `pass 4` e `tsc` sem erro novo.

- [ ] **Step 5: Commit**

```bash
git add app/api/metrics/v1 tests/unit/metrics-auth-route.test.ts
git commit -m "feat: rotas health, login e me da API de metricas v1"
```

---

### Task 5: Esqueleto do Mavo Gerenciamento com os tokens Mavo

**Files:**
- Create: `C:\willydev\mavo-gerenciamento\package.json`
- Create: `C:\willydev\mavo-gerenciamento\tsconfig.json`
- Create: `C:\willydev\mavo-gerenciamento\next.config.ts`
- Create: `C:\willydev\mavo-gerenciamento\postcss.config.mjs`
- Create: `C:\willydev\mavo-gerenciamento\app\globals.css`
- Create: `C:\willydev\mavo-gerenciamento\app\layout.tsx`
- Create: `C:\willydev\mavo-gerenciamento\lib\env.ts`
- Create: `C:\willydev\mavo-gerenciamento\.env.example`
- Create: `C:\willydev\mavo-gerenciamento\.gitignore`
- Test: `C:\willydev\mavo-gerenciamento\tests\tokens.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `env` de `lib/env.ts` com `{ talkBaseUrl: string; metricsToken: string; cookieName: string }`.

O teste de tokens não é decorativo: ele impede que alguém escreva `#6C5CE8` numa tela e a
paleta comece a derivar arquivo a arquivo.

- [ ] **Step 1: Escrever o teste que falha**

`tests/tokens.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd C:\willydev\mavo-gerenciamento && npx tsx --test tests/tokens.test.ts
```

Esperado: FAIL com `ENOENT` em `app/globals.css`.

- [ ] **Step 3: Escrever a implementação mínima**

`package.json`:

```json
{
  "name": "mavo-gerenciamento",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=22 <25" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test tests/**/*.test.ts"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "jose": "^5.9.6",
    "recharts": "^2.15.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.0"
  }
}
```

`app/globals.css`:

```css
@import "tailwindcss";

:root {
  --page: #F6F7FB;
  --surface: #FFFFFF;
  --surface-soft: #F8F9FC;
  --ink: #171A2E;
  --ink-soft: #343952;
  --muted: #70778D;
  --muted-light: #9CA2B3;
  --line: #E7E9F0;
  --line-strong: #D9DCE7;
  --primary: #6C5CE7;
  --primary-dark: #5543DA;
  --primary-soft: #EEEBFF;
  --success: #17A673;
  --warning: #E99620;
  --danger: #D64B5D;
  --info: #2878D0;
  --radius-sm: 10px;
  --radius: 14px;
  --radius-lg: 20px;
  --transition: 180ms ease;
}

body {
  background: var(--page);
  color: var(--ink);
  font-feature-settings: "tnum";
}

.numero {
  font-variant-numeric: tabular-nums;
}
```

`lib/env.ts`:

```ts
function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

export const env = {
  get talkBaseUrl() {
    return obrigatoria("TALK_BASE_URL").replace(/\/$/, "");
  },
  get metricsToken() {
    return obrigatoria("MAVO_METRICS_TOKEN");
  },
  get cookieName() {
    return process.env.SESSION_COOKIE_NAME || "mavo_gerenciamento";
  },
};
```

`.env.example`:

```
TALK_BASE_URL=https://
MAVO_METRICS_TOKEN=
SESSION_COOKIE_NAME=mavo_gerenciamento
```

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mavo Gerenciamento",
  description: "Acompanhe o atendimento da sua empresa no WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`tsconfig.json`, `next.config.ts`, `postcss.config.mjs` e `.gitignore`: use os padrões do
`create-next-app` para Next 16 com TypeScript e Tailwind v4, com `paths` mapeando `@/*` para
a raiz do projeto. O `.gitignore` precisa conter `.env`, `.env.local`, `node_modules`, `.next`.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm install && npm test && npm run typecheck
```

Esperado: `pass 3` e `tsc` sem erro.

- [ ] **Step 5: Commit**

```bash
git init && git add . && git commit -m "feat: esqueleto do Mavo Gerenciamento com tokens da paleta Mavo"
```

---

### Task 6: Cliente do Talk e sessão do painel

**Files:**
- Create: `C:\willydev\mavo-gerenciamento\lib\talk-client.ts`
- Create: `C:\willydev\mavo-gerenciamento\lib\sessao.ts`
- Test: `C:\willydev\mavo-gerenciamento\tests\talk-client.test.ts`

**Interfaces:**
- Consumes: `env` (Task 5).
- Produces:
  - `class TalkError extends Error { code: string; status: number }`
  - `talkGet<T>(caminho: string, opcoes?: { token?: string; timeoutMs?: number }): Promise<{ data: T; meta: unknown }>`
  - `talkPost<T>(caminho: string, corpo: unknown, opcoes?: { token?: string }): Promise<{ data: T }>`
  - `acordarTalk(): Promise<boolean>`
  - `gravarSessao(token: string, expiraEm: string): Promise<void>`
  - `lerSessao(): Promise<{ token: string; userId: string; organizationId: string; role: string; name: string; email: string } | null>`
  - `encerrarSessao(): Promise<void>`

O cookie guarda o JWT emitido pelo Talk. O painel **decodifica sem verificar** (`decodeJwt`)
apenas para renderizar nome e papel: o token veio do nosso próprio cookie httpOnly, e
qualquer adulteração morre na verificação do Talk, que é quem tem o segredo.

- [ ] **Step 1: Escrever o teste que falha**

`tests/talk-client.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/talk-client.test.ts
```

Esperado: FAIL com `ENOENT` em `lib/talk-client.ts`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/talk-client.ts`:

```ts
import { env } from "@/lib/env";

const TIMEOUT_PADRAO_MS = 12_000;

export class TalkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TalkError";
  }
}

function cabecalhos(token?: string): HeadersInit {
  const base: Record<string, string> = {
    "x-mavo-service-token": env.metricsToken,
    "content-type": "application/json",
  };
  if (token) base.authorization = `Bearer ${token}`;
  return base;
}

async function interpretar<T>(resposta: Response): Promise<{ data: T; meta: unknown }> {
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = corpo?.error ?? {};
    throw new TalkError(
      erro.code || "internal",
      erro.message || "Não foi possível consultar o Mavo Talk",
      resposta.status,
    );
  }
  return { data: corpo.data as T, meta: corpo.meta };
}

export async function talkGet<T>(
  caminho: string,
  opcoes: { token?: string; timeoutMs?: number } = {},
): Promise<{ data: T; meta: unknown }> {
  const resposta = await fetch(`${env.talkBaseUrl}/api/metrics/v1${caminho}`, {
    headers: cabecalhos(opcoes.token),
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS),
    cache: "no-store",
  });
  return interpretar<T>(resposta);
}

export async function talkPost<T>(
  caminho: string,
  corpo: unknown,
  opcoes: { token?: string } = {},
): Promise<{ data: T }> {
  const resposta = await fetch(`${env.talkBaseUrl}/api/metrics/v1${caminho}`, {
    method: "POST",
    headers: cabecalhos(opcoes.token),
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TIMEOUT_PADRAO_MS),
    cache: "no-store",
  });
  return interpretar<T>(resposta);
}

/** Acorda o Render enquanto o usuário digita a senha. Falha em silêncio de propósito. */
export async function acordarTalk(): Promise<boolean> {
  try {
    const resposta = await fetch(`${env.talkBaseUrl}/api/metrics/v1/health`, {
      headers: { "x-mavo-service-token": env.metricsToken },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    return resposta.ok;
  } catch {
    return false;
  }
}
```

`lib/sessao.ts`:

```ts
import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { env } from "@/lib/env";

export type PerfilSessao = {
  token: string;
  userId: string;
  organizationId: string;
  role: "admin" | "gestor";
  name: string;
  email: string;
};

export async function gravarSessao(token: string, expiraEm: string): Promise<void> {
  const store = await cookies();
  store.set(env.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiraEm),
  });
}

export async function lerSessao(): Promise<PerfilSessao | null> {
  const store = await cookies();
  const token = store.get(env.cookieName)?.value;
  if (!token) return null;
  try {
    const carga = decodeJwt(token) as Record<string, unknown>;
    if (typeof carga.exp === "number" && carga.exp * 1000 <= Date.now()) return null;
    return {
      token,
      userId: String(carga.userId),
      organizationId: String(carga.organizationId),
      role: carga.role === "admin" ? "admin" : "gestor",
      name: String(carga.name ?? ""),
      email: String(carga.email ?? ""),
    };
  } catch {
    return null;
  }
}

export async function encerrarSessao(): Promise<void> {
  const store = await cookies();
  store.delete(env.cookieName);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm test && npm run typecheck
```

Esperado: `pass 7` no total e `tsc` sem erro.

- [ ] **Step 5: Commit**

```bash
git add lib/talk-client.ts lib/sessao.ts tests/talk-client.test.ts
git commit -m "feat: cliente do Talk e sessao em cookie httpOnly"
```

---

### Task 7: Tela de login e casca do painel

**Files:**
- Create: `C:\willydev\mavo-gerenciamento\app\login\page.tsx`
- Create: `C:\willydev\mavo-gerenciamento\app\login\actions.ts`
- Create: `C:\willydev\mavo-gerenciamento\app\(painel)\layout.tsx`
- Create: `C:\willydev\mavo-gerenciamento\app\(painel)\page.tsx`
- Create: `C:\willydev\mavo-gerenciamento\components\nav-topo.tsx`
- Create: `C:\willydev\mavo-gerenciamento\middleware.ts`
- Test: `C:\willydev\mavo-gerenciamento\tests\login.test.ts`

**Interfaces:**
- Consumes: `talkPost`, `acordarTalk`, `TalkError` (Task 6); `gravarSessao`, `lerSessao`
  (Task 6).
- Produces:
  - `entrar(_estado: EstadoLogin, dados: FormData): Promise<EstadoLogin>` — Server Action
  - `type EstadoLogin = { erro: string | null }`
  - Componente `NavTopo({ nome, empresa, ativo }: { nome: string; empresa: string; ativo: string })`

O `middleware.ts` redireciona para `/login` qualquer rota do grupo `(painel)` sem cookie.
Fim da Fase 0: a página do painel mostra só o nome da empresa e um vazio honesto.

- [ ] **Step 1: Escrever o teste que falha**

`tests/login.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/login.test.ts
```

Esperado: FAIL com `ENOENT` em `app/login/page.tsx`.

- [ ] **Step 3: Escrever a implementação mínima**

`app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { TalkError, talkPost } from "@/lib/talk-client";
import { gravarSessao } from "@/lib/sessao";

export type EstadoLogin = { erro: string | null };

const formulario = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

type RespostaLogin = { token: string; expiresAt: string };

export async function entrar(_estado: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const analisado = formulario.safeParse({
    email: dados.get("email"),
    senha: dados.get("senha"),
  });
  if (!analisado.success) {
    return { erro: "Preencha e-mail e senha." };
  }

  try {
    const { data } = await talkPost<RespostaLogin>("/auth/login", {
      email: analisado.data.email,
      password: analisado.data.senha,
    });
    await gravarSessao(data.token, data.expiresAt);
  } catch (erro) {
    if (erro instanceof TalkError && erro.code === "forbidden") {
      return { erro: "Esta conta não tem acesso ao painel de gestão." };
    }
    if (erro instanceof TalkError && erro.code === "rate_limited") {
      return { erro: "Muitas tentativas. Aguarde um minuto." };
    }
    if (erro instanceof TalkError && erro.status === 401) {
      return { erro: "E-mail ou senha inválidos." };
    }
    return { erro: "O Mavo Talk não respondeu. Tente novamente em instantes." };
  }

  redirect("/");
}
```

`app/login/page.tsx`:

```tsx
import { acordarTalk } from "@/lib/talk-client";
import { FormularioLogin } from "./formulario";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Acorda o Render enquanto a página renderiza; o resultado não bloqueia a tela.
  void acordarTalk();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #8173F1 0%, #604DDF 58%, #4533BF 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          padding: "32px",
          width: "min(400px, 100%)",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 500, margin: 0 }}>Mavo Gerenciamento</h1>
        <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
          Acompanhe o atendimento da sua empresa
        </p>
        <FormularioLogin />
      </div>
    </main>
  );
}
```

`app/login/formulario.tsx` (componente cliente com `useActionState`):

```tsx
"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

const inicial: EstadoLogin = { erro: null };

export function FormularioLogin() {
  const [estado, acao, pendente] = useActionState(entrar, inicial);

  return (
    <form action={acao} style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
      <label style={{ display: "grid", gap: "4px", fontSize: "12px", color: "var(--muted)" }}>
        E-mail
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label style={{ display: "grid", gap: "4px", fontSize: "12px", color: "var(--muted)" }}>
        Senha
        <input name="senha" type="password" required autoComplete="current-password" />
      </label>
      {estado.erro ? (
        <p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>{estado.erro}</p>
      ) : null}
      <button type="submit" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
```

`middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nome = process.env.SESSION_COOKIE_NAME || "mavo_gerenciamento";
  if (request.cookies.get(nome)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/", "/equipe/:path*", "/automatico/:path*", "/relatorios/:path*"],
};
```

`app/(painel)/layout.tsx` e `app/(painel)/page.tsx`: layout chama `lerSessao()`, redireciona
para `/login` se nulo, e renderiza `<NavTopo>` com o nome do usuário e a organização. A
página exibe o nome da empresa e a frase "Os indicadores aparecem aqui na próxima entrega."

`components/nav-topo.tsx`: barra branca com a marca, os quatro links (`Visão geral`,
`Relatórios`, `Automático`, `Equipe` — os três últimos desabilitados nesta fase) e o avatar
com a inicial do usuário.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm test && npm run typecheck && npm run build
```

Esperado: `pass 11` no total, `tsc` limpo e build concluído.

- [ ] **Step 5: Commit**

```bash
git add app middleware.ts components tests/login.test.ts
git commit -m "feat: login com aquecimento do Talk e casca do painel"
```

---

# FASE 1 — Visão geral

Pronta quando: o painel vale ser aberto de manhã.

---

### Task 8: Consulta do bloco Agora

**Files:**
- Create: `C:\willydev\willtalk\lib\metrics\live.ts`
- Create: `C:\willydev\willtalk\app\api\metrics\v1\live\route.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-live.test.ts`
- Test: `C:\willydev\willtalk\tests\integration\metrics-queries.test.ts`

**Interfaces:**
- Consumes: `queryTenantDatabase` de `lib/db`; `requireMetricsAccess` (Task 3).
- Produces:
  - `type SnapshotAgora = { naFila: number; emAtendimento: number; pendenteCliente: number; esperaMaisLongaSegundos: number | null; slaEmRisco: number }`
  - `snapshotAgora(organizationId: string): Promise<SnapshotAgora>`

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-live.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a consulta do Agora filtra organization_id explicitamente", async () => {
  const fonte = await readFile("lib/metrics/live.ts", "utf8");
  assert.match(fonte, /organization_id = \$1/);
  assert.match(fonte, /queryTenantDatabase/);
});

test("o Agora usa os quatro estados reais do enum", async () => {
  const fonte = await readFile("lib/metrics/live.ts", "utf8");
  assert.match(fonte, /'aguardando'/);
  assert.match(fonte, /'em_atendimento'/);
  assert.match(fonte, /'pendente_cliente'/);
});

test("a rota do Agora nunca e cacheada", async () => {
  const fonte = await readFile("app/api/metrics/v1/live/route.ts", "utf8");
  assert.match(fonte, /force-dynamic/);
  assert.doesNotMatch(fonte, /revalidate\s*=\s*\d/);
});

test("a rota do Agora usa a organizacao da sessao", async () => {
  const fonte = await readFile("app/api/metrics/v1/live/route.ts", "utf8");
  assert.match(fonte, /session\.organizationId/);
  assert.doesNotMatch(fonte, /searchParams\.get\(["']organization/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-live.test.ts
```

Esperado: FAIL com `ENOENT` em `lib/metrics/live.ts`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/metrics/live.ts`:

```ts
import { queryTenantDatabase } from "@/lib/db";

export type SnapshotAgora = {
  naFila: number;
  emAtendimento: number;
  pendenteCliente: number;
  esperaMaisLongaSegundos: number | null;
  slaEmRisco: number;
};

const SQL = `
  WITH conversas AS (
    SELECT
      count(*) FILTER (WHERE status = 'aguardando')        AS na_fila,
      count(*) FILTER (WHERE status = 'em_atendimento')    AS em_atendimento,
      count(*) FILTER (WHERE status = 'pendente_cliente')  AS pendente_cliente,
      min(created_at) FILTER (WHERE status = 'aguardando') AS mais_antiga
    FROM conversations
    WHERE organization_id = $1 AND status <> 'encerrado'
  ),
  risco AS (
    SELECT count(*) AS sla_em_risco
    FROM tickets
    WHERE organization_id = $1
      AND closed_at IS NULL
      AND first_response_at IS NULL
      AND first_response_due_at IS NOT NULL
      AND first_response_due_at <= now() + interval '5 minutes'
  )
  SELECT
    conversas.na_fila,
    conversas.em_atendimento,
    conversas.pendente_cliente,
    EXTRACT(EPOCH FROM (now() - conversas.mais_antiga)) AS espera_mais_longa,
    risco.sla_em_risco
  FROM conversas, risco
`;

export async function snapshotAgora(organizationId: string): Promise<SnapshotAgora> {
  const { rows } = await queryTenantDatabase(organizationId, SQL, [organizationId]);
  const linha = rows[0] ?? {};
  return {
    naFila: Number(linha.na_fila ?? 0),
    emAtendimento: Number(linha.em_atendimento ?? 0),
    pendenteCliente: Number(linha.pendente_cliente ?? 0),
    esperaMaisLongaSegundos:
      linha.espera_mais_longa === null || linha.espera_mais_longa === undefined
        ? null
        : Math.round(Number(linha.espera_mais_longa)),
    slaEmRisco: Number(linha.sla_em_risco ?? 0),
  };
}
```

`app/api/metrics/v1/live/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireMetricsAccess } from "@/lib/metrics/guard";
import { snapshotAgora } from "@/lib/metrics/live";
import { metricsError } from "@/lib/metrics/envelope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acesso = await requireMetricsAccess(request);
  if (acesso.error) return acesso.error;

  try {
    const data = await snapshotAgora(acesso.session.organizationId);
    return NextResponse.json({ data, meta: { generatedAt: new Date().toISOString() } });
  } catch {
    return metricsError("internal", "Não foi possível consultar o estado atual");
  }
}
```

- [ ] **Step 4: Escrever o teste de integração contra banco real**

Acrescente a `tests/integration/metrics-queries.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { closeDatabasePool } from "../../lib/db";
import { snapshotAgora } from "../../lib/metrics/live";

const rodar = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
const organizacao = process.env.METRICS_TEST_ORG_ID || "";

test("snapshot do Agora devolve numeros nao negativos", { skip: !rodar }, async () => {
  const s = await snapshotAgora(organizacao);
  assert.ok(s.naFila >= 0);
  assert.ok(s.emAtendimento >= 0);
  assert.ok(s.slaEmRisco >= 0);
  await closeDatabasePool();
});
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
npx tsx --test tests/unit/metrics-live.test.ts && npm run typecheck
```

Esperado: `pass 4` e `tsc` limpo. O teste de integração fica `skipped` sem
`RUN_DATABASE_INTEGRATION_TESTS=true`.

- [ ] **Step 6: Commit**

```bash
git add lib/metrics/live.ts app/api/metrics/v1/live tests/unit/metrics-live.test.ts tests/integration/metrics-queries.test.ts
git commit -m "feat: consulta e rota do bloco Agora"
```

---

### Task 9: Consulta dos cartões do período

**Files:**
- Create: `C:\willydev\willtalk\lib\metrics\overview.ts`
- Create: `C:\willydev\willtalk\app\api\metrics\v1\overview\route.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-overview.test.ts`

**Interfaces:**
- Consumes: `queryTenantDatabase`; `resolvePeriod` e `PeriodError` (Task 2);
  `requireMetricsAccess` (Task 3); `metricsEnvelope` e `metricsError` (Task 1);
  `organizationTimezone` de `lib/organization-timezone`.
- Produces:
  - `type FiltrosMetrica = { queueId: string | null; assigneeId: string | null }`
  - `type BlocoPeriodo = { tickets: number; encerrados: number; taxaResolucao: number | null; tmeSegundos: number | null; tmaSegundos: number | null; slaEstourado: number; csat: number | null; csatRespostas: number; mensagensEnviadas: number; mensagensRecebidas: number }`
  - `type Overview = { atual: BlocoPeriodo; anterior: BlocoPeriodo }`
  - `overviewMetrics(organizationId: string, periodo: ResolvedPeriod, filtros: FiltrosMetrica): Promise<Overview>`

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-overview.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a consulta do periodo usa janela semiaberta", async () => {
  const fonte = await readFile("lib/metrics/overview.ts", "utf8");
  assert.match(fonte, /created_at >= \$2/);
  assert.match(fonte, /created_at < \$3/);
  assert.doesNotMatch(fonte, /created_at <= \$3/);
});

test("os filtros de fila e atendente sao opcionais e parametrizados", async () => {
  const fonte = await readFile("lib/metrics/overview.ts", "utf8");
  assert.match(fonte, /\$4::text IS NULL OR queue_id = \$4/);
  assert.match(fonte, /\$5::text IS NULL OR assignee_id = \$5/);
});

test("a rota do overview traduz PeriodError no codigo certo", async () => {
  const fonte = await readFile("app/api/metrics/v1/overview/route.ts", "utf8");
  assert.match(fonte, /PeriodError/);
  assert.match(fonte, /erro\.code/);
});

test("a rota do overview devolve o envelope com comparacao", async () => {
  const fonte = await readFile("app/api/metrics/v1/overview/route.ts", "utf8");
  assert.match(fonte, /metricsEnvelope/);
  assert.match(fonte, /comparison/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-overview.test.ts
```

Esperado: FAIL com `ENOENT` em `lib/metrics/overview.ts`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/metrics/overview.ts`:

```ts
import { queryTenantDatabase } from "@/lib/db";
import type { ResolvedPeriod } from "@/lib/metrics/period";

export type FiltrosMetrica = { queueId: string | null; assigneeId: string | null };

export type BlocoPeriodo = {
  tickets: number;
  encerrados: number;
  taxaResolucao: number | null;
  tmeSegundos: number | null;
  tmaSegundos: number | null;
  slaEstourado: number;
  csat: number | null;
  csatRespostas: number;
  mensagensEnviadas: number;
  mensagensRecebidas: number;
};

export type Overview = { atual: BlocoPeriodo; anterior: BlocoPeriodo };

const SQL_TICKETS = `
  SELECT
    count(*)                                                   AS tickets,
    count(*) FILTER (WHERE closed_at IS NOT NULL)              AS encerrados,
    count(*) FILTER (WHERE first_response_sla_breached_at IS NOT NULL) AS sla_estourado,
    avg(EXTRACT(EPOCH FROM (first_response_at - created_at)))
      FILTER (WHERE first_response_at IS NOT NULL)             AS tme,
    avg(EXTRACT(EPOCH FROM (closed_at - created_at)))
      FILTER (WHERE closed_at IS NOT NULL)                     AS tma,
    avg(satisfaction_score) FILTER (WHERE satisfaction_score IS NOT NULL) AS csat,
    count(*) FILTER (WHERE satisfaction_score IS NOT NULL)      AS csat_respostas
  FROM tickets
  WHERE organization_id = $1
    AND created_at >= $2
    AND created_at < $3
    AND ($4::text IS NULL OR queue_id = $4)
    AND ($5::text IS NULL OR assignee_id = $5)
`;

const SQL_MENSAGENS = `
  SELECT
    count(*) FILTER (WHERE direction = 'outbound') AS enviadas,
    count(*) FILTER (WHERE direction = 'inbound')  AS recebidas
  FROM messages
  WHERE organization_id = $1
    AND created_at >= $2
    AND created_at < $3
`;

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

async function bloco(
  organizationId: string,
  de: Date,
  ate: Date,
  filtros: FiltrosMetrica,
): Promise<BlocoPeriodo> {
  const [tickets, mensagens] = await Promise.all([
    queryTenantDatabase(organizationId, SQL_TICKETS, [
      organizationId,
      de.toISOString(),
      ate.toISOString(),
      filtros.queueId,
      filtros.assigneeId,
    ]),
    queryTenantDatabase(organizationId, SQL_MENSAGENS, [
      organizationId,
      de.toISOString(),
      ate.toISOString(),
    ]),
  ]);

  const t = tickets.rows[0] ?? {};
  const m = mensagens.rows[0] ?? {};
  const total = Number(t.tickets ?? 0);
  const encerrados = Number(t.encerrados ?? 0);

  return {
    tickets: total,
    encerrados,
    taxaResolucao: total > 0 ? encerrados / total : null,
    tmeSegundos: numeroOuNulo(t.tme),
    tmaSegundos: numeroOuNulo(t.tma),
    slaEstourado: Number(t.sla_estourado ?? 0),
    csat: numeroOuNulo(t.csat),
    csatRespostas: Number(t.csat_respostas ?? 0),
    mensagensEnviadas: Number(m.enviadas ?? 0),
    mensagensRecebidas: Number(m.recebidas ?? 0),
  };
}

export async function overviewMetrics(
  organizationId: string,
  periodo: ResolvedPeriod,
  filtros: FiltrosMetrica,
): Promise<Overview> {
  const [atual, anterior] = await Promise.all([
    bloco(organizationId, periodo.from, periodo.to, filtros),
    bloco(organizationId, periodo.comparison.from, periodo.comparison.to, filtros),
  ]);
  return { atual, anterior };
}
```

`app/api/metrics/v1/overview/route.ts`:

```ts
import { requireMetricsAccess } from "@/lib/metrics/guard";
import { metricsEnvelope, metricsError } from "@/lib/metrics/envelope";
import { PeriodError, resolvePeriod } from "@/lib/metrics/period";
import { overviewMetrics } from "@/lib/metrics/overview";
import { organizationTimezone } from "@/lib/organization-timezone";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const acesso = await requireMetricsAccess(request);
  if (acesso.error) return acesso.error;
  const { session } = acesso;

  const url = new URL(request.url);
  const timezone = await organizationTimezone(session.organizationId);

  try {
    const periodo = resolvePeriod({
      name: url.searchParams.get("periodo") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      timezone,
    });
    const filtros = {
      queueId: url.searchParams.get("fila"),
      assigneeId: url.searchParams.get("atendente"),
    };
    const data = await overviewMetrics(session.organizationId, periodo, filtros);

    return metricsEnvelope(data, {
      period: { from: periodo.from.toISOString(), to: periodo.to.toISOString() },
      comparison: {
        from: periodo.comparison.from.toISOString(),
        to: periodo.comparison.to.toISOString(),
      },
      timezone,
      generatedAt: new Date().toISOString(),
      filters: { queueId: filtros.queueId, assigneeId: filtros.assigneeId },
    });
  } catch (erro) {
    if (erro instanceof PeriodError) return metricsError(erro.code, erro.message);
    return metricsError("internal", "Não foi possível calcular os indicadores");
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-overview.test.ts && npm run typecheck
```

Esperado: `pass 4` e `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/overview.ts app/api/metrics/v1/overview tests/unit/metrics-overview.test.ts
git commit -m "feat: consulta e rota dos indicadores do periodo"
```

---

### Task 10: Série temporal e filtros disponíveis

**Files:**
- Create: `C:\willydev\willtalk\lib\metrics\timeseries.ts`
- Create: `C:\willydev\willtalk\lib\metrics\filters.ts`
- Create: `C:\willydev\willtalk\app\api\metrics\v1\timeseries\route.ts`
- Create: `C:\willydev\willtalk\app\api\metrics\v1\filters\route.ts`
- Test: `C:\willydev\willtalk\tests\unit\metrics-timeseries.test.ts`

**Interfaces:**
- Consumes: `queryTenantDatabase`; `ResolvedPeriod` (Task 2); guard e envelope.
- Produces:
  - `type Granularidade = "hour" | "day"`
  - `type BaldeSerie = { instante: string; tickets: number; mensagens: number }`
  - `serieTemporal(organizationId: string, periodo: ResolvedPeriod, granularidade: Granularidade, filtros: FiltrosMetrica): Promise<BaldeSerie[]>`
  - `type OpcoesFiltro = { filas: Array<{ id: string; nome: string; cor: string }>; atendentes: Array<{ id: string; nome: string }> }`
  - `opcoesDeFiltro(organizationId: string): Promise<OpcoesFiltro>`

A granularidade não é escolha livre do cliente: janela de até 2 dias vira `hour`, acima
disso vira `day`. Devolver 2160 pontos para "90d por hora" trava o gráfico e o banco.

- [ ] **Step 1: Escrever o teste que falha**

`tests/unit/metrics-timeseries.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { granularidadeParaJanela } from "../../lib/metrics/timeseries";

test("janela curta agrupa por hora e janela longa por dia", () => {
  const doisDias = 2 * 24 * 60 * 60 * 1000;
  assert.equal(granularidadeParaJanela(doisDias), "hour");
  assert.equal(granularidadeParaJanela(doisDias + 1), "day");
});

test("a serie converte para o fuso da organizacao antes de agrupar", async () => {
  const fonte = await readFile("lib/metrics/timeseries.ts", "utf8");
  assert.match(fonte, /AT TIME ZONE/);
  assert.match(fonte, /date_trunc/);
});

test("a lista de filtros nao vaza atendente de outra empresa", async () => {
  const fonte = await readFile("lib/metrics/filters.ts", "utf8");
  const ocorrencias = fonte.match(/organization_id = \$1/g) || [];
  assert.ok(ocorrencias.length >= 2, "filas e atendentes precisam filtrar por organização");
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/unit/metrics-timeseries.test.ts
```

Esperado: FAIL com `Cannot find module '../../lib/metrics/timeseries'`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/metrics/timeseries.ts`:

```ts
import { queryTenantDatabase } from "@/lib/db";
import type { ResolvedPeriod } from "@/lib/metrics/period";
import type { FiltrosMetrica } from "@/lib/metrics/overview";

export type Granularidade = "hour" | "day";
export type BaldeSerie = { instante: string; tickets: number; mensagens: number };

const DOIS_DIAS_MS = 2 * 24 * 60 * 60 * 1000;

export function granularidadeParaJanela(duracaoMs: number): Granularidade {
  return duracaoMs <= DOIS_DIAS_MS ? "hour" : "day";
}

const SQL = `
  WITH baldes AS (
    SELECT generate_series(
      date_trunc($6, $2::timestamptz AT TIME ZONE $4),
      date_trunc($6, $3::timestamptz AT TIME ZONE $4) - interval '1 ' || $6,
      ('1 ' || $6)::interval
    ) AS instante
  ),
  t AS (
    SELECT date_trunc($6, created_at AT TIME ZONE $4) AS instante, count(*) AS total
    FROM tickets
    WHERE organization_id = $1 AND created_at >= $2 AND created_at < $3
      AND ($5::text IS NULL OR queue_id = $5)
    GROUP BY 1
  ),
  m AS (
    SELECT date_trunc($6, created_at AT TIME ZONE $4) AS instante, count(*) AS total
    FROM messages
    WHERE organization_id = $1 AND created_at >= $2 AND created_at < $3
    GROUP BY 1
  )
  SELECT baldes.instante,
         COALESCE(t.total, 0) AS tickets,
         COALESCE(m.total, 0) AS mensagens
  FROM baldes
  LEFT JOIN t USING (instante)
  LEFT JOIN m USING (instante)
  ORDER BY baldes.instante
`;

export async function serieTemporal(
  organizationId: string,
  periodo: ResolvedPeriod,
  granularidade: Granularidade,
  filtros: FiltrosMetrica,
): Promise<BaldeSerie[]> {
  const { rows } = await queryTenantDatabase(organizationId, SQL, [
    organizationId,
    periodo.from.toISOString(),
    periodo.to.toISOString(),
    periodo.timezone,
    filtros.queueId,
    granularidade,
  ]);
  return rows.map((linha) => ({
    instante: new Date(linha.instante).toISOString(),
    tickets: Number(linha.tickets ?? 0),
    mensagens: Number(linha.mensagens ?? 0),
  }));
}
```

> Ao implementar, valide no `psql` que a interpolação de `$6` em `date_trunc` e em
> `('1 ' || $6)::interval` é aceita pelo driver. Se o Postgres recusar o parâmetro nessa
> posição, troque por um mapa fechado no TypeScript (`{ hour: "hour", day: "day" }`)
> interpolado como literal — **jamais** concatene valor vindo da requisição.

`lib/metrics/filters.ts`:

```ts
import { queryTenantDatabase } from "@/lib/db";

export type OpcoesFiltro = {
  filas: Array<{ id: string; nome: string; cor: string }>;
  atendentes: Array<{ id: string; nome: string }>;
};

const SQL_FILAS = `
  SELECT id, name, color_hex
  FROM queues
  WHERE organization_id = $1
  ORDER BY name
`;

const SQL_ATENDENTES = `
  SELECT id, name
  FROM users
  WHERE organization_id = $1 AND is_active = true
  ORDER BY name
`;

export async function opcoesDeFiltro(organizationId: string): Promise<OpcoesFiltro> {
  const [filas, atendentes] = await Promise.all([
    queryTenantDatabase(organizationId, SQL_FILAS, [organizationId]),
    queryTenantDatabase(organizationId, SQL_ATENDENTES, [organizationId]),
  ]);
  return {
    filas: filas.rows.map((f) => ({
      id: String(f.id),
      nome: String(f.name),
      cor: String(f.color_hex ?? "#6C5CE7"),
    })),
    atendentes: atendentes.rows.map((a) => ({ id: String(a.id), nome: String(a.name) })),
  };
}
```

As rotas `timeseries/route.ts` e `filters/route.ts` seguem exatamente a forma da rota de
overview da Task 9: guard → resolve período → consulta → `metricsEnvelope`, traduzindo
`PeriodError` pelo `code`.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-timeseries.test.ts && npm test && npm run typecheck
```

Esperado: `pass 3` no arquivo, suíte completa do Talk verde e `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/timeseries.ts lib/metrics/filters.ts app/api/metrics/v1/timeseries app/api/metrics/v1/filters tests/unit/metrics-timeseries.test.ts
git commit -m "feat: serie temporal e opcoes de filtro da API de metricas"
```

---

### Task 11: Teste de isolamento entre empresas

**Files:**
- Create: `C:\willydev\willtalk\tests\unit\metrics-isolamento.test.ts`

**Interfaces:**
- Consumes: os arquivos de rota criados nas Tasks 4, 8, 9 e 10.
- Produces: nada em runtime. Produz a garantia que sustenta o ADR-03.

Esta tarefa existe sozinha de propósito: é a única cuja rejeição em revisão significa
"pare tudo". Ela varre o diretório de rotas e falha se **qualquer** rota nova aceitar
organização de fora da sessão — inclusive rotas que ainda serão criadas nas fases 2 a 5.

- [ ] **Step 1: Escrever o teste**

`tests/unit/metrics-isolamento.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = "app/api/metrics/v1";
const SEM_SESSAO = new Set([
  path.join(RAIZ, "health", "route.ts"),
  path.join(RAIZ, "auth", "login", "route.ts"),
]);

async function rotas(diretorio: string): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const aninhadas = await Promise.all(
    entradas.map(async (entrada) => {
      const completo = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) return rotas(completo);
      return entrada.name === "route.ts" ? [completo] : [];
    }),
  );
  return aninhadas.flat();
}

test("nenhuma rota de metricas aceita organizacao vinda da requisicao", async () => {
  for (const rota of await rotas(RAIZ)) {
    const fonte = await readFile(rota, "utf8");
    assert.doesNotMatch(
      fonte,
      /searchParams\.get\(\s*["'](org|organization|organizationId|organization_id|empresa)["']/,
      `${rota} aceita organização por parâmetro`,
    );
    assert.doesNotMatch(
      fonte,
      /headers\.get\(\s*["']x-organization/i,
      `${rota} aceita organização por cabeçalho`,
    );
  }
});

test("toda rota autenticada passa pelo guard e usa a organizacao da sessao", async () => {
  for (const rota of await rotas(RAIZ)) {
    if (SEM_SESSAO.has(rota)) continue;
    const fonte = await readFile(rota, "utf8");
    assert.match(fonte, /requireMetricsAccess/, `${rota} não usa o guard`);
    assert.match(
      fonte,
      /session\.organizationId/,
      `${rota} não deriva a organização da sessão`,
    );
  }
});

test("toda consulta de metrica filtra organization_id explicitamente", async () => {
  const arquivos = (await readdir("lib/metrics")).filter((n) => n.endsWith(".ts"));
  for (const nome of arquivos) {
    const fonte = await readFile(path.join("lib/metrics", nome), "utf8");
    if (!fonte.includes("queryTenantDatabase")) continue;
    assert.match(
      fonte,
      /organization_id = \$1/,
      `lib/metrics/${nome} consulta sem filtro explícito de organização`,
    );
  }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que passa**

```bash
npx tsx --test tests/unit/metrics-isolamento.test.ts
```

Esperado: `pass 3`. Se falhar, **a falha é a rota, não o teste** — corrija a rota.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/metrics-isolamento.test.ts
git commit -m "test: varredura de isolamento entre empresas nas rotas de metricas"
```

---

### Task 12: Barra de contexto com pílulas de filtro

**Files:**
- Create: `C:\willydev\mavo-gerenciamento\lib\periodo.ts`
- Create: `C:\willydev\mavo-gerenciamento\lib\formato.ts`
- Create: `C:\willydev\mavo-gerenciamento\components\barra-contexto.tsx`
- Create: `C:\willydev\mavo-gerenciamento\components\pilula-filtro.tsx`
- Test: `C:\willydev\mavo-gerenciamento\tests\periodo.test.ts`
- Test: `C:\willydev\mavo-gerenciamento\tests\formato.test.ts`

**Interfaces:**
- Consumes: nada do Talk.
- Produces:
  - `const PERIODOS: Array<{ chave: string; rotulo: string }>`
  - `periodoDaUrl(params: URLSearchParams): { chave: string; from?: string; to?: string }`
  - `urlComFiltro(atual: URLSearchParams, chave: string, valor: string | null): string`
  - `formatarNumero(valor: number): string`
  - `formatarDuracao(segundos: number | null): string`
  - `formatarPorcentagem(fracao: number | null): string`
  - `formatarVariacao(atual: number, anterior: number): { texto: string; sentido: "alta" | "baixa" | "estavel" }`

- [ ] **Step 1: Escrever os testes que falham**

`tests/formato.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatarDuracao,
  formatarNumero,
  formatarPorcentagem,
  formatarVariacao,
} from "../lib/formato";

test("duracao vira minuto e hora legiveis", () => {
  assert.equal(formatarDuracao(45), "45s");
  assert.equal(formatarDuracao(240), "4min");
  assert.equal(formatarDuracao(5400), "1h30");
  assert.equal(formatarDuracao(null), "—");
});

test("porcentagem arredonda e trata ausencia", () => {
  assert.equal(formatarPorcentagem(0.8734), "87%");
  assert.equal(formatarPorcentagem(null), "—");
});

test("numero usa separador brasileiro", () => {
  assert.equal(formatarNumero(1234), "1.234");
});

test("variacao contra zero nao vira infinito", () => {
  assert.equal(formatarVariacao(5, 0).sentido, "alta");
  assert.doesNotMatch(formatarVariacao(5, 0).texto, /Infinity|NaN/);
  assert.equal(formatarVariacao(0, 0).sentido, "estavel");
});

test("variacao de queda e marcada como baixa", () => {
  const v = formatarVariacao(8, 10);
  assert.equal(v.sentido, "baixa");
  assert.match(v.texto, /20%/);
});
```

`tests/periodo.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PERIODOS, periodoDaUrl, urlComFiltro } from "../lib/periodo";

test("a lista de periodos cobre a barra inteira", () => {
  assert.deepEqual(
    PERIODOS.map((p) => p.chave),
    ["hoje", "ontem", "semana", "mes", "7d", "30d", "90d", "custom"],
  );
});

test("periodo ausente na url vira hoje", () => {
  assert.equal(periodoDaUrl(new URLSearchParams()).chave, "hoje");
});

test("periodo desconhecido na url vira hoje em vez de quebrar", () => {
  assert.equal(periodoDaUrl(new URLSearchParams("periodo=trimestre")).chave, "hoje");
});

test("aplicar filtro preserva os outros parametros", () => {
  const url = urlComFiltro(new URLSearchParams("periodo=30d&fila=abc"), "atendente", "xyz");
  assert.match(url, /periodo=30d/);
  assert.match(url, /fila=abc/);
  assert.match(url, /atendente=xyz/);
});

test("filtro nulo some da url em vez de virar vazio", () => {
  const url = urlComFiltro(new URLSearchParams("periodo=30d&fila=abc"), "fila", null);
  assert.doesNotMatch(url, /fila=/);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npx tsx --test tests/formato.test.ts tests/periodo.test.ts
```

Esperado: FAIL com `Cannot find module '../lib/formato'`.

- [ ] **Step 3: Escrever a implementação mínima**

`lib/formato.ts`:

```ts
const NUMERO = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor: number): string {
  return NUMERO.format(Math.round(valor));
}

export function formatarDuracao(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos)) return "—";
  const total = Math.round(segundos);
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.round(total / 60)}min`;
  const horas = Math.floor(total / 3600);
  const minutos = Math.round((total % 3600) / 60);
  return minutos === 0 ? `${horas}h` : `${horas}h${String(minutos).padStart(2, "0")}`;
}

export function formatarPorcentagem(fracao: number | null): string {
  if (fracao === null || !Number.isFinite(fracao)) return "—";
  return `${Math.round(fracao * 100)}%`;
}

export function formatarVariacao(
  atual: number,
  anterior: number,
): { texto: string; sentido: "alta" | "baixa" | "estavel" } {
  if (anterior === 0) {
    if (atual === 0) return { texto: "sem mudança", sentido: "estavel" };
    return { texto: "sem base de comparação", sentido: "alta" };
  }
  const variacao = (atual - anterior) / anterior;
  const porcentagem = Math.abs(Math.round(variacao * 100));
  if (porcentagem === 0) return { texto: "sem mudança", sentido: "estavel" };
  return {
    texto: `${porcentagem}% ${variacao > 0 ? "acima" : "abaixo"} do período anterior`,
    sentido: variacao > 0 ? "alta" : "baixa",
  };
}
```

`lib/periodo.ts`:

```ts
export const PERIODOS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "ontem", rotulo: "Ontem" },
  { chave: "semana", rotulo: "Semana" },
  { chave: "mes", rotulo: "Mês" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "90d", rotulo: "90 dias" },
  { chave: "custom", rotulo: "Personalizado" },
] as const;

const CHAVES = new Set(PERIODOS.map((p) => p.chave));

export function periodoDaUrl(params: URLSearchParams): {
  chave: string;
  from?: string;
  to?: string;
} {
  const chave = params.get("periodo") ?? "hoje";
  if (!CHAVES.has(chave as (typeof PERIODOS)[number]["chave"])) return { chave: "hoje" };
  return {
    chave,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
}

export function urlComFiltro(
  atual: URLSearchParams,
  chave: string,
  valor: string | null,
): string {
  const proximo = new URLSearchParams(atual);
  if (valor === null) proximo.delete(chave);
  else proximo.set(chave, valor);
  const query = proximo.toString();
  return query ? `?${query}` : "?";
}
```

`components/pilula-filtro.tsx` e `components/barra-contexto.tsx`: a pílula é um componente
cliente que abre um popover e navega com `router.push(urlComFiltro(...))`; a barra recebe
`OpcoesFiltro` do servidor e renderiza a pílula fixa da empresa (rótulo, sem popover), os
períodos e as duas pílulas de filtro. **Sem botão "Aplicar".**

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npm test && npm run typecheck
```

Esperado: `pass 21` no total e `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add lib/periodo.ts lib/formato.ts components tests/periodo.test.ts tests/formato.test.ts
git commit -m "feat: barra de contexto com pilulas de filtro e formatacao pt-BR"
```

---

### Task 13: Coluna Agora com atualização automática

**Files:**
- Create: `C:\willydev\mavo-gerenciamento\app\api\live\route.ts`
- Create: `C:\willydev\mavo-gerenciamento\components\coluna-agora.tsx`
- Test: `C:\willydev\mavo-gerenciamento\tests\coluna-agora.test.ts`

**Interfaces:**
- Consumes: `talkGet` (Task 6), `lerSessao` (Task 6), `formatarDuracao` (Task 12).
- Produces:
  - `GET /api/live` → `{ naFila, emAtendimento, pendenteCliente, esperaMaisLongaSegundos, slaEmRisco }`
  - Componente `ColunaAgora({ inicial }: { inicial: SnapshotAgora })`

O polling é de 20 s e **para quando a aba perde o foco**. Sem isso, uma aba esquecida aberta
a noite inteira dispara 4.320 consultas no banco de produção sem ninguém olhando.

- [ ] **Step 1: Escrever o teste que falha**

`tests/coluna-agora.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("o proxy do Agora exige sessao", async () => {
  const fonte = await readFile("app/api/live/route.ts", "utf8");
  assert.match(fonte, /lerSessao/);
  assert.match(fonte, /401/);
});

test("o proxy do Agora nunca e cacheado", async () => {
  const fonte = await readFile("app/api/live/route.ts", "utf8");
  assert.match(fonte, /force-dynamic/);
});

test("o polling para quando a aba perde o foco", async () => {
  const fonte = await readFile("components/coluna-agora.tsx", "utf8");
  assert.match(fonte, /visibilitychange|document\.hidden/);
});

test("o polling limpa o intervalo ao desmontar", async () => {
  const fonte = await readFile("components/coluna-agora.tsx", "utf8");
  assert.match(fonte, /clearInterval/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/coluna-agora.test.ts
```

Esperado: FAIL com `ENOENT` em `app/api/live/route.ts`.

- [ ] **Step 3: Escrever a implementação mínima**

`app/api/live/route.ts`:

```ts
import { NextResponse } from "next/server";
import { lerSessao } from "@/lib/sessao";
import { talkGet } from "@/lib/talk-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ error: "sem sessão" }, { status: 401 });
  }
  try {
    const { data } = await talkGet("/live", { token: sessao.token, timeoutMs: 8000 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "indisponível" }, { status: 503 });
  }
}
```

`components/coluna-agora.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatarDuracao, formatarNumero } from "@/lib/formato";

export type SnapshotAgora = {
  naFila: number;
  emAtendimento: number;
  pendenteCliente: number;
  esperaMaisLongaSegundos: number | null;
  slaEmRisco: number;
};

const INTERVALO_MS = 20_000;

export function ColunaAgora({ inicial }: { inicial: SnapshotAgora }) {
  const [dados, setDados] = useState(inicial);
  const [desatualizado, setDesatualizado] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function buscar() {
      if (document.hidden) return;
      try {
        const resposta = await fetch("/api/live", { cache: "no-store" });
        if (!resposta.ok) throw new Error("falhou");
        const novo = (await resposta.json()) as SnapshotAgora;
        if (!ativo) return;
        setDados(novo);
        setDesatualizado(false);
      } catch {
        if (ativo) setDesatualizado(true);
      }
    }

    const intervalo = setInterval(buscar, INTERVALO_MS);
    document.addEventListener("visibilitychange", buscar);
    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", buscar);
    };
  }, []);

  return (
    <aside
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: "14px",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: desatualizado ? "var(--warning)" : "var(--success)",
          }}
        />
        <strong style={{ fontSize: "13px", fontWeight: 500 }}>Agora</strong>
      </header>

      <Linha rotulo="Na fila" valor={formatarNumero(dados.naFila)} />
      <Linha rotulo="Em atendimento" valor={formatarNumero(dados.emAtendimento)} />
      <Linha rotulo="Aguardando cliente" valor={formatarNumero(dados.pendenteCliente)} />
      <Linha
        rotulo="Espera mais longa"
        valor={formatarDuracao(dados.esperaMaisLongaSegundos)}
      />

      {dados.slaEmRisco > 0 ? (
        <p
          style={{
            background: "#FFF0F2",
            color: "#A33C4A",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            margin: "10px 0 0",
            padding: "8px 9px",
          }}
        >
          {formatarNumero(dados.slaEmRisco)} conversa(s) perto do prazo de resposta
        </p>
      ) : null}

      {desatualizado ? (
        <p style={{ color: "var(--muted)", fontSize: "11px", margin: "8px 0 0" }}>
          Sem conexão com o Mavo Talk. Mostrando o último estado conhecido.
        </p>
      ) : null}
    </aside>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div
      style={{
        alignItems: "baseline",
        borderBottom: "1px solid var(--surface-soft)",
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: "12px" }}>{rotulo}</span>
      <span className="numero" style={{ fontSize: "17px" }}>
        {valor}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm test && npm run typecheck
```

Esperado: `pass 25` no total e `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add app/api/live components/coluna-agora.tsx tests/coluna-agora.test.ts
git commit -m "feat: coluna Agora com polling que pausa em aba oculta"
```

---

### Task 14: Bloco do período — métrica herói, secundárias e ritmo

**Files:**
- Create: `C:\willydev\mavo-gerenciamento\components\metrica-heroi.tsx`
- Create: `C:\willydev\mavo-gerenciamento\components\metrica-secundaria.tsx`
- Create: `C:\willydev\mavo-gerenciamento\components\ritmo-periodo.tsx`
- Modify: `C:\willydev\mavo-gerenciamento\app\(painel)\page.tsx`
- Test: `C:\willydev\mavo-gerenciamento\tests\visao-geral.test.ts`

**Interfaces:**
- Consumes: `talkGet` (Task 6); `lerSessao` (Task 6); `formatar*` (Task 12);
  `periodoDaUrl` (Task 12); `ColunaAgora` (Task 13).
- Produces: a página `/` completa — servidor busca `/live`, `/overview`, `/timeseries` e
  `/filters` em paralelo e entrega tudo renderizado.

- [ ] **Step 1: Escrever o teste que falha**

`tests/visao-geral.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("a visao geral busca as quatro fontes em paralelo", async () => {
  const fonte = await readFile("app/(painel)/page.tsx", "utf8");
  assert.match(fonte, /Promise\.all/);
  assert.match(fonte, /\/overview/);
  assert.match(fonte, /\/timeseries/);
  assert.match(fonte, /\/filters/);
  assert.match(fonte, /\/live/);
});

test("a pagina trata o Talk hibernando sem quebrar", async () => {
  const fonte = await readFile("app/(painel)/page.tsx", "utf8");
  assert.match(fonte, /catch/);
  assert.match(fonte, /acordando|indisponível|Mavo Talk/i);
});

test("os graficos nao codificam informacao so por cor", async () => {
  const fonte = await readFile("components/ritmo-periodo.tsx", "utf8");
  assert.match(fonte, /aria-label|<title|role="img"/);
});

test("os numeros usam a classe tabular", async () => {
  const heroi = await readFile("components/metrica-heroi.tsx", "utf8");
  const secundaria = await readFile("components/metrica-secundaria.tsx", "utf8");
  assert.match(heroi, /className="numero"/);
  assert.match(secundaria, /className="numero"/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx tsx --test tests/visao-geral.test.ts
```

Esperado: FAIL com `ENOENT` em `components/metrica-heroi.tsx`.

- [ ] **Step 3: Escrever a implementação mínima**

`components/metrica-heroi.tsx`: cartão branco com rótulo 11px em `--muted`, valor 34px com
`className="numero"`, linha de variação colorida por `sentido` (`alta` → `--success`,
`baixa` → `--danger`, `estavel` → `--muted`) **acompanhada de seta e texto**, e um sparkline
Recharts (`LineChart` sem eixos, `stroke: var(--primary)`) alimentado pela série.

`components/metrica-secundaria.tsx`: cartão menor — rótulo, valor 19px `numero`, e uma linha
de apoio em `--muted-light`.

`components/ritmo-periodo.tsx`: `BarChart` do Recharts com `role="img"` e `aria-label`
descrevendo o pico; barra do pico em `var(--primary)`, demais em `var(--primary-soft)`;
eixo X rotulado por hora ou por dia conforme a granularidade que veio no envelope.

`app/(painel)/page.tsx`:

```tsx
import { lerSessao } from "@/lib/sessao";
import { talkGet, TalkError } from "@/lib/talk-client";
import { periodoDaUrl } from "@/lib/periodo";
import { redirect } from "next/navigation";
import { BarraContexto } from "@/components/barra-contexto";
import { ColunaAgora } from "@/components/coluna-agora";
import { MetricaHeroi } from "@/components/metrica-heroi";
import { MetricaSecundaria } from "@/components/metrica-secundaria";
import { RitmoPeriodo } from "@/components/ritmo-periodo";

export const dynamic = "force-dynamic";

export default async function VisaoGeral({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  const params = new URLSearchParams(
    Object.entries(await searchParams).filter(([, v]) => v) as [string, string][],
  );
  const periodo = periodoDaUrl(params);
  const query = params.toString();
  const token = sessao.token;

  try {
    const [live, overview, serie, filtros] = await Promise.all([
      talkGet("/live", { token }),
      talkGet(`/overview?${query}`, { token }),
      talkGet(`/timeseries?${query}`, { token }),
      talkGet("/filters", { token }),
    ]);

    return (
      <>
        <BarraContexto opcoes={filtros.data} periodoAtivo={periodo.chave} params={params} />
        <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", gap: 14 }}>
          <ColunaAgora inicial={live.data} />
          <div>
            <MetricaHeroi overview={overview.data} serie={serie.data} />
            <MetricaSecundaria overview={overview.data} />
            <RitmoPeriodo serie={serie.data} meta={serie.meta} />
          </div>
        </div>
      </>
    );
  } catch (erro) {
    const demorou = erro instanceof TalkError && erro.status >= 500;
    return (
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        {demorou
          ? "O Mavo Talk está acordando. Atualize a página em alguns segundos."
          : "Não foi possível carregar os indicadores agora."}
      </p>
    );
  }
}
```

- [ ] **Step 4: Rodar tudo e verificar no navegador**

```bash
npm test && npm run typecheck && npm run build
```

Esperado: suíte verde, `tsc` limpo, build concluído. Em seguida suba com `npm run dev`,
entre com um usuário `gestor` real e confira: os números batem com o painel do Talk, trocar
o período muda a URL, e recarregar mantém o recorte.

- [ ] **Step 5: Commit**

```bash
git add app components tests/visao-geral.test.ts
git commit -m "feat: visao geral com metrica heroi, secundarias e ritmo do periodo"
```

---

# FASES 2 a 5 — Escopo travado, plano detalhado sob demanda

As fases abaixo estão **decompostas em tarefas com arquivos, interfaces e critério de
pronto**. O detalhamento passo a passo de cada uma é escrito imediatamente antes de sua
execução, com o mesmo formato das Tasks 1 a 14 — porque decisões tomadas nas Fases 0 e 1
(forma real do SQL agregado, custo das consultas no Supabase free, comportamento do Render
ao acordar) mudam o passo a passo dessas tarefas, e plano escrito cedo demais envelhece
antes de ser executado.

## Fase 2 — Produção da equipe

| Task | Arquivos | Produz | Pronto quando |
|---|---|---|---|
| 15 | `lib/metrics/agents.ts`, `app/api/metrics/v1/agents/route.ts`, `tests/unit/metrics-agents.test.ts` | `producaoPorAtendente(orgId, periodo, filtros): Promise<Array<{ id, nome, tickets, encerrados, tmeSegundos, tmaSegundos, csat, csatRespostas, mensagensEnviadas }>>` | A rota devolve uma linha por atendente ativo, ordenada por volume, e passa na varredura de isolamento |
| 16 | `app/(painel)/equipe/page.tsx`, `components/tabela-equipe.tsx`, `tests/equipe.test.ts` | Tela `/equipe` com tabela ordenável e vazio honesto | O gestor ordena por TME e identifica quem está fora da curva |

## Fase 3 — Atendimento automático

| Task | Arquivos | Produz | Pronto quando |
|---|---|---|---|
| 17 | `lib/metrics/bot.ts`, `app/api/metrics/v1/bot/route.ts`, `tests/unit/metrics-bot.test.ts` | `desempenhoDoBot(orgId, periodo): Promise<{ conversas, resolvidasSemHumano, transferidas, taxaTransferencia, opcoesInvalidas, triagemConcluida }>` | Os números fecham com a soma das conversas do período |
| 18 | `app/(painel)/automatico/page.tsx`, `components/funil-bot.tsx`, `tests/automatico.test.ts` | Tela `/automatico` com funil recebidas → triadas → resolvidas → transferidas | Dá para afirmar em número quanto o bot poupou de atendimento humano |

## Fase 4 — Relatórios

| Task | Arquivos | Produz | Pronto quando |
|---|---|---|---|
| 19 | `lib/metrics/queues.ts`, `app/api/metrics/v1/queues/route.ts`, `tests/unit/metrics-queues.test.ts` | `metricasPorFila(orgId, periodo, filtros): Promise<Array<{ id, nome, cor, tickets, tmeSegundos, slaEstourado }>>` | Soma dos tickets por fila igual ao total do overview no mesmo recorte |
| 20 | `lib/metrics/tickets-report.ts`, `app/api/metrics/v1/reports/tickets/route.ts`, `tests/unit/metrics-report.test.ts` | `linhasDeTicket(orgId, periodo, filtros, paginacao): Promise<{ linhas, total }>` com paginação por cursor e teto de 5.000 linhas | Consulta de 90 dias responde sem estourar o timeout da rota |
| 21 | `app/(painel)/relatorios/page.tsx`, `app/api/relatorios/csv/route.ts`, `components/tabela-relatorio.tsx`, `tests/relatorios.test.ts` | Tela `/relatorios` + exportação CSV gerada por streaming no BFF | O CSV abre no Excel em pt-BR com acento correto (BOM UTF-8) e respeita os filtros da tela |

## Fase 5 — Conta

| Task | Arquivos | Produz | Pronto quando |
|---|---|---|---|
| 22 | `supabase/migrations/2026XXXX_password_reset_tokens.sql`, `lib/metrics/password-reset.ts`, `tests/unit/password-reset.test.ts` | Tabela `password_reset_tokens` (hash do token, `user_id`, `organization_id`, `expires_at`, `used_at`) — **a única migração do projeto**, aditiva | Token expira em 30 min, é de uso único e o hash nunca vira texto claro no banco |
| 23 | `app/api/metrics/v1/auth/password/forgot/route.ts`, `.../reset/route.ts`, `tests/unit/metrics-password-route.test.ts` | Fluxo de recuperação com entrega do link **pelo WhatsApp** via canal existente do Talk | Pedir recuperação para e-mail inexistente responde igual a e-mail existente (sem enumeração) |
| 24 | `app/esqueci/page.tsx`, `app/redefinir/page.tsx`, `tests/recuperacao.test.ts` | Telas de recuperação e redefinição, com política de senha de 10 caracteres | Um usuário real recupera a senha sozinho, sem suporte |
| 25 | `app/api/metrics/v1/users/route.ts`, `.../users/[id]/route.ts`, `app/(painel)/configuracoes/page.tsx`, `tests/unit/metrics-users.test.ts` | CRUD de usuários da própria empresa, restrito a `admin` | `gestor` recebe 403 ao tentar criar usuário, e nenhum papel consegue criar usuário em outra organização |

---

## Autorrevisão do plano

**Cobertura do spec.** Confrontei o plano seção a seção com o documento de design:

| Seção do spec | Onde é implementada |
|---|---|
| §3.2 ADR-01 (API HTTP) | Tasks 1–4, 8–10 |
| §3.2 ADR-02 (browser nunca fala com o Talk) | Tasks 6, 13, 14 |
| §3.2 ADR-03 (organização da sessão) | Tasks 3, 11 |
| §3.2 ADR-04 (Vercel) | Task 5 |
| §3.2 ADR-05 (hibernação) | Tasks 4 (`/health`), 7 (ping), 14 (estado de espera) |
| §3.2 ADR-06 (reuso de `users`) | Task 4 |
| §4.2 envelope | Task 1 |
| §4.4 fuso, teto de 90 dias, rate limit | Tasks 2, 3 |
| §4.4 auditoria em `business_query_audit` | **Lacuna encontrada e corrigida** — ver abaixo |
| §5 métricas | Tasks 8, 9, 10, 15, 17, 19, 20 |
| §6 autenticação | Tasks 4, 6, 7, 22–24 |
| §7 fases | Fases 0–5 deste plano |
| §8 identidade | Tasks 5, 12, 13, 14 |
| §9 testes | Cada task tem teste; Task 11 é o teste de isolamento |

**Lacuna corrigida:** a auditoria de consulta em `business_query_audit` (§4.4 do spec) não
tinha tarefa. Ela pertence ao guard, que é o único ponto pelo qual toda consulta passa —
acrescente ao **Step 3 da Task 3**, depois do rate limit e antes do `return`, a gravação de
`{ organization_id, application_user_id, source: 'api', intent: <rota>, request_id }`,
seguindo a forma já usada por `lib/business-analytics/business-analytics-service.ts`
(função `auditQuery`). O teste correspondente entra no mesmo arquivo:
`assert.match(fonte, /business_query_audit|auditQuery/)`.

**Varredura de marcadores.** Nenhum "TBD", "TODO" ou "implementar depois" nas Tasks 1 a 14.
As duas notas em prosa (assinaturas de `lib/repo` na Task 4; parâmetro de `date_trunc` na
Task 10) são verificações contra o código existente, com o caminho alternativo já escrito —
não são decisões adiadas.

**Consistência de tipos.** `FiltrosMetrica` é definido na Task 9 e importado pela Task 10 do
mesmo caminho (`@/lib/metrics/overview`). `SnapshotAgora` é definido no Talk (Task 8) e
redeclarado no painel (Task 13) de propósito: são repositórios distintos e o contrato entre
eles é HTTP, não um tipo compartilhado. `ResolvedPeriod` (Task 2) é consumido pelas Tasks 9
e 10 com a mesma forma. `metricsError` recebe `MetricsErrorCode` em todos os usos, e
`PeriodError.code` é subconjunto desse tipo — por isso `metricsError(erro.code, …)` compila.
