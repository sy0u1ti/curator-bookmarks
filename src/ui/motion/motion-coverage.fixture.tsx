import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '../base/Button'
import { CheckboxControl } from '../base/Checkbox'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../base/Collapsible'
import { DialogBackdrop, DialogClose, DialogOverlay, DialogPanel, DialogTitle } from '../base/Dialog'
import { InlineMenu } from '../base/InlineMenu'
import { Select } from '../base/Select'
import { SliderControl } from '../base/Slider'
import { SwitchControl } from '../base/Switch'
import { ToggleGroup } from '../base/ToggleGroup'
import { OPTION_SWITCH_CONTROL_CLASS, OPTION_SWITCH_THUMB_CLASS, OPTION_SWITCH_WRAP_CLASS } from '../switch-classes'
import { Icon } from '../icons/Icon'
import { MotionDisclosure } from './MotionDisclosure'

function Fixture() {
  const [dialog, setDialog] = useState(false)
  const [menu, setMenu] = useState(false)
  const [selection, setSelection] = useState(false)
  const [selected, setSelected] = useState<string | null>('alpha')
  const [clearVisible, setClearVisible] = useState(false)
  return (
    <main className="options-shell" style={{ maxWidth: 800, margin: '40px auto', display: 'grid', gap: 20 }}>
      <h1>Motion regression fixture</h1>
      <Select ariaLabel="Motion select" value={selected} onValueChange={setSelected} options={[
        { value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' },
        { value: 'disabled', label: 'Disabled choice', disabled: true }
      ]} />
      <Select ariaLabel="Disabled select" disabled options={[{ value: 'alpha', label: 'Alpha' }]} defaultValue="alpha" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
        <Button id="motion-button">Press</Button>
        <Button unstyled id="motion-unstyled-button" className="rounded-ds-sm bg-ds-surface-3 px-3 py-2">Unstyled</Button>
        <Button id="motion-icon-button" aria-label="Icon action" className="size-9 p-0"><Icon name="Plus" /></Button>
        <Button id="motion-card-button" className="curator-motion-card">Card action</Button>
        <Button unstyled id="motion-row-button" className="popup-list-button curator-motion-row w-full rounded-ds-sm bg-ds-surface-3 px-3 py-2">Wide row</Button>
        <Button id="motion-disabled-button" disabled>Disabled</Button>
        <SwitchControl aria-label="Standard switch" />
        <span className={OPTION_SWITCH_WRAP_CLASS}>
          <SwitchControl aria-label="Settings switch" unstyled className={OPTION_SWITCH_CONTROL_CLASS} thumbClassName={OPTION_SWITCH_THUMB_CLASS} />
        </span>
        <CheckboxControl aria-label="Motion checkbox" />
      </div>
      <SliderControl ariaLabel="Motion slider" defaultValue={40} />
      <ToggleGroup aria-label="Motion segments" slidingIndicator defaultValue="one" items={[
        { value: 'one', label: 'One' }, { value: 'two', label: 'Two' }, { value: 'three', label: 'Three' }
      ]} />
      <CollapsibleRoot>
        <CollapsibleTrigger id="outer-trigger" render={<Button />}>Outer <Icon className="t-acc-chevron" name="ChevronDown" /></CollapsibleTrigger>
        <CollapsiblePanel id="outer-panel">
          <p>Outer content</p>
          <CollapsibleRoot>
            <CollapsibleTrigger id="inner-trigger" render={<Button />}>Inner <Icon className="t-acc-chevron" name="ChevronDown" /></CollapsibleTrigger>
            <CollapsiblePanel id="inner-panel"><p>Inner content</p><Button id="inner-action">Nested action</Button></CollapsiblePanel>
          </CollapsibleRoot>
        </CollapsiblePanel>
      </CollapsibleRoot>
      <Button id="selection-trigger" onClick={() => setSelection(value => !value)}>Toggle selection</Button>
      <MotionDisclosure open={selection}>
        <div id="selection-actions" style={{ padding: 20, marginTop: 12 }}>
          <Button id="selection-action">Batch action</Button>
        </div>
      </MotionDisclosure>
      <Button id="clear-visibility" onClick={() => setClearVisible(value => !value)}>Toggle clear</Button>
      <Button unstyled className="newtab-search-clear" id="motion-clear" hidden={!clearVisible} inert={!clearVisible} aria-hidden={!clearVisible} tabIndex={clearVisible ? undefined : -1}>Clear</Button>
      <div style={{ position: 'relative' }}>
        <InlineMenu open={menu} onOpenChange={setMenu} label="Motion menu" trigger="Menu" triggerProps={{ id: 'menu-trigger' }}
          className="bg-ds-surface-2 p-2" actions={[
            { id: 'plain', label: 'Plain action' },
            { id: 'nested', label: 'Nested menu', children: [{ id: 'child', label: 'Child action' }] }
          ]} />
      </div>
      <Button id="dialog-trigger" onClick={() => setDialog(true)}>Dialog</Button>
      <DialogOverlay open={dialog} onOpenChange={setDialog} keepMounted={false} className="fixed inset-0 z-50 grid place-items-center">
        <DialogBackdrop id="motion-backdrop" className="absolute inset-0 bg-black/70" />
        <DialogPanel id="motion-dialog" className="relative bg-ds-surface-2 p-8 rounded-ds-lg">
          <DialogTitle>Motion dialog</DialogTitle>
          <DialogClose render={<Button id="dialog-close" />}>Close</DialogClose>
        </DialogPanel>
      </DialogOverlay>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Fixture />)
