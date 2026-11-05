import { useEffect } from 'react'
import { startInputCaretController } from './input-caret-controller.js'

export function InputCaretHost() {
  useEffect(() => startInputCaretController(), [])
  return null
}
