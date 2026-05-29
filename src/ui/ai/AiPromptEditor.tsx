import { Textarea } from '../index'
import type { TextareaProps } from '../primitives/Textarea'

export function AiPromptEditor(props: TextareaProps) {
  return <Textarea spellCheck={false} {...props} />
}
