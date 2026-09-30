import '@fontsource/share-tech-mono'
import '@fontsource-variable/archivo/wdth.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createApiClient } from './api/client'
import { App } from './App'

const api = createApiClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
)
