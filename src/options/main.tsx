import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './options.css'
import { initSquircleEngine } from '../shared/squircle-engine'
import { OptionsApp } from './OptionsApp'

const root = document.getElementById('options-root')

if (!root) {
  throw new Error('Missing options React root')
}

initSquircleEngine()
createRoot(root).render(<OptionsApp />)
