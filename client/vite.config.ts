import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Certificados do servidor (tidesk.invicco.com.br) – usados para HTTPS no Vite
const certDir = path.resolve(__dirname, '../server/certs')
const keyPath = path.join(certDir, 'server.key')
const certPath = path.join(certDir, 'server.crt')
const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath)
const httpsOpts = useHttps
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
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
      '187.45.113.150',
      '192.168.60.104',
      'localhost',
      '.invicco.com.br'
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
      '187.45.113.150',
      '192.168.60.104',
      'localhost',
      '.invicco.com.br'
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
