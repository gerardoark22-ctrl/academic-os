import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import './index.css';
import './forgeEpic.css';
import { registerServiceWorker } from './utils/push';

// PWA instalable + receptor de las notificaciones push. Registrado a mano
// (sin vite-plugin-pwa): el sw.js vive en public/ y se controla entero desde ahí.
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
