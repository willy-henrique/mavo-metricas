# Mavo Gerenciamento — Documento de Design

> **Status:** aprovado para planejamento · **Data:** 24/08/2026
> **Autor:** Will (com Claude) · **Depende de:** Mavo Talk (`C:\willydev\willtalk`)

---

## 1. O que é

**Mavo Gerenciamento** é a plataforma web onde o **dono ou gerente da empresa cliente**
acompanha o próprio atendimento de WhatsApp operado pelo **Mavo Talk**.

Hoje esse acompanhamento existe só de dois jeitos, ambos ruins: o cliente pede print para
a equipe da Mavo, ou consulta o bot pelo WhatsApp e recebe texto corrido. O Mavo
Gerenciamento dá **tela** a essa informação.

Referência de formato: o módulo MTALK do `gestor.icore.net.br` (painel de operação de
atendimento WhatsApp). A **anatomia funcional** foi adotada; a **identidade visual não** —
ver §8.

### 1.1 Não-objetivos

Escrito antes do código, de propósito:

- **Não atende cliente final.** Não tem caixa de entrada, não responde mensagem, não
  assume conversa. Quem faz isso é a SPA do Mavo Talk.
- **Não configura o Talk.** Fila, bot, horário e promoção continuam no painel do Talk.
- **Não escreve nada no domínio do atendimento.** Conversa, ticket, fila e mensagem são
  somente leitura. As únicas escritas do produto são de **conta**: sessão, senha e
  cadastro de usuários da própria empresa (§7, fase 5).
- **Não é BI de vendas.** Vendas, estoque e ticket médio vivem no subsistema
  `business-analytics` do Talk e continuam servidos pelo WhatsApp. Se um dia entrarem
  aqui, entram como módulo novo, não como escopo desta v1.
- **Não substitui o Mavo Gestão** (`C:\willydev\bloco-maisvarejo`), que é gestão interna
  de trabalho em 5W2H. Produtos diferentes, apesar do nome parecido.

---

## 2. Personas e papéis

| Persona | Papel no Talk | O que faz aqui |
|---|---|---|
| Dono da empresa cliente | `users.role = 'admin'` da organização dele | Vê tudo da própria empresa, administra usuários |
| Gerente / supervisor | `users.role = 'gestor'` | Vê tudo da própria empresa, não administra usuários |
| Atendente | `users.role = 'atendente'` | **Não acessa.** O Gerenciamento recusa o login |

**Escopo de dado:** um usuário enxerga exclusivamente a organização à qual pertence
(`users.organization_id`). Não existe visão multiempresa na v1.

---

## 3. Arquitetura

### 3.1 Topologia

```
MAVO GERENCIAMENTO (novo)                    MAVO TALK (existente)
C:\willydev\mavo-gerenciamento               C:\willydev\willtalk

  Browser
    |  cookie httpOnly
    v
  BFF (Route Handlers)  ---- HTTPS ------>   /api/metrics/v1/*    (novo)
  cache + envelope           Bearer +             |
                             sessao               v
  Vercel (free)                              lib/metrics/*        (novo)
                                                  |
                                                  v
                                             Supabase - RLS por organization_id
                                             Render (free)
```

### 3.2 Decisões de arquitetura

**ADR-01 — Integração por API HTTP, não por banco compartilhado.**
O Gerenciamento não tem credencial de Postgres. Todo dado atravessa a fronteira por
`/api/metrics/v1/*`. Consequência aceita: cada métrica nova exige mudança nos dois
repositórios. Ganho: o Talk continua dono das regras de negócio e do isolamento por
tenant, e não existe um segundo lugar onde a mesma métrica é calculada de outro jeito.

**ADR-02 — O browser nunca fala com o Talk.**
Toda chamada passa pelo BFF do Gerenciamento (Route Handlers server-side). Isso elimina
CORS, mantém o token de serviço fora do cliente e cria o único lugar onde o cache existe.

**ADR-03 — `organization_id` vem sempre da sessão, resolvido no lado do Talk.**
Nunca de query string, header ou corpo. Um `?org=` na requisição é ignorado por
construção. Esta é a regra que impede vazamento entre empresas.

**ADR-04 — Hospedagem no Vercel free, não no Render.**
O Talk roda no Render free e **hiberna após 15 min**. Colocar o painel lá dobraria a
espera. O Vercel free não hiberna e é onde o Mavo Gestão já roda.

**ADR-05 — Mitigação da hibernação do Talk.** Consequência direta do ADR-01 + Render free:

1. `GET /api/metrics/v1/health` é chamado pelo BFF quando a tela de **login** abre, para
   acordar o Talk enquanto o usuário digita a senha.
2. Cache no BFF por natureza do dado: período fechado (ontem, mês passado) por 30 min;
   período corrente por 60 s; bloco **Agora** nunca.
3. Estado de carregamento honesto: passando de 3 s, a tela diz "acordando o servidor",
   não gira spinner mudo.

**ADR-06 — Autenticação reusa `users`, sem migração.**
A tabela `users` do Talk já tem `email`, `password_hash` (bcrypt), `role`
(`admin`/`gestor`/`atendente`), `is_active`, `organization_id` e `last_login_at`.
`bcryptjs` já é dependência. Nada novo precisa ser criado para o login.

**ADR-07 — `business_access_users` não é usado aqui.**
Aquele subsistema é o acesso gerencial **por WhatsApp**, com PIN. Continua existindo e
servindo o WhatsApp. Misturar os dois modelos de identidade criaria duas verdades sobre
quem é o gerente da empresa.

---

## 4. Contrato — API de Métricas v1

Vive no Mavo Talk, em `app/api/metrics/v1/`. Versionada na URL: mudança incompatível
vira `v2`, nunca quebra o `v1` em produção.

### 4.1 Autenticação em dois níveis

| Nível | Prova | Como |
|---|---|---|
| Serviço | Qual aplicação chama | `X-Mavo-Service-Token: <MAVO_METRICS_TOKEN>` — segredo só no servidor do BFF, rotacionável |
| Usuário | Quem é e de qual empresa | `Authorization: Bearer <jwt>` emitido por `/auth/login` |

Ausência de qualquer um dos dois → `401`. Papel `atendente` → `403`.

**Por que o usuário fica no `Authorization` e o serviço num header próprio:**
`lib/auth.ts` do Talk já lê a sessão do `Authorization: Bearer` — foi feito assim porque
painel e API vivem em subdomínios distintos de `onrender.com`, que está na Public Suffix
List, e o Safari descarta o cookie third-party. Reusar esse caminho significa que
`getSession()` e `requireSession()` funcionam nas rotas de métricas **sem alteração**. O
token de serviço, portanto, precisa de header próprio.

### 4.2 Envelope de resposta

Toda resposta de leitura usa o mesmo formato. O painel nunca precisa adivinhar de quando
é o número que está mostrando:

```json
{
  "data": {},
  "meta": {
    "period":     { "from": "2026-08-24T00:00:00-03:00", "to": "2026-08-24T23:59:59-03:00" },
    "comparison": { "from": "...", "to": "..." },
    "timezone":   "America/Sao_Paulo",
    "generated_at": "2026-08-24T14:02:11-03:00",
    "filters":    { "queue_id": null, "assignee_id": null }
  }
}
```

Erro sempre com o mesmo corpo: `{ "error": { "code": "...", "message": "..." } }`.
Códigos: `unauthenticated`, `forbidden`, `invalid_period`, `period_too_long`,
`rate_limited`, `internal`.

### 4.3 Rotas

| Método | Rota | Entrega |
|---|---|---|
| POST | `/auth/login` | e-mail + senha → sessão, organização, papel |
| POST | `/auth/logout` | revoga a sessão |
| POST | `/auth/password/forgot` | dispara link de redefinição pelo WhatsApp |
| POST | `/auth/password/reset` | consome o token e grava a nova senha |
| GET | `/me` | usuário, organização, papel, fuso |
| GET | `/live` | bloco **Agora** — sem cache |
| GET | `/overview` | cartões do período + comparação |
| GET | `/timeseries` | série por hora ou por dia |
| GET | `/queues` | volume, espera e SLA por fila |
| GET | `/agents` | produção por atendente |
| GET | `/bot` | desempenho do atendimento automático |
| GET | `/reports/tickets` | linhas para tabela e exportação |
| GET | `/filters` | filas e atendentes disponíveis (para as pílulas) |
| GET | `/users` | usuários da própria empresa — só papel `admin` |
| POST | `/users` | cria usuário da própria empresa — só papel `admin` |
| PATCH | `/users/{id}` | altera papel ou desativa — só papel `admin` |
| GET | `/health` | leve, sem autenticação de usuário — serve de ping |

As três rotas de `/users` são as **únicas de escrita** além das de `/auth`, e a
organização do alvo é sempre a da sessão — não existe forma de criar ou alterar usuário
de outra empresa.

**Parâmetros comuns às rotas de leitura:** `from`, `to` (ISO 8601), `queue_id`,
`assignee_id`, `granularity` (`hour` ou `day`).

### 4.4 Regras transversais

- **Fuso:** todo corte de dia usa o fuso da organização, resolvido no servidor
  (`lib/organization-timezone.ts` já existe). "Ontem" não pode depender do relógio do
  navegador.
- **Janela máxima:** 90 dias por consulta. Acima disso, `period_too_long`.
- **Rate limit:** 60 requisições por minuto por sessão.
- **Auditoria:** toda consulta grava em `business_query_audit` com `source = 'api'` — a
  tabela já existe e já aceita esse valor.
- **Agregação em SQL, não em memória.** A função `dashboardMetrics` de
  `lib/supabase-repo.ts` traz todos os tickets da organização e conta em JavaScript, sem
  filtro de período. Serve como **referência das fórmulas**, não como implementação.

---

## 5. De onde sai cada número

Verificado contra `supabase/migrations/` do Talk em 24/08/2026.

| Métrica | Fórmula |
|---|---|
| Tickets no período | `count(tickets)` por `created_at` na janela |
| Variação vs anterior | mesma contagem na janela imediatamente anterior de igual duração |
| Abertos + pendentes | `conversations.status IN ('em_atendimento','pendente_cliente')` |
| Na fila agora | `conversations.status = 'aguardando'` |
| Espera mais longa | `now() - min(created_at)` entre as conversas em `aguardando` |
| Mensagens · enviadas/recebidas | `count(messages)` por `direction` (`outbound`/`inbound`) |
| Taxa de resolução | `count(closed_at não nulo) / count(criados)` na janela |
| TME (1ª resposta) | `avg(first_response_at - created_at)` |
| TMA (duração) | `avg(closed_at - created_at)` |
| SLA estourado | `count(first_response_sla_breached_at não nulo)` |
| SLA em risco | `first_response_at` nulo e `first_response_due_at` a vencer |
| CSAT | `avg(satisfaction_score)` e distribuição das notas |
| Taxa de resposta da pesquisa | `satisfaction_rated_at` ÷ `satisfaction_survey_sent_at` |
| Ritmo por hora · pico | `messages.created_at` agrupado por hora do fuso da organização |
| Por fila | junção com `queues` (`name`, `color_hex`) |
| Por atendente | `tickets.assignee_id` → `users.name` |
| Resolvido só pelo bot | conversa encerrada com `triage_completed = false` e sem `assignee_id` |
| Opção inválida no menu | `conversations.menu_attempts` |
| Motivo de encerramento | `tickets.close_reason` |

### 5.1 Lacunas conhecidas do Talk

Duas coisas do painel de referência **não são calculáveis hoje**:

1. **Filtro por conexão.** `channels` existe (`id`, `organization_id`,
   `twilio_phone_number`, `is_active`), mas nem `conversations` nem `messages` guardam
   `channel_id`. **Decisão: fora da v1.** Migração aditiva deixaria todo o histórico
   anterior nulo — um filtro que mente sobre o passado é pior que a ausência dele.
   *Reavaliar quando* a operação usar mais de um número por organização.
2. **Atendente online agora.** Não há presença persistida; só sessão do Socket.IO em
   memória e `users.last_login_at`. **Decisão: o bloco Agora não promete "online".**
   Mostra fila, em atendimento e espera mais longa, que são estado real do banco.

---

## 6. Autenticação e segurança

### 6.1 Login

E-mail e senha contra `users` (bcrypt). `is_active = false` ou `role = 'atendente'` →
recusa. Sessão de 12 h com renovação por atividade, cookie **httpOnly + Secure +
SameSite=Lax** emitido pelo BFF; o token do Talk nunca chega ao JavaScript do browser.

### 6.2 Primeiro acesso e recuperação

- **Primeiro acesso:** a Mavo cria o usuário no painel do Talk e envia link de definição
  de senha.
- **Recuperação:** token de uso único, validade de 30 min, **entregue pelo WhatsApp** no
  número cadastrado. Justificativa: o canal já existe, custa zero e o orçamento do
  projeto é zero. E-mail entra quando houver serviço de envio contratado.
- Senha mínima de 10 caracteres, recusando as óbvias.

### 6.3 Superfície de risco

Este é o primeiro produto Mavo em que **um usuário externo faz login por senha**. Por isso:
bloqueio progressivo após tentativas erradas, auditoria de login e de cada consulta,
sessão curta, e nenhum segredo fora do servidor. O token de serviço **nunca** entra em
`.bat`, doc ou exemplo versionado — já houve incidente com token do MTalk em documentação.

---

## 7. Fases de entrega

Cada fase é fatia vertical: rota no Talk → tela no painel → teste. Nada de "fase só de backend".

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0 — Fundação** | Projeto novo, design tokens, layout, `/auth/login`, `/me`, `/health`, sessão, ping de aquecimento | O cliente entra e vê o nome da própria empresa |
| **1 — Visão geral** | `/live`, `/overview`, `/timeseries`, `/filters` · coluna Agora, métrica herói, secundárias, ritmo por hora, pílulas de filtro na URL | O painel vale ser aberto de manhã |
| **2 — Produção da equipe** | `/agents` · tabela por atendente com TME, TMA, volume, CSAT | Dá para cobrar a operação com número |
| **3 — Atendimento automático** | `/bot` · resolvidas sem humano, taxa de transferência, opções inválidas, triagem | Mostra o valor do bot em número |
| **4 — Relatórios** | `/queues`, `/reports/tickets` · tabelas, filtros, exportação CSV | O dono leva o número para a reunião dele |
| **5 — Conta** | Recuperação de senha, perfil, administração de usuários da empresa (`admin`) | O cliente se vira sozinho |

Fora da v1, registrado para não virar discussão depois: modo escuro, relatório agendado
por e-mail, PDF, multiempresa, filtro por conexão, módulo de vendas, base de contatos
(novos × recorrentes, ranking) e histórico navegável de conversas.

---

## 8. Identidade visual

Direção escolhida: **claro Mavo, duas colunas**. Deliberadamente **não** é o painel de
referência recolorido — três problemas dele foram corrigidos:

| Problema na referência | Correção aqui |
|---|---|
| Barra lateral e abas repetem a mesma navegação | Navegação horizontal única no topo; 190px devolvidos ao conteúdo |
| Oito cartões com peso visual idêntico | Hierarquia em três níveis: herói com micro-gráfico → secundárias → gráfico |
| Filtro com botão "Aplicar", estado invisível | Pílulas que aplicam na hora, estado na URL — o recorte é compartilhável por link |

### 8.1 Tokens

Da paleta Mavo real (`willtalk/app/globals.css`, `app/icon.svg`):

```css
--page:#F6F7FB;  --surface:#FFFFFF;  --surface-soft:#F8F9FC;
--ink:#171A2E;   --ink-soft:#343952; --muted:#70778D;  --muted-light:#9CA2B3;
--line:#E7E9F0;  --line-strong:#D9DCE7;
--primary:#6C5CE7; --primary-dark:#5543DA; --primary-soft:#EEEBFF;
--success:#17A673; --warning:#E99620; --danger:#D64B5D; --info:#2878D0;
--radius-sm:10px; --radius:14px; --radius-lg:20px; --transition:180ms ease;
```

Gradiente de marca `#8173F1 → #604DDF → #4533BF`: **só** no login e na marca. Dentro do
painel, superfície plana — gradiente atrás de número é ruído.

### 8.2 Regras de composição

- **Números em fonte tabular.** Sem isso a coluna "dança" a cada atualização.
- **Pesos 400 e 500 apenas.** 700 deixa o painel gritando.
- **Cor nunca é a única informação.** Toda barra e fatia tem rótulo ou valor.
- **Roxo é acento, não fundo.** Serve o item ativo, a série principal e a ação primária —
  uma ação primária por tela.
- **Gráficos:** Recharts, série principal em `--primary`, secundárias em `--primary-soft`.

### 8.3 Estrutura da Visão geral

```
+---------------------------------------------------------+
| marca · Visão geral · Relatórios · Automático · Equipe   |
+---------------------------------------------------------+
| [Empresa] [Hoje v] [Todas as filas v] [Atendentes v]    |
+--------------+------------------------------------------+
| AGORA        | Tickets hoje    32   +68%    ~~~~~~~     |
| (vivo, sem   |                                          |
|  cache)      | [Mensagens] [Resolução] [CSAT] [SLA]     |
| fila ·       |                                          |
| em atend. ·  | Ritmo por hora   ..||#|:.                |
| espera · SLA |                                          |
+--------------+------------------------------------------+
```

A coluna esquerda se atualiza sozinha; a direita só muda quando o período muda. A divisão
não é estética: é o que permite cachear um lado e não o outro.

A pílula **Empresa** é rótulo de contexto, não seletor: mostra a organização da sessão e
não abre lista, porque não há visão multiempresa na v1 (§2). As demais pílulas —
período, fila, atendente — abrem popover, aplicam na hora e escrevem o estado na URL
(`?periodo=30d&fila=trocas`), de modo que o recorte é compartilhável por link.

---

## 9. Testes

| Área | O que precisa passar |
|---|---|
| **Isolamento entre empresas** | Por rota: sessão da empresa A pedindo dado de B recebe 403 e nada vaza. **Obrigatório, sem exceção** |
| Autenticação | Senha errada, usuário inativo, papel `atendente`, sessão expirada, sessão revogada |
| Cálculo | Cada métrica de §5 contra conjunto sintético de resultado conhecido, incluindo período vazio |
| Fuso e período | Corte de dia no fuso da organização; virada de mês; janela acima de 90 dias recusada |
| Contrato | Schema de resposta validado com Zod nos dois lados; `v1` não muda de forma |
| Resiliência | Talk hibernando: o painel mostra estado de espera, não erro |

---

## 10. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Vazamento entre empresas | Crítico | `organization_id` só da sessão (ADR-03) + teste obrigatório por rota |
| Hibernação do Render atrasa o primeiro acesso | Alto | ADR-05: ping no login, cache por natureza do dado, espera honesta |
| Relatório pesando no banco de produção | Médio | Janela de 90 dias, agregação em SQL, índices por `(organization_id, created_at)`, timeout na rota |
| Divergência entre número do WhatsApp e do painel | Médio | Uma única camada de cálculo no Talk serve os dois canais |
| Token de serviço vazado | Alto | Só no servidor, rotacionável, nunca versionado |
| Mudança de schema no Talk quebra o painel | Médio | Contrato `v1` congelado + teste de contrato nos dois repositórios |

---

## 11. Decisões tomadas sem consulta

Registradas aqui porque foram julgamento meu, e podem ser revertidas:

1. Filtro por conexão fora da v1 (§5.1).
2. Recuperação de senha por WhatsApp, não por e-mail (§6.2).
3. Modo escuro fora da v1 — os tokens já nascem preparados para ele.
4. `dashboardMetrics` existente serve de referência de fórmula, não de implementação (§4.4).

---

## 12. Glossário

| Termo | Significado |
|---|---|
| **BFF** | Backend for Frontend — camada server-side do painel que fala com o Talk |
| **TME** | Tempo médio até a primeira resposta |
| **TMA** | Tempo médio de atendimento, da abertura ao encerramento |
| **CSAT** | Satisfação declarada pelo cliente ao fim do atendimento |
| **Agora** | Bloco de estado atual, nunca cacheado |
| **No período** | Bloco histórico, sempre cacheado |
