import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import '../popup/popup.css'
import './sidepanel.css'
import { PopupApp } from '../popup/PopupApp'
import { startPopupController } from '../popup/popup-controller'
import { preparePopupShellPaint } from '../popup/popup-hydration'

const root = document.getElementById('popup-root')!
preparePopupShellPaint(root)
startPopupController()
createRoot(root).render(<PopupApp portalContainer={root} />)
