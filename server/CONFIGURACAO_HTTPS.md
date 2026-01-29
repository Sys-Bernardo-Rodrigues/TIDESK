# Configuração HTTPS - TIDESK Server

Este documento explica como configurar o servidor TIDESK para funcionar com HTTPS.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Geração de Certificados](#geração-de-certificados)
3. [Configuração do Servidor](#configuração-do-servidor)
4. [Produção](#produção)
5. [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

O servidor TIDESK suporta HTTPS através de certificados SSL/TLS. Para desenvolvimento, você pode usar certificados auto-assinados. Para produção, recomenda-se usar certificados de uma Autoridade Certificadora (CA) confiável, como Let's Encrypt.

## 🔐 Geração de Certificados

### Método 1: Usando o Script Automático (Recomendado)

O projeto inclui um script que gera certificados SSL auto-assinados automaticamente:

```bash
npm run generate-certs
```

Este script:
- Cria o diretório `certs/` se não existir
- Gera certificados válidos por 365 dias
- Suporta localhost e IPs locais (127.0.0.1, ::1)
- Funciona com OpenSSL (se disponível) ou Node.js (fallback)

**Com hostname personalizado:**
```bash
npm run generate-certs meu-dominio.com
```

### Método 2: Usando OpenSSL Manualmente

Se você tem OpenSSL instalado, pode gerar os certificados manualmente:

```bash
# Criar diretório de certificados
mkdir -p certs

# Gerar chave privada
openssl genrsa -out certs/server.key 2048

# Gerar certificado auto-assinado
openssl req -new -x509 -key certs/server.key -out certs/server.crt -days 365 \
  -subj "/C=BR/ST=Sao Paulo/L=Sao Paulo/O=TIDESK/CN=localhost"
```

### Método 3: Certificados para Produção (Let's Encrypt)

Para produção, use certificados de uma CA confiável:

#### Usando Certbot (Let's Encrypt):

```bash
# Instalar Certbot
sudo apt-get install certbot  # Ubuntu/Debian
# ou
brew install certbot  # macOS

# Gerar certificados
sudo certbot certonly --standalone -d seu-dominio.com

# Os certificados estarão em:
# /etc/letsencrypt/live/seu-dominio.com/fullchain.pem
# /etc/letsencrypt/live/seu-dominio.com/privkey.pem
```

## ⚙️ Configuração do Servidor

### 1. Habilitar HTTPS

Edite o arquivo `.env` e configure:

```env
USE_HTTPS=true
PORT=5000
HOST=0.0.0.0
```

### 2. Caminhos dos Certificados (Opcional)

Por padrão, o servidor procura os certificados em:
- Chave: `certs/server.key`
- Certificado: `certs/server.crt`

Se seus certificados estão em outro local, configure:

```env
SSL_KEY_PATH=/caminho/para/sua/chave.key
SSL_CERT_PATH=/caminho/para/seu/certificado.crt
```

### 3. Redirecionamento HTTP → HTTPS (Opcional)

Para redirecionar automaticamente requisições HTTP para HTTPS, configure:

```env
HTTP_REDIRECT_PORT=80
```

Isso criará um servidor HTTP na porta 80 que redireciona todas as requisições para HTTPS.

### 4. Reiniciar o Servidor

```bash
npm run dev
# ou
npm run build && npm start
```

## 🚀 Produção

### Recomendações para Produção

1. **Use Certificados de CA Confiável**
   - Let's Encrypt (gratuito)
   - Outras CAs comerciais

2. **Configure Proxy Reverso**
   - Use Nginx ou Apache como proxy reverso
   - Eles podem gerenciar SSL/TLS e redirecionamento
   - Exemplo de configuração Nginx está em `CONFIGURACAO_REDE.md`

3. **Firewall**
   - Abra apenas as portas necessárias (443 para HTTPS)
   - Bloqueie acesso direto à porta do Node.js se usar proxy reverso

4. **Segurança Adicional**
   - Configure HSTS (já incluído no código)
   - Use TLS 1.2 ou superior
   - Configure ciphers seguros

### Exemplo de Configuração Nginx com HTTPS

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name seu-dominio.com;
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS
server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy para o backend Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 Troubleshooting

### Erro: "Certificados não encontrados"

**Solução:**
```bash
npm run generate-certs
```

Verifique se os arquivos foram criados em `certs/server.key` e `certs/server.crt`.

### Erro: "EACCES: permission denied"

**Solução:**
Certifique-se de que o servidor tem permissão para ler os arquivos de certificado:
```bash
chmod 600 certs/server.key
chmod 644 certs/server.crt
```

### Aviso de Certificado no Navegador

**Causa:** Certificados auto-assinados não são confiáveis por padrão.

**Solução para Desenvolvimento:**
- Clique em "Avançado" → "Continuar para o site"
- Adicione uma exceção no navegador

**Solução para Produção:**
- Use certificados de uma CA confiável (Let's Encrypt)

### Porta 443 já em uso

**Causa:** Outro serviço está usando a porta 443.

**Solução:**
- Use outra porta (ex: 8443) e configure no `.env`:
  ```env
  PORT=8443
  ```
- Ou configure um proxy reverso (Nginx/Apache) na porta 443

### Certificados Expirados

**Solução:**
Regenere os certificados:
```bash
npm run generate-certs
```

Para Let's Encrypt, renove automaticamente:
```bash
sudo certbot renew
```

## 📝 Variáveis de Ambiente

| Variável | Descrição | Padrão | Obrigatório |
|----------|-----------|--------|-------------|
| `USE_HTTPS` | Habilita HTTPS (`true`/`false`) | `false` | Não |
| `SSL_KEY_PATH` | Caminho para a chave privada | `certs/server.key` | Não* |
| `SSL_CERT_PATH` | Caminho para o certificado | `certs/server.crt` | Não* |
| `HTTP_REDIRECT_PORT` | Porta para redirecionamento HTTP→HTTPS | - | Não |
| `PORT` | Porta do servidor HTTPS | `5000` | Não |
| `HOST` | Host para escutar | `0.0.0.0` | Não |

\* Obrigatório apenas se `USE_HTTPS=true`

## 🔒 Segurança

### Boas Práticas

1. **Nunca commite certificados ou chaves privadas no Git**
   - Adicione `certs/` ao `.gitignore`
   - Use variáveis de ambiente para caminhos em produção

2. **Permissões de Arquivo**
   - Chave privada: `600` (apenas leitura/escrita pelo dono)
   - Certificado: `644` (leitura para todos)

3. **Renovação Automática**
   - Configure renovação automática para Let's Encrypt
   - Certificados auto-assinados devem ser regenerados antes de expirar

4. **Monitoramento**
   - Monitore a expiração dos certificados
   - Configure alertas para certificados próximos do vencimento

## 📚 Referências

- [Let's Encrypt](https://letsencrypt.org/)
- [Certbot Documentation](https://certbot.eff.org/)
- [Node.js HTTPS Documentation](https://nodejs.org/api/https.html)
- [OpenSSL Documentation](https://www.openssl.org/docs/)
