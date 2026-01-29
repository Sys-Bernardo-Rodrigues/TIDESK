#!/usr/bin/env tsx
/**
 * Script para configurar certificados Cloudflare Origin Certificate
 * 
 * Este script ajuda a configurar os certificados do Cloudflare no servidor TIDESK.
 * Ele solicita que você cole o certificado e a chave privada do Cloudflare.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const CERT_DIR = path.join(process.cwd(), 'certs');
const KEY_PATH = path.join(CERT_DIR, 'cloudflare.key');
const CERT_PATH = path.join(CERT_DIR, 'cloudflare.crt');
const CHAIN_PATH = path.join(CERT_DIR, 'cloudflare.chain.crt');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function multilineInput(prompt: string, endMarker: string = 'END'): Promise<string> {
  console.log(prompt);
  console.log(`(Digite '${endMarker}' em uma linha separada quando terminar)`);
  
  return new Promise((resolve) => {
    const lines: string[] = [];
    
    const lineHandler = (line: string) => {
      if (line.trim() === endMarker) {
        rl.removeListener('line', lineHandler);
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    };
    
    rl.on('line', lineHandler);
  });
}

async function main() {
  console.log('🔐 Configuração de Certificados Cloudflare - TIDESK\n');
  console.log('Este script irá ajudá-lo a configurar os Origin Certificates do Cloudflare.\n');
  console.log('📋 Pré-requisitos:');
  console.log('   1. Você já deve ter gerado o Origin Certificate no painel do Cloudflare');
  console.log('   2. Ter o certificado e a chave privada copiados\n');
  
  const proceed = await question('Deseja continuar? (s/N): ');
  if (proceed.toLowerCase() !== 's' && proceed.toLowerCase() !== 'sim') {
    console.log('Operação cancelada.');
    rl.close();
    return;
  }
  
  // Criar diretório certs se não existir
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    console.log(`✅ Diretório criado: ${CERT_DIR}`);
  }
  
  // Solicitar chave privada
  console.log('\n📝 Passo 1: Chave Privada');
  console.log('Cole a chave privada do Cloudflare (incluindo -----BEGIN e -----END):');
  const privateKey = await multilineInput('', 'END');
  
  if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    console.log('⚠️  Aviso: A chave privada pode estar incompleta ou incorreta.');
    const continueAnyway = await question('Deseja continuar mesmo assim? (s/N): ');
    if (continueAnyway.toLowerCase() !== 's' && continueAnyway.toLowerCase() !== 'sim') {
      console.log('Operação cancelada.');
      rl.close();
      return;
    }
  }
  
  // Solicitar certificado
  console.log('\n📝 Passo 2: Certificado de Origem');
  console.log('Cole o Origin Certificate do Cloudflare (incluindo -----BEGIN e -----END):');
  const certificate = await multilineInput('', 'END');
  
  if (!certificate.includes('BEGIN') || !certificate.includes('CERTIFICATE')) {
    console.log('⚠️  Aviso: O certificado pode estar incompleto ou incorreto.');
    const continueAnyway = await question('Deseja continuar mesmo assim? (s/N): ');
    if (continueAnyway.toLowerCase() !== 's' && continueAnyway.toLowerCase() !== 'sim') {
      console.log('Operação cancelada.');
      rl.close();
      return;
    }
  }
  
  // Perguntar sobre certificado intermediário
  console.log('\n📝 Passo 3: Certificado Intermediário (Opcional)');
  const includeChain = await question('Deseja configurar o certificado intermediário (chain)? (S/n): ');
  let chain = '';
  
  if (includeChain.toLowerCase() !== 'n' && includeChain.toLowerCase() !== 'nao') {
    console.log('Cole o certificado intermediário do Cloudflare (ou pressione Enter para pular):');
    chain = await multilineInput('', 'END');
    
    if (chain.trim() === '' || (!chain.includes('BEGIN') && !chain.includes('CERTIFICATE'))) {
      console.log('⚠️  Certificado intermediário não fornecido ou inválido. Pulando...');
      chain = '';
    }
  }
  
  // Salvar arquivos
  try {
    console.log('\n💾 Salvando arquivos...');
    
    // Salvar chave privada
    fs.writeFileSync(KEY_PATH, privateKey.trim() + '\n', { mode: 0o600 });
    console.log(`✅ Chave privada salva: ${KEY_PATH}`);
    
    // Salvar certificado
    fs.writeFileSync(CERT_PATH, certificate.trim() + '\n', { mode: 0o644 });
    console.log(`✅ Certificado salvo: ${CERT_PATH}`);
    
    // Salvar chain se fornecido
    if (chain.trim() !== '') {
      fs.writeFileSync(CHAIN_PATH, chain.trim() + '\n', { mode: 0o644 });
      console.log(`✅ Certificado intermediário salvo: ${CHAIN_PATH}`);
    }
    
    console.log('\n✅ Certificados configurados com sucesso!\n');
    
    // Mostrar próximos passos
    console.log('📋 Próximos passos:');
    console.log('   1. Configure o arquivo .env no diretório server/:');
    console.log('      USE_HTTPS=true');
    console.log('      SSL_KEY_PATH=certs/cloudflare.key');
    console.log('      SSL_CERT_PATH=certs/cloudflare.crt');
    if (chain.trim() !== '') {
      console.log('      SSL_CHAIN_PATH=certs/cloudflare.chain.crt');
    }
    console.log('\n   2. Reinicie o servidor:');
    console.log('      npm run dev');
    console.log('\n   3. Configure o modo SSL/TLS no Cloudflare para "Full (strict)"');
    console.log('      SSL/TLS → Overview → Full (strict)');
    
  } catch (error) {
    console.error('❌ Erro ao salvar arquivos:', error);
    process.exit(1);
  }
  
  rl.close();
}

main().catch((error) => {
  console.error('❌ Erro:', error);
  rl.close();
  process.exit(1);
});
