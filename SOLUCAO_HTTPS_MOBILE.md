# Solução para Problema de Redirecionamento HTTPS em Dispositivos Móveis

## 🔍 Problema Identificado

O sistema estava redirecionando automaticamente para HTTPS, impedindo o acesso em dispositivos móveis quando o servidor não possui certificado SSL válido configurado.

## ✅ Soluções Implementadas

### 1. Middleware no Servidor Express
- Adicionado middleware que remove headers `Strict-Transport-Security` que forçam HTTPS
- Garantido que o servidor aceita conexões HTTP explicitamente
- Configurado para não redirecionar para HTTPS quando não há certificado SSL configurado

**Arquivo modificado:** `server/src/server.ts`

### 2. Configuração do Vite
- Configurado `https: false` para garantir que não força HTTPS
- Adicionado `secure: false` nos proxies para permitir conexões HTTP
- Mantido suporte para acesso via HTTP em dispositivos móveis

**Arquivo modificado:** `client/vite.config.ts`

### 3. Meta Tags no HTML
- Removidas meta tags que forçam upgrade para HTTPS
- Mantida configuração que permite acesso via HTTP

**Arquivo modificado:** `client/index.html`

## 🔧 Se Você Estiver Usando Nginx como Proxy Reverso

Se você tiver um proxy reverso Nginx configurado que está forçando HTTPS, você precisa ajustar a configuração:

### Opção 1: Desabilitar Redirecionamento HTTPS (Recomendado para Desenvolvimento)

Edite o arquivo de configuração do Nginx (geralmente em `/etc/nginx/sites-available/tidesk`):

```nginx
server {
    listen 80;
    server_name tidesk.invicco.com.br 187.45.113.150;

    # NÃO redirecionar para HTTPS - permitir HTTP
    # Comentar ou remover esta linha:
    # return 301 https://$server_name$request_uri;

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

    # Proxy para o frontend (Vite)
    location / {
        proxy_pass http://localhost:3333;
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

Depois de editar, recarregue o Nginx:
```bash
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx  # Recarregar Nginx
```

### Opção 2: Configurar HTTPS Corretamente (Recomendado para Produção)

Se você quiser usar HTTPS em produção, você precisa:

1. **Obter um certificado SSL válido** (Let's Encrypt é gratuito):
```bash
sudo certbot --nginx -d tidesk.invicco.com.br
```

2. **Configurar Nginx com HTTPS:**
```nginx
server {
    listen 80;
    server_name tidesk.invicco.com.br 187.45.113.150;
    
    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tidesk.invicco.com.br 187.45.113.150;

    # Certificados SSL
    ssl_certificate /etc/letsencrypt/live/tidesk.invicco.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tidesk.invicco.com.br/privkey.pem;

    # Configurações SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

    # Proxy para o frontend
    location / {
        proxy_pass http://localhost:3333;
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

## 📱 Testando em Dispositivos Móveis

### 1. Limpar Cache do Navegador
Alguns navegadores móveis podem ter cacheado o redirecionamento HTTPS. Limpe o cache:

**Android (Chrome):**
- Menu → Configurações → Privacidade → Limpar dados de navegação

**iOS (Safari):**
- Configurações → Safari → Limpar histórico e dados do site

### 2. Testar Acesso Direto
Tente acessar diretamente via HTTP:
```
http://tidesk.invicco.com.br:3333
http://187.45.113.150:3333
```

### 3. Verificar se o Servidor Está Respondendo
Teste se o servidor está respondendo corretamente:
```bash
curl -I http://tidesk.invicco.com.br:3333
curl -I http://187.45.113.150:3333
```

## ⚠️ Troubleshooting

### Problema: Ainda está redirecionando para HTTPS

1. **Verifique se há múltiplos proxies reversos:**
   - Verifique se há Apache, Nginx ou outros proxies configurados
   - Verifique configurações de firewall/roteador que possam estar redirecionando

2. **Verifique headers HTTP:**
   ```bash
   curl -I http://tidesk.invicco.com.br:3333
   ```
   Procure por headers como `Strict-Transport-Security` ou `Location: https://`

3. **Verifique logs do servidor:**
   ```bash
   # Logs do Nginx (se estiver usando)
   sudo tail -f /var/log/nginx/error.log
   sudo tail -f /var/log/nginx/access.log
   
   # Logs do servidor Node.js
   # Verifique o console onde o servidor está rodando
   ```

### Problema: Navegador móvel ainda força HTTPS

Alguns navegadores têm políticas de segurança que tentam forçar HTTPS. Para contornar:

1. **Use modo de navegação anônima/privada**
2. **Desabilite "Sempre usar conexões seguras" nas configurações do navegador**
3. **Use um navegador diferente temporariamente para testar**

### Problema: Certificado SSL inválido

Se você estiver usando HTTPS mas com certificado auto-assinado ou inválido:

1. **Para desenvolvimento:** Use HTTP (solução implementada)
2. **Para produção:** Obtenha um certificado válido do Let's Encrypt

## 📝 Notas Importantes

- As alterações implementadas permitem acesso via HTTP sem forçar HTTPS
- Para produção, recomenda-se configurar HTTPS corretamente com certificado válido
- O sistema agora funciona tanto em HTTP quanto HTTPS (se configurado)
- Dispositivos móveis devem conseguir acessar via HTTP após essas alterações

## 🔄 Próximos Passos

1. Reinicie o servidor Node.js para aplicar as mudanças
2. Se estiver usando Nginx, ajuste a configuração conforme necessário
3. Teste o acesso em dispositivos móveis
4. Se necessário, configure HTTPS corretamente para produção
