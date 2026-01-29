import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Certificados do servidor - suporta certificados padrão ou Cloudflare
const certDir = path.resolve(__dirname, '../server/certs')

// Tentar certificados padrão primeiro, depois Cloudflare
const defaultKeyPath = path.join(certDir, 'server.key')
const defaultCertPath = path.join(certDir, 'server.crt')
const cloudflareKeyPath = path.join(certDir, 'cloudflare.key')
const cloudflareCertPath = path.join(certDir, 'cloudflare.crt')

// Determinar qual certificado usar
let keyPath: string | null = null
let certPath: string | null = null

if (fs.existsSync(defaultKeyPath) && fs.existsSync(defaultCertPath)) {
  keyPath = defaultKeyPath
  certPath = defaultCertPath
} else if (fs.existsSync(cloudflareKeyPath) && fs.existsSync(cloudflareCertPath)) {
  keyPath = cloudflareKeyPath
  certPath = cloudflareCertPath
}

const useHttps = keyPath !== null && certPath !== null
const httpsOpts = useHttps
  ? { key: fs.readFileSync(keyPath!), cert: fs.readFileSync(certPath!) }
  : false

// Proxy: HTTPS quando frontend está em HTTPS (certs). Use VITE_API_HTTPS=false se o backend for só HTTP.
const apiTarget =
  process.env.VITE_API_HTTPS === 'false'
    ? 'http://localhost:5000'
    : useHttps
      ? 'https://localhost:5000'
      : 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3333,
    strictPort: false,
    https: httpsOpts,
    allowedHosts: [
      'tidesk.invicco.com.br',
      'tidesk.invixap.com.br',
      '187.45.113.150',
      '192.168.60.104',
      'localhost',
      '.invicco.com.br',
      '.invixap.com.br'
    ],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3333,
    https: httpsOpts,
    allowedHosts: [
      'tidesk.invicco.com.br',
      'tidesk.invixap.com.br',
      '187.45.113.150',
      '192.168.60.104',
      'localhost',
      '.invicco.com.br',
      '.invixap.com.br'
    ],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
