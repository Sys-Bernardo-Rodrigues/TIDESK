import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Permitir acesso de outras máquinas na rede
    port: 3333,
    strictPort: false, // Permitir usar outra porta se 3333 estiver ocupada
    https: false, // Garantir que não força HTTPS
    allowedHosts: [
      'tidesk.invicco.com.br',
      '187.45.113.150',
      '192.168.60.104',
      'localhost',
      '.invicco.com.br' // Permite qualquer subdomínio
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false // Permitir conexões HTTP inseguras para desenvolvimento
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false // Permitir conexões HTTP inseguras para desenvolvimento
      }
    }
  }
})
