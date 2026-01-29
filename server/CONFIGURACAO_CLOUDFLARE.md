# Configuração de Certificados Cloudflare - TIDESK

Este documento explica como configurar o TIDESK para usar certificados de origem (Origin Certificates) do Cloudflare.

## 🎯 Visão Geral

Os **Origin Certificates** do Cloudflare são certificados SSL/TLS que protegem a conexão entre o Cloudflare e seu servidor de origem. Eles são diferentes dos certificados SSL/TLS normais e são usados especificamente quando você usa o Cloudflare como proxy reverso.

## 📋 Pré-requisitos

1. Conta no Cloudflare com o domínio `invixap.com.br` configurado
2. Acesso ao painel do Cloudflare
3. Permissão para gerar Origin Certificates

## 🔐 Passo 1: Gerar Origin Certificate no Cloudflare

1. Acesse o painel do Cloudflare: https://dash.cloudflare.com
2. Selecione o domínio `invixap.com.br`
3. Vá em **SSL/TLS** → **Origin Server**
4. Clique em **Create Certificate**
5. Configure o certificado:
   - **Private key type**: RSA (2048) ou ECDSA (P-256)
   - **Hostnames**: 
     - `tidesk.invixap.com.br`
     - `*.invixap.com.br` (opcional, para subdomínios)
   - **Validity**: Escolha a duração (máximo 15 anos)
6. Clique em **Create**
7. **IMPORTANTE**: Copie e salve:
   - O **Origin Certificate** (certificado)
   - A **Private Key** (chave privada)

⚠️ **ATENÇÃO**: A chave privada só é mostrada uma vez! Salve-a em local seguro.

## 📁 Passo 2: Salvar os Certificados no Servidor

### Opção A: Salvar Manualmente

1. Crie o diretório de certificados (se não existir):
```bash
mkdir -p server/certs
```

2. Salve o **Origin Certificate** em `server/certs/cloudflare.crt`:
```bash
# Cole o conteúdo do Origin Certificate no arquivo
nano server/certs/cloudflare.crt
# ou use seu editor preferido
```

3. Salve a **Private Key** em `server/certs/cloudflare.key`:
```bash
# Cole o conteúdo da Private Key no arquivo
nano server/certs/cloudflare.key
# ou use seu editor preferido
```

4. Configure as permissões corretas:
```bash
chmod 600 server/certs/cloudflare.key  # Apenas leitura/escrita pelo dono
chmod 644 server/certs/cloudflare.crt  # Leitura para todos
```

### Opção B: Usar Script de Ajuda

Execute o script interativo:
```bash
cd server
npm run setup-cloudflare-certs
```

O script irá:
- Criar o diretório `certs/` se necessário
- Solicitar que você cole o certificado e a chave
- Configurar as permissões corretamente
- Criar os arquivos necessários

## 🔗 Passo 3: Baixar o Certificado Intermediário (Opcional mas Recomendado)

O Cloudflare também fornece um certificado intermediário que pode melhorar a compatibilidade:

1. No painel Cloudflare, vá em **SSL/TLS** → **Origin Server**
2. Role até a seção **Cloudflare Origin CA**
3. Baixe o **Origin CA Certificate** (certificado intermediário)
4. Salve em `server/certs/cloudflare.chain.crt`

Ou baixe diretamente:
```bash
curl -o server/certs/cloudflare.chain.crt https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem
```

## ⚙️ Passo 4: Configurar o Servidor

### 4.1. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` no diretório `server/`:

```env
# Habilitar HTTPS
USE_HTTPS=true

# Porta do servidor
PORT=5000

# Host para escutar (0.0.0.0 = todas as interfaces)
HOST=0.0.0.0

# Caminhos dos certificados Cloudflare
SSL_KEY_PATH=certs/cloudflare.key
SSL_CERT_PATH=certs/cloudflare.crt
SSL_CHAIN_PATH=certs/cloudflare.chain.crt
```

### 4.2. Verificar Estrutura de Arquivos

Certifique-se de que os arquivos estão no lugar correto:

```
server/
├── certs/
│   ├── cloudflare.key      # Chave privada
│   ├── cloudflare.crt      # Certificado de origem
│   └── cloudflare.chain.crt # Certificado intermediário (opcional)
└── .env                    # Configurações
```

## 🚀 Passo 5: Reiniciar o Servidor

```bash
# Parar o servidor atual (se estiver rodando)
# Ctrl+C ou kill do processo

# Reiniciar o servidor
cd server
npm run dev
# ou
npm run build && npm start
```

Você deve ver mensagens como:
```
🔒 Servidor TIDESK rodando em HTTPS
   URL: https://localhost:5000
🌐 Acessível de qualquer IP na rede
✅ Certificado intermediário (chain) carregado
🔐 Certificados SSL carregados com sucesso
```

## 🌐 Passo 6: Configurar o Frontend (Vite)

O frontend também precisa usar os certificados Cloudflare. Atualize `client/vite.config.ts`:

```typescript
// Certificados Cloudflare
const certDir = path.resolve(__dirname, '../server/certs')
const keyPath = path.join(certDir, 'cloudflare.key')
const certPath = path.join(certDir, 'cloudflare.crt')
```

Ou mantenha a configuração atual que já busca em `server/certs/` e renomeie os arquivos para `server.key` e `server.crt` (veja alternativa abaixo).

## 🔄 Alternativa: Usar Nomes Padrão

Se preferir usar os nomes padrão (`server.key` e `server.crt`), você pode:

1. Renomear os arquivos:
```bash
cd server/certs
mv cloudflare.key server.key
mv cloudflare.crt server.crt
mv cloudflare.chain.crt server.chain.crt
```

2. Remover as variáveis `SSL_KEY_PATH` e `SSL_CERT_PATH` do `.env` (o sistema usará os padrões)

## ✅ Verificar Funcionamento

### Teste Local:
```bash
curl -k https://localhost:5000/api/health
```

### Teste com Domínio:
```bash
curl https://tidesk.invixap.com.br:5000/api/health
```

### Verificar no Navegador:
1. Acesse: `https://tidesk.invixap.com.br:3333`
2. Verifique se não há avisos de certificado inválido
3. O certificado deve mostrar como válido

## 🔒 Configuração no Cloudflare

### SSL/TLS Mode

No painel do Cloudflare, configure o modo SSL/TLS:

1. Vá em **SSL/TLS** → **Overview**
2. Selecione o modo apropriado:
   - **Full (strict)**: Recomendado - Cloudflare valida o certificado de origem
   - **Full**: Cloudflare não valida o certificado (menos seguro)
   - **Flexible**: Não recomendado - apenas entre navegador e Cloudflare

### Recomendação: Use **Full (strict)**

## 🔧 Troubleshooting

### Erro: "Certificados não encontrados"

**Solução:**
- Verifique se os arquivos estão no caminho correto
- Verifique as variáveis de ambiente no `.env`
- Certifique-se de que os nomes dos arquivos estão corretos

### Erro: "EACCES: permission denied"

**Solução:**
```bash
chmod 600 server/certs/cloudflare.key
chmod 644 server/certs/cloudflare.crt
chmod 644 server/certs/cloudflare.chain.crt
```

### Aviso de Certificado no Navegador

**Causa:** O certificado pode não estar configurado corretamente ou o Cloudflare não está usando o modo correto.

**Solução:**
1. Verifique se o certificado foi salvo corretamente (sem espaços extras, quebras de linha corretas)
2. Verifique o modo SSL/TLS no Cloudflare (deve ser "Full" ou "Full (strict)")
3. Verifique se o domínio está apontando corretamente para o Cloudflare

### Certificado Expirado

**Solução:**
1. Gere um novo Origin Certificate no Cloudflare
2. Substitua os arquivos antigos pelos novos
3. Reinicie o servidor

### Erro: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"

**Causa:** Falta o certificado intermediário (chain).

**Solução:**
1. Baixe o certificado intermediário do Cloudflare
2. Salve em `server/certs/cloudflare.chain.crt`
3. Configure `SSL_CHAIN_PATH` no `.env`
4. Reinicie o servidor

## 📝 Variáveis de Ambiente

| Variável | Descrição | Padrão | Obrigatório |
|----------|-----------|--------|-------------|
| `USE_HTTPS` | Habilita HTTPS (`true`/`false`) | `false` | Sim* |
| `SSL_KEY_PATH` | Caminho para a chave privada | `certs/server.key` | Sim* |
| `SSL_CERT_PATH` | Caminho para o certificado | `certs/server.crt` | Sim* |
| `SSL_CHAIN_PATH` | Caminho para o certificado intermediário | `certs/server.chain.crt` | Não |

\* Obrigatório apenas se `USE_HTTPS=true`

## 🔐 Segurança

### Boas Práticas

1. **Nunca commite certificados ou chaves no Git**
   - Adicione `certs/` ao `.gitignore`
   - Use variáveis de ambiente para caminhos em produção

2. **Permissões de Arquivo**
   - Chave privada: `600` (apenas leitura/escrita pelo dono)
   - Certificados: `644` (leitura para todos)

3. **Renovação**
   - Origin Certificates do Cloudflare podem durar até 15 anos
   - Configure lembretes para renovação antes do vencimento

4. **Backup**
   - Faça backup seguro dos certificados e chaves
   - Armazene em local seguro e criptografado

## 📚 Referências

- [Cloudflare Origin Certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- [Cloudflare SSL/TLS Modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
- [Node.js HTTPS Documentation](https://nodejs.org/api/https.html)

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor
2. Verifique a configuração no painel do Cloudflare
3. Teste a conectividade: `curl -v https://tidesk.invixap.com.br:5000/api/health`
