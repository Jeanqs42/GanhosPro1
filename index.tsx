
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Toaster } from 'react-hot-toast';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker updated, reloading page for new SW');
        window.location.reload();
      });
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-center"
      reverseOrder={false}
      toastOptions={{
        className: '',
        style: {
          background: '#333',
          color: '#fff',
        },
      }}
    />
  </React.StrictMode>
);