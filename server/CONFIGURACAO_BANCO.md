# Configuração do Banco de Dados - TIDESK

O TIDESK suporta dois tipos de banco de dados: **SQLite** (padrão) e **PostgreSQL**.

## 📋 Configuração Rápida

1. Copie o arquivo de exemplo:
```bash
cd server
cp .env.example .env
```

2. Edite o arquivo `.env` e configure conforme necessário (veja seções abaixo)

## 🗄️ SQLite (Padrão - Recomendado para Desenvolvimento)

SQLite é o banco padrão e não requer instalação adicional. Ideal para desenvolvimento e pequenas instalações.

### Configuração no .env:
```env
DB_TYPE=sqlite
SQLITE_DB_PATH=./tidesk.db
```

### Vantagens:
- ✅ Não requer instalação de servidor de banco
- ✅ Arquivo único, fácil de fazer backup
- ✅ Perfeito para desenvolvimento
- ✅ Zero configuração

### Desvantagens:
- ⚠️ Não recomendado para produção com muitos usuários simultâneos
- ⚠️ Limitações de concorrência

## 🐘 PostgreSQL (Recomendado para Produção)

PostgreSQL é recomendado para ambientes de produção com muitos usuários simultâneos.

### Pré-requisitos:
- PostgreSQL instalado e rodando
- Banco de dados criado (ou o sistema criará automaticamente)

### Configuração no .env:
```env
DB_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tidesk
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha_aqui
POSTGRES_SSL=false
```

### Para ambientes de produção (ex: Heroku, Railway):
```env
DB_TYPE=postgres
POSTGRES_HOST=seu-host-postgres.com
POSTGRES_PORT=5432
POSTGRES_DB=nome_do_banco
POSTGRES_USER=usuario
POSTGRES_PASSWORD=senha_segura
POSTGRES_SSL=true
```

### Criar banco de dados PostgreSQL:

**Opção 1: Via psql**
```bash
psql -U postgres
CREATE DATABASE tidesk;
\q
```

**Opção 2: O sistema criará as tabelas automaticamente na primeira execução**

### Vantagens:
- ✅ Suporta muitos usuários simultâneos
- ✅ Melhor performance em produção
- ✅ Recursos avançados (transações, índices, etc)
- ✅ Escalável

### Desvantagens:
- ⚠️ Requer instalação e configuração do PostgreSQL
- ⚠️ Mais complexo para desenvolvimento local

## 🔄 Migração entre Bancos

### De SQLite para PostgreSQL:

1. Exportar dados do SQLite (se necessário):
```bash
sqlite3 tidesk.db .dump > backup.sql
```

2. Configurar `.env` para PostgreSQL

3. O sistema criará as tabelas automaticamente

4. Importar dados manualmente se necessário (formato SQL pode precisar de ajustes)

### De PostgreSQL para SQLite:

1. Exportar dados do PostgreSQL
2. Configurar `.env` para SQLite
3. O sistema criará as tabelas automaticamente
4. Importar dados manualmente

## 🛠️ Variáveis de Ambiente Completas

```env
# Tipo de Banco de Dados
DB_TYPE=sqlite                    # ou 'postgres'

# SQLite
SQLITE_DB_PATH=./tidesk.db

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tidesk
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SSL=false

# Servidor
PORT=5000
JWT_SECRET=tidesk-secret-key-change-in-production
NODE_ENV=development

# Usuário Administrador Padrão
# Estas credenciais serão usadas para criar o usuário admin inicial
ADMIN_EMAIL=admin@tidesk.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrador
```

## ⚠️ Notas Importantes

1. **Segurança**: Nunca commite o arquivo `.env` no Git! Ele contém informações sensíveis.

2. **Produção**: Sempre use PostgreSQL em produção e configure `POSTGRES_SSL=true` para conexões seguras.

3. **JWT_SECRET**: Altere o `JWT_SECRET` para um valor seguro e aleatório em produção.

4. **Backup**: Faça backups regulares do banco de dados, especialmente em produção.

## 🐛 Troubleshooting

### Erro de conexão PostgreSQL:
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Verifique se o banco de dados existe
- Teste a conexão: `psql -h localhost -U postgres -d tidesk`

### Erro de permissões SQLite:
- Verifique permissões de escrita no diretório
- Confirme o caminho em `SQLITE_DB_PATH`

### Tabelas não criadas:
- Verifique os logs do servidor
- Confirme que `initDatabase()` está sendo chamado
- Verifique permissões do banco de dados
