# Configuração de Acesso Externo - TIDESK

Este documento descreve como configurar o acesso externo ao TIDESK através do domínio e IP externo.

## 🌐 Acessos Configurados

- **Domínio**: http://tidesk.invicco.com.br:3333
- **IP Externo**: http://187.45.113.150:3333
- **IP Interno**: http://192.168.60.104:3333

## ✅ Configurações Aplicadas

### 1. Servidor Vite (Frontend)
- ✅ Configurado para escutar em `0.0.0.0:3333` (todas as interfaces)
- ✅ Proxy configurado para `/api` e `/uploads`

### 2. Servidor Backend
- ✅ Configurado para escutar em `0.0.0.0:5000` (todas as interfaces)
- ✅ CORS configurado para aceitar todas as origens (`origin: '*'`)
- ✅ Trust proxy habilitado para funcionar com proxies reversos

## 🔧 Passos para Configurar Acesso Externo

### 1. Executar Script de Configuração do Firewall

```bash
sudo bash /home/tidesk/TIDESK/configurar-acesso-externo.sh
```

Este script irá:
- Abrir a porta 3333 (Vite/Frontend) no firewall
- Abrir a porta 5000 (Backend/API) no firewall
- Recarregar o firewall para aplicar as mudanças

### 2. Configurar Roteador/Firewall Externo

**IMPORTANTE**: Você precisa configurar o roteador/firewall externo para redirecionar as portas:

- **Porta 3333** → Redirecionar para `192.168.60.104:3333`
- **Porta 5000** → Redirecionar para `192.168.60.104:5000`

### 3. Configurar DNS

Certifique-se de que o DNS está configurado corretamente:
- `tidesk.invicco.com.br` → `187.45.113.150`

### 4. Verificar se o Servidor Está Rodando

```bash
# Verificar processos
ps aux | grep -E '(vite|npm|node)' | grep -v grep

# Verificar portas abertas
ss -tlnp | grep -E ':(3333|5000)'
```

### 5. Testar Acesso

**Teste local:**
```bash
curl http://192.168.60.104:3333
curl http://192.168.60.104:5000/api/health
```

**Teste externo (de outra máquina):**
```bash
curl http://187.45.113.150:3333
curl http://tidesk.invicco.com.br:3333
curl http://187.45.113.150:5000/api/health
```

## 🔒 Segurança

### Recomendações para Produção:

1. **Use HTTPS**: Configure um proxy reverso (nginx) com SSL/TLS
2. **Restrinja CORS**: Em produção, considere restringir CORS para domínios específicos
3. **Firewall**: Mantenha apenas as portas necessárias abertas
4. **Autenticação**: O sistema já possui autenticação JWT ativa
5. **Rate Limiting**: Considere adicionar rate limiting para prevenir abusos

### Exemplo de CORS Restritivo (Opcional):

No arquivo `server/src/server.ts`, altere:

```typescript
app.use(cors({
  origin: [
    'http://tidesk.invicco.com.br:3333',
    'https://tidesk.invicco.com.br',
    'http://187.45.113.150:3333'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret', 'x-secret-key'],
  credentials: false
}));
```

## ⚠️ Troubleshooting

### Problema: Não consigo acessar de fora da rede

1. **Verifique o firewall local:**
   ```bash
   sudo firewall-cmd --list-ports
   ```

2. **Verifique o firewall do roteador:**
   - Certifique-se de que as portas 3333 e 5000 estão redirecionadas
   - Verifique se o IP externo está correto (187.45.113.150)

3. **Verifique se o servidor está escutando:**
   ```bash
   ss -tlnp | grep -E ':(3333|5000)'
   ```
   Deve mostrar `0.0.0.0:3333` e `0.0.0.0:5000`

4. **Teste conectividade:**
   ```bash
   nc -zv 192.168.60.104 3333
   ```

### Problema: CORS bloqueando requisições

- O CORS está configurado para aceitar todas as origens (`origin: '*'`)
- Se ainda houver problemas, verifique os logs do servidor

### Problema: DNS não resolve

- Verifique se o DNS está configurado corretamente
- Teste: `nslookup tidesk.invicco.com.br`
- Deve retornar: `187.45.113.150`

## 📝 Notas Importantes

- O servidor deve estar rodando com `npm run dev` na raiz do projeto
- As portas 3333 e 5000 devem estar abertas no firewall local e no roteador
- O DNS deve estar apontando corretamente para o IP externo
- Para produção, considere usar HTTPS com nginx como proxy reverso

## 🚀 Próximos Passos (Opcional)

Para melhorar a segurança e performance em produção:

1. **Instalar e configurar Nginx** como proxy reverso
2. **Configurar SSL/TLS** com Let's Encrypt
3. **Configurar domínio sem porta** (ex: `http://tidesk.invicco.com.br` ao invés de `:3333`)
4. **Implementar rate limiting**
5. **Configurar logs e monitoramento**
