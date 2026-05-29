import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './newtab.css'
import { NewtabApp } from './NewtabApp'

const root = document.getElementById('newtab-react-root')

if (!root) {
  throw new Error('Missing newtab React root')
}

createRoot(root).render(<NewtabApp />)
