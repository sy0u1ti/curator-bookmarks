import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './newtab.css'
import { NewtabApp } from './NewtabApp'
import { startNewTabController } from './newtab-controller'

const root = document.getElementById('newtab-react-root')

if (!root) {
  throw new Error('Missing newtab React root')
}

startNewTabController()
createRoot(root).render(<NewtabApp />)
