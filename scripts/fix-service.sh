#!/bin/bash

# Script para corrigir permissões e contexto SELinux do serviço

echo "🔧 Corrigindo permissões e contexto SELinux..."

# Garante permissão de execução
chmod +x /home/tidesk/TIDESK/scripts/start-tidesk.sh

# Configura contexto SELinux (se disponível)
if command -v chcon &> /dev/null; then
    sudo chcon -t bin_t /home/tidesk/TIDESK/scripts/start-tidesk.sh 2>/dev/null || \
    sudo chcon -u system_u -t bin_t /home/tidesk/TIDESK/scripts/start-tidesk.sh 2>/dev/null || \
    echo "⚠️  Não foi possível configurar contexto SELinux automaticamente"
fi

# Atualiza o serviço
sudo cp /home/tidesk/TIDESK/scripts/tidesk.service /etc/systemd/system/tidesk.service
sudo systemctl daemon-reload

echo "✅ Correções aplicadas!"
echo ""
echo "Agora execute:"
echo "  sudo systemctl restart tidesk"
echo "  sudo systemctl status tidesk"
