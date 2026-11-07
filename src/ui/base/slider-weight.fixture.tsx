import { useLayoutEffect, useState } from 'react'
import { SliderControl } from './Slider'
import { ReasoningEffortSelector } from '../../options/components/ReasoningEffortSelector'

const levels = [
  { id: 'low', label: '低' }, { id: 'medium', label: '中' },
  { id: 'high', label: '高' }, { id: 'max', label: '最高' }
]
const probe = (window as any).__sliderWeight = {
  changes: [] as number[], commits: [] as number[], targets: [] as number[],
  inputEvents: [] as number[], changeEvents: [] as number[], reasoning: [] as string[],
  reject: false, configure: (_value: Record<string, unknown>) => {}
}

export function SliderWeightFixture() {
  const [value, setValue] = useState(50)
  const [config, setConfig] = useState({ disabled: false, min: 0, max: 100, step: 1 })
  const [reasoning, setReasoning] = useState('medium')
  const [generation, setGeneration] = useState(0)
  probe.configure = (patch: Partial<typeof config> & { value?: number; remount?: boolean }) => {
    const { value: nextValue, remount, ...controls } = patch
    if (nextValue !== undefined) setValue(nextValue)
    if (remount) setGeneration(current => current + 1)
    setConfig(current => ({ ...current, ...controls }))
  }
  useLayoutEffect(() => {
    const input = document.querySelector<HTMLInputElement>('#weighted-bridge input')!
    const trackInput = () => probe.inputEvents.push(Number(input.value))
    const trackChange = () => probe.changeEvents.push(Number(input.value))
    input.addEventListener('input', trackInput)
    input.addEventListener('change', trackChange)
    return () => {
      input.removeEventListener('input', trackInput)
      input.removeEventListener('change', trackChange)
    }
  }, [generation])
  return (
    <main className="mx-auto grid max-w-lg gap-8 p-6 text-ds-text-primary" key={generation}>
      <h1 className="m-0 text-lg">滑块手感</h1>
      <section id="weighted-controlled" className="grid gap-3">
        <label>连续调节 <output id="weighted-value">{value}</output></label>
        <SliderControl
          ariaLabel="连续调节" value={value} defaultValue={50} {...config}
          onValueChange={(next, details) => {
            if (probe.reject) { details.cancel(); return }
            probe.changes.push(next)
            probe.targets.push(Number((details.event.target as unknown as { value: number })?.value))
            setValue(next)
          }}
          onValueCommitted={next => probe.commits.push(next)}
        />
      </section>
      <section id="weighted-uncontrolled" className="grid gap-3">
        <label>独立控件</label>
        <SliderControl ariaLabel="独立控件" defaultValue={20} />
      </section>
      <section id="weighted-bridge" className="grid gap-3">
        <label>兼容旧设置</label>
        <SliderControl ariaLabel="兼容旧设置" defaultValue={40} syncInputState
          onValueCommitted={next => probe.commits.push(next)} />
      </section>
      <section id="weighted-reasoning" className="grid gap-3">
        <label>档位调节</label>
        <ReasoningEffortSelector
          levels={levels} value={reasoning} modelName="测试模型"
          onChange={next => { probe.reasoning.push(next); setReasoning(next) }}
        />
      </section>
    </main>
  )
}
