import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Set dark theme immediately
document.documentElement.setAttribute('data-bs-theme', 'dark');
document.body.style.backgroundColor = '#1a1a1a';
document.body.style.color = '#ffffff';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
