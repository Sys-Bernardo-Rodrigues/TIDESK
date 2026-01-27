# Configuração do Serviço Systemd - TIDESK

Este documento explica como configurar o TIDESK como um serviço systemd para iniciar automaticamente com o sistema.

## 📋 Pré-requisitos

- Sistema operacional Linux com systemd
- Node.js instalado via NVM
- Aplicação TIDESK compilada (`npm run build`)

## 🚀 Instalação

1. **Execute o script de instalação com sudo:**
   ```bash
   sudo ./install-service.sh
   ```

2. **Inicie o serviço:**
   ```bash
   sudo systemctl start tidesk
   ```

3. **Verifique o status:**
   ```bash
   sudo systemctl status tidesk
   ```

## 📝 Comandos Úteis

### Gerenciamento do Serviço

```bash
# Iniciar o serviço
sudo systemctl start tidesk

# Parar o serviço
sudo systemctl stop tidesk

# Reiniciar o serviço
sudo systemctl restart tidesk

# Ver status do serviço
sudo systemctl status tidesk

# Habilitar início automático (já feito pelo install-service.sh)
sudo systemctl enable tidesk

# Desabilitar início automático
sudo systemctl disable tidesk
```

### Visualização de Logs

```bash
# Ver logs em tempo real
sudo journalctl -u tidesk -f

# Ver últimas 100 linhas dos logs
sudo journalctl -u tidesk -n 100

# Ver logs desde hoje
sudo journalctl -u tidesk --since today

# Ver logs de um período específico
sudo journalctl -u tidesk --since "2025-01-26 00:00:00" --until "2025-01-26 23:59:59"
```

## 🔧 Configuração

O arquivo de serviço está localizado em:
- `/etc/systemd/system/tidesk.service`

O script de inicialização está em:
- `/home/tidesk/TIDESK/start-tidesk.sh`

### Modificar Configurações

Se precisar modificar as configurações do serviço:

1. Edite o arquivo de serviço:
   ```bash
   sudo nano /etc/systemd/system/tidesk.service
   ```

2. Recarregue o systemd:
   ```bash
   sudo systemctl daemon-reload
   ```

3. Reinicie o serviço:
   ```bash
   sudo systemctl restart tidesk
   ```

## 🐛 Troubleshooting

### Serviço não inicia

1. Verifique os logs:
   ```bash
   sudo journalctl -u tidesk -n 50
   ```

2. Verifique se o Node.js está acessível:
   ```bash
   which node
   which npm
   ```

3. Verifique as permissões:
   ```bash
   ls -la /home/tidesk/TIDESK/start-tidesk.sh
   ```

### Serviço reinicia constantemente

1. Verifique os logs para identificar o erro:
   ```bash
   sudo journalctl -u tidesk -f
   ```

2. Teste manualmente o script:
   ```bash
   /home/tidesk/TIDESK/start-tidesk.sh
   ```

### Porta já em uso

Se a porta 5000 já estiver em uso:

1. Verifique qual processo está usando:
   ```bash
   sudo lsof -i :5000
   ```

2. Pare o processo ou altere a porta no arquivo `.env` do servidor

## 📍 Localização dos Arquivos

- **Serviço systemd:** `/etc/systemd/system/tidesk.service`
- **Script de inicialização:** `/home/tidesk/TIDESK/start-tidesk.sh`
- **Script de instalação:** `/home/tidesk/TIDESK/install-service.sh`
- **Diretório da aplicação:** `/home/tidesk/TIDESK`
- **Logs do sistema:** `journalctl -u tidesk`

## ✅ Verificação

Após a instalação, verifique se o serviço está funcionando:

```bash
# Status do serviço
sudo systemctl status tidesk

# Teste da API
curl http://localhost:5000/api/health

# Teste do frontend
curl http://localhost:3333
```

Se ambos responderem, o serviço está funcionando corretamente!
