import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Desregistrar service workers existentes (se houver)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Service Worker desregistrado com sucesso');
        }
      });
    }
  });
  
  // Também tentar desregistrar o service worker atual
  navigator.serviceWorker.ready.then((registration) => {
    registration.unregister();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
