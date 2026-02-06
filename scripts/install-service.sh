#!/bin/bash

# Script de instalação do serviço systemd para TIDESK
# Execute este script com: sudo ./install-service.sh

set -e

echo "🚀 Instalando serviço systemd do TIDESK..."

# Garante permissão de execução no script
chmod +x /home/tidesk/TIDESK/scripts/start-tidesk.sh

# Configura contexto SELinux (se disponível)
if command -v chcon &> /dev/null; then
    echo "🔧 Configurando contexto SELinux..."
    chcon -t bin_t /home/tidesk/TIDESK/scripts/start-tidesk.sh 2>/dev/null || \
    chcon -u system_u -t bin_t /home/tidesk/TIDESK/scripts/start-tidesk.sh 2>/dev/null || \
    echo "⚠️  Não foi possível configurar contexto SELinux automaticamente"
fi

# Copia o arquivo de serviço
cp /home/tidesk/TIDESK/scripts/tidesk.service /etc/systemd/system/tidesk.service

# Recarrega o systemd
systemctl daemon-reload

# Habilita o serviço para iniciar automaticamente
systemctl enable tidesk.service

echo "✅ Serviço instalado com sucesso!"
echo ""
echo "Comandos úteis:"
echo "  - Iniciar o serviço: sudo systemctl start tidesk"
echo "  - Parar o serviço: sudo systemctl stop tidesk"
echo "  - Reiniciar o serviço: sudo systemctl restart tidesk"
echo "  - Ver status: sudo systemctl status tidesk"
echo "  - Ver logs: sudo journalctl -u tidesk -f"
echo ""
echo "Para iniciar o serviço agora, execute:"
echo "  sudo systemctl start tidesk"
