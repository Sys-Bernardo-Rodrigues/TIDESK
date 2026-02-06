# Configuração de Rede - Acesso Externo

Este documento explica como configurar o TIDESK para aceitar conexões de todos os IPs, incluindo redes externas.

## ✅ Configurações Aplicadas

O sistema já está configurado para aceitar conexões de qualquer origem:

### 1. CORS (Cross-Origin Resource Sharing)
- **Configurado**: Permite requisições de qualquer origem (`origin: '*'`)
- **Métodos permitidos**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Headers permitidos**: Content-Type, Authorization, x-webhook-secret, x-secret-key

### 2. Trust Proxy
- **Configurado**: Express confia em proxies reversos (nginx, load balancers, etc.)
- **Benefício**: Obtém o IP real do cliente mesmo quando atrás de proxy

### 3. Host de Escuta
- **Configurado**: Servidor escuta em `0.0.0.0` (todas as interfaces de rede)
- **Benefício**: Aceita conexões de qualquer IP na rede

### 4. Limite de Payload
- **Configurado**: 50MB para JSON e URL-encoded
- **Benefício**: Suporta uploads maiores e webhooks com payloads grandes

## 🌐 Acessando o Sistema Externamente

### 1. Descobrir o IP da Máquina

**Windows:**
```bash
ipconfig
```
Procure por "IPv4 Address" na interface de rede ativa.

**Linux/Mac:**
```bash
ip addr show
# ou
ifconfig
```

### 2. Configurar Firewall

#### Windows (Firewall do Windows)
1. Abra "Firewall do Windows com Segurança Avançada"
2. Clique em "Regras de Entrada" → "Nova Regra"
3. Selecione "Porta" → Próximo
4. Selecione "TCP" e digite a porta (ex: 5000)
5. Selecione "Permitir a conexão"
6. Aplique a todas as redes
7. Dê um nome (ex: "TIDESK Backend")

#### Linux (UFW)
```bash
sudo ufw allow 5000/tcp
sudo ufw reload
```

#### Linux (iptables)
```bash
sudo iptables -A INPUT -p tcp --dport 5000 -j ACCEPT
sudo iptables-save
```

### 3. Configurar Variáveis de Ambiente (Opcional)

No arquivo `.env` do servidor, você pode configurar:

```env
# Host para escutar (padrão: 0.0.0.0 - todas as interfaces)
HOST=0.0.0.0

# Porta do servidor (padrão: 5000)
PORT=5000
```

**Nota**: Se você definir `HOST=localhost` ou `HOST=127.0.0.1`, o servidor só aceitará conexões locais.

### 4. Acessar o Sistema

Após configurar o firewall e iniciar o servidor:

**Backend API:**
```
http://SEU_IP:5000/api/health
```

**Frontend (se configurado para produção):**
```
https://SEU_IP
```

## 🔒 Segurança em Produção

### Recomendações:

1. **Use HTTPS**: Configure um proxy reverso (nginx, Apache) com SSL/TLS
2. **Firewall**: Restrinja portas desnecessárias
3. **Autenticação**: Mantenha o sistema de autenticação JWT ativo
4. **Rate Limiting**: Considere adicionar rate limiting para prevenir abusos
5. **CORS Restritivo**: Em produção, considere restringir CORS para domínios específicos

### Exemplo de CORS Restritivo (Produção):

No arquivo `server/src/server.ts`, altere:

```typescript
app.use(cors({
  origin: ['https://seu-dominio.com', 'https://www.seu-dominio.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret', 'x-secret-key'],
  credentials: true
}));
```

## 🌍 Configuração com Proxy Reverso (Nginx)

Para produção, recomenda-se usar Nginx como proxy reverso:

### Exemplo de configuração Nginx:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    # Certificados SSL
    ssl_certificate /caminho/para/certificado.crt;
    ssl_certificate_key /caminho/para/chave.key;

    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Proxy para o backend
    location /api {
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

    # Servir arquivos estáticos do frontend
    location / {
        root /caminho/para/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## 📡 Webhooks Externos

Com as configurações aplicadas, webhooks podem ser chamados de qualquer IP externo:

**URL do Webhook:**
```
http://SEU_IP:5000/api/webhooks/receive/WEBHOOK_URL
```

**Ou com domínio:**
```
https://seu-dominio.com/api/webhooks/receive/WEBHOOK_URL
```

## 🧪 Testando Acesso Externo

### 1. Teste de Health Check:
```bash
curl http://SEU_IP:5000/api/health
```

### 2. Teste de Webhook:
```bash
curl -X POST http://SEU_IP:5000/api/webhooks/receive/SEU_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SUA_SECRET_KEY" \
  -d '{"test": true, "message": "Teste de webhook"}'
```

## ⚠️ Troubleshooting

### Servidor não aceita conexões externas:

1. **Verifique o firewall**: Certifique-se de que a porta está aberta
2. **Verifique o HOST**: Deve ser `0.0.0.0` ou não definido (usa padrão)
3. **Verifique logs**: Veja se há erros no console do servidor
4. **Teste localmente primeiro**: `curl http://localhost:5000/api/health`

### CORS bloqueando requisições:

1. **Verifique a configuração CORS**: Deve estar como `origin: '*'`
2. **Verifique headers**: Certifique-se de que os headers necessários estão permitidos
3. **Verifique o navegador**: Alguns navegadores têm políticas CORS mais restritivas

### Webhooks não funcionam externamente:

1. **Verifique a URL**: Use o IP ou domínio correto
2. **Verifique o firewall**: Porta 5000 deve estar acessível
3. **Verifique logs**: Veja os logs do servidor para erros
4. **Teste com curl**: Use curl para testar diretamente

## 📝 Notas Importantes

- **Desenvolvimento**: As configurações atuais são ideais para desenvolvimento e testes
- **Produção**: Considere restringir CORS e usar HTTPS
- **Segurança**: Sempre use autenticação e validação de dados
- **Monitoramento**: Monitore logs e tráfego para detectar atividades suspeitas
