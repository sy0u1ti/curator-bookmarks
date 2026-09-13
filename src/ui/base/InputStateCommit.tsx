import { useInsertionEffect } from 'react'

/**
 * Keep this effect-only sibling before the bridged input. It commits refs before
 * React/Base UI mutates the input, without publishing a suspended render's props.
 * Parent effects run too late and confuse React's writes with legacy DOM edits.
 */
export function InputStateCommit({ onCommit }: { onCommit: () => void }) {
  useInsertionEffect(() => { onCommit() }, [onCommit])
  return null
}
