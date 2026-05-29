import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './options.css'
import { OptionsApp } from './OptionsApp'

const root = document.getElementById('options-root')

if (!root) {
  throw new Error('Missing options React root')
}

createRoot(root).render(<OptionsApp />)
