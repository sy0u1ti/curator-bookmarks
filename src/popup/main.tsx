import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './popup.css'
import { PopupApp } from './PopupApp'

const root = document.getElementById('popup-root')

if (!root) {
  throw new Error('Missing popup React root')
}

createRoot(root).render(<PopupApp portalContainer={root} />)
