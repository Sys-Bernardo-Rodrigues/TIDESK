# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

Monorepo com dois workspaces independentes (`client/`, `server/`), sem tooling compartilhado (lerna/turborepo/workspaces do npm) — cada um tem seu próprio `node_modules` e `package.json`.

```bash
# instalar tudo (raiz + client + server)
npm run install:all

# dev (client + server simultâneos, via concurrently)
npm run dev
# ou separado:
npm run dev:server    # tsx watch src/server.ts (porta 5000)
npm run dev:client    # vite (porta 3000)

# build
npm run build         # build:server (tsc) + build:client (tsc && vite build)

# start produção
npm run start         # server compilado + vite preview
```

Não há suíte de testes configurada (nenhum test runner no `package.json` de `client` ou `server`). Não invente comando `npm test`.

## Arquitetura

Sistema de helpdesk (TIDESK): React SPA + API Express, banco dual SQLite/Postgres.

### Backend (`server/src`)

- **`database.ts`** (arquivo único, ~1600 linhas) — concentra toda a camada de dados: interfaces de todas as entidades (`User`, `Ticket`, `Category`, `Form`, `FormField`, etc.), inicialização de schema para SQLite e Postgres, e um adapter (`dbAdapter`) que expõe `dbRun`/`dbGet`/`dbAll` como interface única independente do `DB_TYPE` (`sqlite` padrão ou `postgres`, via `.env`). Toda rota importa `dbGet`/`dbAll`/`dbRun` daqui — não há ORM.
- **`routes/`** — um arquivo por recurso (tickets, forms, pages, access-profiles, groups, calendar, shifts, backup, webhooks, projects, docs, reports, dashboard, updates, ticket-messages, users, categories, auth). Todas montadas em `server.ts` sob `/api/<recurso>`.
- **`middleware/auth.ts`** — `authenticate` valida JWT e popula `req.userId`/`req.userRole`. Roles diretos: `admin`, `agent`, `user`. `requireAdmin` também aceita perfil de administrador via tabela `user_access_profiles`/`access_profiles` (perfis são um sistema de permissão granular além do role fixo).
- **`middleware/permissions.ts`** — sistema de permissões por recurso/ação (`RESOURCES` × `ACTIONS`) além dos roles fixos, com cache em memória (`Map`, TTL 5 min) por usuário — não usa Redis.
- **`services/`** — jobs/integrações de fundo: `backup-scheduler`/`backup-service` (backup agendado do banco), `email-service` (nodemailer), `update-service` (checagem de novas versões, ligado a `routes/updates.ts` e ao badge de versão da UI).
- Uploads servidos estaticamente em `/uploads`; geração de PDF via `jspdf`, parsing de docx/pdf via `mammoth`/`pdf-parse` (usado por Forms/Docs).
- Suporte a HTTPS/Cloudflare/systemd para deploy self-hosted — ver `docs/CONFIGURACAO_HTTPS.md`, `docs/CONFIGURACAO_CLOUDFLARE.md`, `docs/SERVICO_SYSTEMD.md`, `scripts/`.

### Frontend (`client/src`)

- **`contexts/`** — `AuthContext` (sessão/JWT) e `ThemeContext` (dark/light) envolvem a árvore de páginas.
- **`hooks/usePermissions.ts`** — espelha no client o sistema de permissões por recurso/ação do backend; usar para exibir/ocultar UI conforme permissão, não confiar só em esconder botão (backend já re-valida).
- **`pages/`** — uma página por rota principal (Tickets, FormBuilder, PageBuilder, ServiceCalendar, ShiftCalendar, AccessProfile, Webhooks, Projetos, Reports, etc.); nomes em português refletem os módulos do produto. `PublicForm.tsx`/`PublicPage.tsx` são views sem autenticação (formulários e páginas publicadas publicamente).
- Sem Redux/Zustand — estado via Context API + estado local. Sem Tailwind/UI kit — estilização própria.
- Roteamento via `react-router-dom`; chamadas API via `axios`.

### Convenções entre camadas

- Nomenclatura de domínio majoritariamente em português (rotas, campos de UI, docs) — manter consistência ao adicionar features.
- Toda entidade nova precisa: interface em `database.ts` + init de schema (SQLite **e** Postgres, os dois blocos existem lado a lado) + rota em `routes/` + registro em `server.ts` + permissão em `RESOURCES`/`ACTIONS` se relevante.
- `docs/` contém runbooks operacionais (não docs de arquitetura) — configuração de banco, HTTPS, Cloudflare, rede, Zabbix, systemd. Consultar antes de mexer em infra/deploy.
