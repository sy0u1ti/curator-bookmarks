import { Select, type SelectOption } from '../index'

export interface AiModelSelectProps {
  value?: string | null
  onValueChange?: (value: string | null) => void
  models: SelectOption[]
  label?: string
}

export function AiModelSelect({ value, onValueChange, models, label = 'Model' }: AiModelSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      options={models}
      label={label}
      placeholder="Select model"
    />
  )
}
