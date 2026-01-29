import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Script para gerar certificados SSL auto-assinados para desenvolvimento
 * 
 * Para produção, use certificados de uma CA confiável (Let's Encrypt, etc.)
 */

const CERT_DIR = path.join(process.cwd(), 'certs');
const KEY_FILE = path.join(CERT_DIR, 'server.key');
const CERT_FILE = path.join(CERT_DIR, 'server.crt');

// Criar diretório de certificados se não existir
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  console.log('✅ Diretório de certificados criado:', CERT_DIR);
}

// Verificar se openssl está disponível
function hasOpenSSL(): boolean {
  try {
    execSync('openssl version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Gerar certificado usando openssl
function generateWithOpenSSL(hostname: string = 'localhost'): void {
  console.log('🔐 Gerando certificados SSL usando OpenSSL...');
  
  // Gerar chave privada
  execSync(
    `openssl genrsa -out "${KEY_FILE}" 2048`,
    { stdio: 'inherit' }
  );
  
  // Criar arquivo de configuração temporário
  const configFile = path.join(CERT_DIR, 'openssl.conf');
  const config = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=BR
ST=Sao Paulo
L=Sao Paulo
O=TIDESK
OU=Development
CN=${hostname}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${hostname}
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
`;
  
  fs.writeFileSync(configFile, config);
  
  // Gerar certificado auto-assinado
  execSync(
    `openssl req -new -x509 -key "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -config "${configFile}" -extensions v3_req`,
    { stdio: 'inherit' }
  );
  
  // Remover arquivo de configuração temporário
  fs.unlinkSync(configFile);
  
  console.log('✅ Certificados gerados com sucesso!');
  console.log(`   Chave privada: ${KEY_FILE}`);
  console.log(`   Certificado: ${CERT_FILE}`);
  console.log(`   Válido por: 365 dias`);
  console.log(`   Hostname: ${hostname}`);
}

// Gerar certificado usando Node.js (fallback)
function generateWithNodeJS(hostname: string = 'localhost'): void {
  console.log('🔐 Gerando certificados SSL usando Node.js...');
  
  try {
    // Tentar usar o pacote selfsigned se disponível
    const selfsigned = require('selfsigned');
    
    const attrs = [
      { name: 'commonName', value: hostname },
      { name: 'countryName', value: 'BR' },
      { name: 'stateOrProvinceName', value: 'Sao Paulo' },
      { name: 'localityName', value: 'Sao Paulo' },
      { name: 'organizationName', value: 'TIDESK' },
      { name: 'organizationalUnitName', value: 'Development' }
    ];
    
    const options = {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'basicConstraints',
          cA: false
        },
        {
          name: 'keyUsage',
          keyCertSign: false,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: hostname },
            { type: 2, value: 'localhost' },
            { type: 2, value: '*.localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '::1' }
          ]
        }
      ]
    };
    
    const pems = selfsigned.generate(attrs, options);
    
    fs.writeFileSync(KEY_FILE, pems.private);
    fs.writeFileSync(CERT_FILE, pems.cert);
    
    console.log('✅ Certificados gerados com sucesso!');
    console.log(`   Chave privada: ${KEY_FILE}`);
    console.log(`   Certificado: ${CERT_FILE}`);
    console.log(`   Válido por: 365 dias`);
    console.log(`   Hostname: ${hostname}`);
  } catch (error) {
    console.error('❌ Erro ao gerar certificados:', error);
    console.log('\n💡 Instale o pacote selfsigned:');
    console.log('   npm install --save-dev selfsigned');
    console.log('\n   Ou instale o OpenSSL e execute novamente.');
    process.exit(1);
  }
}

// Função principal
function main() {
  const hostname = process.argv[2] || 'localhost';
  
  // Verificar se os certificados já existem
  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    console.log('⚠️  Certificados já existem!');
    console.log(`   Chave: ${KEY_FILE}`);
    console.log(`   Certificado: ${CERT_FILE}`);
    console.log('\n   Para regenerar, delete os arquivos existentes.');
    return;
  }
  
  if (hasOpenSSL()) {
    generateWithOpenSSL(hostname);
  } else {
    console.log('⚠️  OpenSSL não encontrado. Tentando usar Node.js...');
    generateWithNodeJS(hostname);
  }
  
  console.log('\n📝 Próximos passos:');
  console.log('   1. Configure USE_HTTPS=true no arquivo .env');
  console.log('   2. Reinicie o servidor');
  console.log('   3. Acesse via https://localhost:PORT');
  console.log('\n⚠️  AVISO: Certificados auto-assinados geram avisos de segurança no navegador.');
  console.log('   Para produção, use certificados de uma CA confiável (Let\'s Encrypt, etc.)');
}

main();
