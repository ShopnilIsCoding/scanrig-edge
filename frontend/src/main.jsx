import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import './styles.css';


if ('serviceWorker' in navigator) {
  // Register immediately so the persistent trainer cache can take control as
  // early as possible. On later visits the FBX files are served cache-first.
  navigator.serviceWorker.register('/trainer-cache-sw.js').catch((error) => {
    console.warn('[ScanRig] Trainer cache is unavailable; using normal browser cache.', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AppProvider>
      <App />
    </AppProvider>
  </BrowserRouter>,
);
