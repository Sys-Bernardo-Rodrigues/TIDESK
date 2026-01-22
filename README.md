# TIDESK - Sistema de Helpdesk Profissional

Sistema completo de gerenciamento de tickets e suporte ao cliente desenvolvido com React, TypeScript, Node.js. Suporta SQLite (padrão) e PostgreSQL.

## 🚀 Funcionalidades

- **Autenticação de Usuários**: Sistema de login e registro com JWT
- **Gestão de Tickets**: Criar, visualizar, atualizar e gerenciar tickets
- **Sistema de Roles**: Três níveis de acesso (Admin, Agente, Usuário)
- **Categorias**: Organização de tickets por categorias
- **Prioridades**: Sistema de priorização (Baixa, Média, Alta, Urgente)
- **Status de Tickets**: Acompanhamento do status (Aberto, Em Progresso, Resolvido, Fechado)
- **Atribuição**: Agentes podem ser atribuídos a tickets
- **Dashboard**: Visão geral com estatísticas dos tickets
- **Interface Moderna**: UI responsiva e intuitiva

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn

## 🛠️ Instalação

1. Clone o repositório ou navegue até o diretório do projeto

2. Instale todas as dependências:
```bash
npm run install:all
```

3. Configure as variáveis de ambiente:
```bash
cd server
cp .env.example .env
```

Edite o arquivo `.env` para configurar o banco de dados:

**Para SQLite (padrão - mais simples):**
```env
DB_TYPE=sqlite
SQLITE_DB_PATH=./tidesk.db
PORT=5000
JWT_SECRET=tidesk-secret-key-change-in-production
NODE_ENV=development

# Usuário Administrador Padrão
ADMIN_EMAIL=admin@tidesk.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrador
```

**Para PostgreSQL (recomendado para produção):**
```env
DB_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tidesk
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha
POSTGRES_SSL=false
PORT=5000
JWT_SECRET=tidesk-secret-key-change-in-production
NODE_ENV=development

# Usuário Administrador Padrão
ADMIN_EMAIL=admin@tidesk.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrador
```

📖 **Veja mais detalhes em:** `server/CONFIGURACAO_BANCO.md`

## 🚀 Executando o Projeto

### Modo Desenvolvimento (Frontend + Backend)

Execute ambos os servidores simultaneamente:
```bash
npm run dev
```

Isso iniciará:
- Backend na porta 5000 (http://localhost:5000)
- Frontend na porta 3000 (http://localhost:3000)

### Executar Separadamente

**Backend:**
```bash
cd server
npm run dev
```

**Frontend:**
```bash
cd client
npm run dev
```

## 📦 Build para Produção

```bash
npm run build
```

## 👤 Usuário Padrão

Ao iniciar o sistema pela primeira vez, um usuário administrador é criado automaticamente usando as credenciais configuradas no arquivo `.env`:

- **Email**: `admin@tidesk.com` (configurável via `ADMIN_EMAIL`)
- **Senha**: `admin123` (configurável via `ADMIN_PASSWORD`)
- **Nome**: `Administrador` (configurável via `ADMIN_NAME`)

⚠️ **IMPORTANTE**: 
- Altere as credenciais no arquivo `.env` antes de iniciar o sistema em produção
- Altere a senha do administrador após o primeiro acesso!

## 🎯 Estrutura do Projeto

```
TIDESK/
├── server/                 # Backend (Node.js + Express)
│   ├── src/
│   │   ├── routes/        # Rotas da API
│   │   ├── middleware/    # Middlewares (auth, etc)
│   │   ├── database.ts    # Configuração do banco
│   │   └── server.ts      # Servidor principal
│   └── package.json
├── client/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── contexts/      # Context API (Auth)
│   │   └── App.tsx
│   └── package.json
└── package.json           # Scripts principais
```

## 🔐 Níveis de Acesso

### Admin
- Acesso total ao sistema
- Gerenciar usuários
- Gerenciar categorias
- Atribuir tickets
- Alterar status de qualquer ticket

### Agente
- Visualizar todos os tickets
- Atribuir tickets a si mesmo ou outros agentes
- Alterar status de tickets
- Gerenciar tickets atribuídos

### Usuário
- Criar novos tickets
- Visualizar apenas seus próprios tickets
- Atualizar seus próprios tickets (título, descrição, prioridade)

## 📝 API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login

### Tickets
- `GET /api/tickets` - Listar tickets
- `GET /api/tickets/:id` - Obter ticket específico
- `POST /api/tickets` - Criar novo ticket
- `PUT /api/tickets/:id` - Atualizar ticket
- `DELETE /api/tickets/:id` - Deletar ticket (apenas admin/agent)

### Categorias
- `GET /api/categories` - Listar categorias
- `POST /api/categories` - Criar categoria (apenas admin)
- `PUT /api/categories/:id` - Atualizar categoria (apenas admin)
- `DELETE /api/categories/:id` - Deletar categoria (apenas admin)

### Usuários
- `GET /api/users` - Listar usuários (apenas admin)
- `GET /api/users/me` - Obter usuário atual
- `GET /api/users/agents` - Listar agentes (apenas admin)

## 🗄️ Banco de Dados

O sistema suporta **SQLite** (padrão) e **PostgreSQL**. O banco é configurado através do arquivo `.env`.

### SQLite (Padrão)
- Arquivo `tidesk.db` criado automaticamente na primeira execução
- Ideal para desenvolvimento e pequenas instalações
- Não requer configuração adicional

### PostgreSQL
- Requer instalação e configuração do PostgreSQL
- Ideal para produção e ambientes com muitos usuários
- Configure as credenciais no arquivo `.env`

### Tabelas
- **users**: Usuários do sistema
- **tickets**: Tickets de suporte
- **categories**: Categorias de tickets

📖 **Documentação completa:** `server/CONFIGURACAO_BANCO.md`

## 🎨 Tecnologias Utilizadas

### Backend
- Node.js
- Express.js
- TypeScript
- SQLite3 ou PostgreSQL (configurável)
- JWT (JSON Web Tokens)
- bcryptjs
- express-validator

### Frontend
- React 18
- TypeScript
- React Router
- Axios
- Vite
- Lucide React (ícones)

## 📄 Licença

MIT

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

---

Desenvolvido com ❤️ para facilitar o gerenciamento de suporte ao cliente.
