#!/bin/bash

# Script para configurar acesso externo ao TIDESK
# Domínio: tidesk.invicco.com.br
# IP Externo: 187.45.113.150

echo "🔧 Configurando acesso externo ao TIDESK..."
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Este script precisa ser executado com sudo"
    echo "Execute: sudo bash configurar-acesso-externo.sh"
    exit 1
fi

# Configurar firewall para permitir acesso externo
echo "📡 Configurando firewall (firewalld)..."
firewall-cmd --permanent --add-port=2053/tcp
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload

# Verificar se as portas foram abertas
echo ""
echo "✅ Verificando portas abertas:"
firewall-cmd --list-ports

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "🌐 Acessos configurados:"
echo "   - Domínio: https://tidesk.invicco.com.br"
echo "   - IP Externo: https://187.45.113.150"
echo "   - IP Interno: https://192.168.60.104"
echo ""
echo "⚠️  IMPORTANTE: Certifique-se de que:"
echo "   1. O roteador/firewall externo está redirecionando as portas 2053 e 5000"
echo "   2. O DNS está apontando tidesk.invicco.com.br para 187.45.113.150"
echo "   3. O servidor está rodando com 'npm run dev'"
echo ""
