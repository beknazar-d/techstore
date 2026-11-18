import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LanguageRoot } from './i18n/LanguageRoot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageRoot>
        <App />
      </LanguageRoot>
    </BrowserRouter>
  </StrictMode>,
)
