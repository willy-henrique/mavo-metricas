# mavo-metricas

Painel de gerenciamento do Mavo para acompanhar métricas de atendimento, produção da equipe, atendimento automático e relatórios do WhatsApp.

## Arquitetura

Este repositório contém somente o painel Next.js. O navegador conversa com o servidor do painel, que funciona como BFF e acessa a API privada do Mavo Talk em `/api/metrics/v1`.

- O navegador nunca recebe `TALK_BASE_URL` nem `MAVO_METRICS_TOKEN`.
- A empresa é sempre obtida da sessão emitida pelo Mavo Talk.
- O painel não precisa de banco de dados próprio.
- Os dados continuam no PostgreSQL/Supabase usado pelo Mavo Talk.

## Desenvolvimento local

Requisitos: Node.js 22, npm e uma instância compatível do Mavo Talk.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure `.env.local` sem versionar segredos:

```env
TALK_BASE_URL=http://localhost:4002
MAVO_METRICS_TOKEN=use-o-mesmo-token-configurado-no-talk
SESSION_COOKIE_NAME=mavo_gerenciamento
```

O painel fica disponível em `http://localhost:3000`.

## Verificações

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Deploy no Vercel

Importe este repositório no Vercel e configure as variáveis abaixo nos ambientes desejados:

| Variável | Valor |
|---|---|
| `TALK_BASE_URL` | URL pública HTTPS do Mavo Talk em produção, sem barra final |
| `MAVO_METRICS_TOKEN` | Segredo forte, idêntico ao configurado no Mavo Talk |
| `SESSION_COOKIE_NAME` | `mavo_gerenciamento` |

Nenhuma dessas variáveis deve começar com `NEXT_PUBLIC_`.

No serviço do Mavo Talk, no Render, configure:

| Variável | Valor |
|---|---|
| `MAVO_METRICS_TOKEN` | Exatamente o mesmo segredo definido no Vercel |
| `MAVO_MANAGEMENT_URL` | URL final do painel, por exemplo `https://mavo-metricas.vercel.app` |

O `MAVO_MANAGEMENT_URL` é usado nos links de recuperação de senha. Depois de alterar as variáveis, faça um novo deploy dos dois serviços.

## Pré-requisitos no Mavo Talk

Antes de publicar o painel, confirme que o Mavo Talk em produção possui:

1. As rotas `/api/metrics/v1/health`, `/auth/login`, `/me`, `/live`, `/overview`, `/timeseries` e `/filters`.
2. A migration `password_reset_tokens` aplicada para o fluxo de recuperação de senha.
3. Um usuário ativo com papel `admin` ou `gestor`.
4. A conexão com o PostgreSQL/Supabase saudável.

Teste o health protegido sem registrar o token em arquivos ou histórico público:

```bash
curl -H "x-mavo-service-token: $MAVO_METRICS_TOKEN" \
  "$TALK_BASE_URL/api/metrics/v1/health"
```

A resposta esperada é `{"status":"ok","database":true}`.

## Segurança

- Nunca versione `.env`, `.env.local`, tokens, JWTs ou credenciais de banco.
- Gere um token diferente para produção e desenvolvimento.
- Troque `MAVO_METRICS_TOKEN` nos dois serviços ao mesmo tempo.
- O login local de desenvolvimento não deve ser reutilizado em produção.
