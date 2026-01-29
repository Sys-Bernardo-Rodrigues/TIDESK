import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Script para gerar certificados SSL auto-assinados
 * Configurado para o domínio tidesk.invicco.com.br e IPs do ambiente.
 *
 * Para produção, use certificados de uma CA confiável (Let's Encrypt, etc.)
 */

const DEFAULT_DOMAIN = 'tidesk.invicco.com.br';
const CERT_DIR = path.join(process.cwd(), 'certs');
const KEY_FILE = path.join(CERT_DIR, 'server.key');
const CERT_FILE = path.join(CERT_DIR, 'server.crt');

/** DNS e IPs incluídos no certificado (SAN) */
const SAN_DNS = [
  DEFAULT_DOMAIN,
  `www.${DEFAULT_DOMAIN}`,
  'localhost',
  '*.localhost'
];
const SAN_IPS = ['127.0.0.1', '::1', '192.168.60.104', '187.45.113.150'];

function getSanForDomain(domain: string): { dns: string[]; ips: string[] } {
  const base = domain.replace(/^www\./, '') || domain;
  const dns = base === DEFAULT_DOMAIN
    ? SAN_DNS
    : [base, `www.${base}`, 'localhost', '*.localhost'];
  return { dns, ips: SAN_IPS };
}

// Criar diretório de certificados se não existir
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  console.log('✅ Diretório de certificados criado:', CERT_DIR);
}

function hasOpenSSL(): boolean {
  try {
    execSync('openssl version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateWithOpenSSL(domain: string): void {
  const { dns, ips } = getSanForDomain(domain);
  console.log('🔐 Gerando certificados SSL usando OpenSSL...');
  console.log(`   Domínio: ${domain}`);

  execSync(`openssl genrsa -out "${KEY_FILE}" 2048`, { stdio: 'inherit' });

  const configFile = path.join(CERT_DIR, 'openssl.conf');
  const altNames = [
    ...dns.map((d, i) => `DNS.${i + 1} = ${d}`),
    ...ips.map((ip, i) => `IP.${i + 1} = ${ip}`)
  ].join('\n');

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
CN=${domain}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
${altNames}
`;
  fs.writeFileSync(configFile, config);

  execSync(
    `openssl req -new -x509 -key "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -config "${configFile}" -extensions v3_req`,
    { stdio: 'inherit' }
  );
  fs.unlinkSync(configFile);

  console.log('✅ Certificados gerados com sucesso!');
  console.log(`   Chave: ${KEY_FILE}`);
  console.log(`   Certificado: ${CERT_FILE}`);
  console.log(`   Válido por: 365 dias`);
  console.log(`   SANs: ${dns.join(', ')} | ${ips.join(', ')}`);
}

function generateWithNodeJS(domain: string): void {
  const { dns, ips } = getSanForDomain(domain);
  console.log('🔐 Gerando certificados SSL usando Node.js (selfsigned)...');
  console.log(`   Domínio: ${domain}`);

  try {
    const selfsigned = require('selfsigned');

    const attrs = [
      { name: 'commonName', value: domain },
      { name: 'countryName', value: 'BR' },
      { name: 'stateOrProvinceName', value: 'Sao Paulo' },
      { name: 'localityName', value: 'Sao Paulo' },
      { name: 'organizationName', value: 'TIDESK' },
      { name: 'organizationalUnitName', value: 'Development' }
    ];

    const altNames: Array<{ type: number; value?: string; ip?: string }> = [
      ...dns.map((d) => ({ type: 2, value: d })),
      ...ips.map((ip) => ({ type: 7, ip }))
    ];

    const options = {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        { name: 'basicConstraints', cA: false },
        {
          name: 'keyUsage',
          keyCertSign: false,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        { name: 'subjectAltName', altNames }
      ]
    };

    const pems = selfsigned.generate(attrs, options);
    fs.writeFileSync(KEY_FILE, pems.private);
    fs.writeFileSync(CERT_FILE, pems.cert);

    console.log('✅ Certificados gerados com sucesso!');
    console.log(`   Chave: ${KEY_FILE}`);
    console.log(`   Certificado: ${CERT_FILE}`);
    console.log(`   Válido por: 365 dias`);
    console.log(`   SANs: ${dns.join(', ')} | ${ips.join(', ')}`);
  } catch (error) {
    console.error('❌ Erro ao gerar certificados:', error);
    console.log('\n💡 Instale o pacote selfsigned:');
    console.log('   npm install --save-dev selfsigned');
    console.log('\n   Ou instale o OpenSSL e execute novamente.');
    process.exit(1);
  }
}

function main() {
  const domain = process.env.SSL_DOMAIN || process.argv[2] || DEFAULT_DOMAIN;

  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    console.log('⚠️  Certificados já existem!');
    console.log(`   Chave: ${KEY_FILE}`);
    console.log(`   Certificado: ${CERT_FILE}`);
    console.log('\n   Para regenerar, delete os arquivos e execute novamente.');
    return;
  }

  if (hasOpenSSL()) {
    generateWithOpenSSL(domain);
  } else {
    console.log('⚠️  OpenSSL não encontrado. Usando Node.js (selfsigned)...');
    generateWithNodeJS(domain);
  }

  console.log('\n📝 Próximos passos:');
  console.log('   1. Configure USE_HTTPS=true no .env do servidor');
  console.log('   2. Reinicie o servidor');
  console.log(`   3. Acesse via https://${domain}:PORT (ou https://localhost:PORT)`);
  console.log('\n⚠️  Certificados auto-assinados geram aviso no navegador.');
  console.log('   Para produção, use Let\'s Encrypt ou outra CA confiável.');
}

main();
