import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import ModalInteractionGuard from './components/ModalInteractionGuard.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <ModalInteractionGuard />
      <App />
    </ToastProvider>
  </StrictMode>,
)
