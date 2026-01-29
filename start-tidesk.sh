#!/usr/bin/bash

# Script para iniciar o TIDESK como serviço
# Carrega o NVM e executa o npm run start

export NVM_DIR="/home/tidesk/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/tidesk/TIDESK || exit 1

# Carrega o Node.js do NVM
nvm use default || nvm use v24.13.0

# Garante que o PATH está correto
export PATH="$NVM_DIR/versions/node/$(nvm version)/bin:$PATH"

# Executa o npm run start
exec npm run start
