import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Check for a new deploy whenever the app comes back on screen, and every 30 minutes.
// iOS home screen apps otherwise sit on the old version, which tempts a reinstall, and a
// reinstall starts with empty storage.
registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    if (!r) return;
    const check = () => { if (navigator.onLine) r.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60_000);
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
