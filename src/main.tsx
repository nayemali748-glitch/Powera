import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (e: ErrorEvent) => {
      if (e && (e.message === 'Script error.' || e.message === 'Script error') && !e.filename) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );
}

// Unregister any stale Service Workers and purge old caches so requests are never intercepted with invalid fetch options
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name).catch(() => {});
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

