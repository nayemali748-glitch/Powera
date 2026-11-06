import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (e: ErrorEvent) => {
      if (!e) return;
      const msg = String(e.message || '');
      if (msg === 'Script error.' || msg === 'Script error' || msg.includes('WebSocket') || msg.includes('[vite]')) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );

  // Register modern PWA Service Worker for standalone installation & caching
  if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
