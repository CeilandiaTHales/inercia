import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' 
import { LanguageProvider } from './contexts/LanguageContext';

const root = document.getElementById('root');

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)