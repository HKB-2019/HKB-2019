import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ShopProvider } from './store/ShopContext.jsx';
import './styles.css';

// The admin preview is the same build, opened at the admin.
if (import.meta.env.VITE_DEMO_START && !window.location.hash) {
  window.history.replaceState(null, '', '#' + import.meta.env.VITE_DEMO_START);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShopProvider>
      <App />
    </ShopProvider>
  </React.StrictMode>
);
