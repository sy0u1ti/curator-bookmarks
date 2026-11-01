import { useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { initSquircleEngine } from '../shared/squircle-engine'
import { AiProviderCard } from '../ui/ai/AiProviderCard'
import { Badge } from '../ui/base/Badge'
import { Button } from '../ui/base/Button'
import { Card } from '../ui/base/Card'
import { CheckboxControl } from '../ui/base/Checkbox'
import { DialogBackdrop, DialogClose, DialogOverlay, DialogPanel, DialogTitle } from '../ui/base/Dialog'
import { InlineMenu } from '../ui/base/InlineMenu'
import { Input } from '../ui/base/Input'
import { Progress } from '../ui/base/Progress'
import { Select } from '../ui/base/Select'
import { SwitchControl } from '../ui/base/Switch'
import { ToggleGroup } from '../ui/base/ToggleGroup'
import { getBookmarkTileClass } from '../newtab/components/bookmarkTileClasses'
import { BookmarkIconShell } from '../newtab/components/BookmarkIconShell'

document.documentElement.dataset.curatorSurface = 'geometry-fixture'
initSquircleEngine()

function Fixture() {
  const [dialog, setDialog] = useState(false)
  const [menu, setMenu] = useState(false)
  const [selected, setSelected] = useState<string | null>('first')
  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: 16, display: 'grid', gap: 24 }}>
      <h1 className="text-xl text-ds-text-primary">Curator corner geometry</h1>
      <Card id="corner-card">
        <Input id="corner-input" aria-label="Bookmark title" defaultValue="Design references" />
      </Card>
      <AiProviderCard id="corner-composed-card" title="Provider settings" className="rounded-ds-lg p-0 gap-0"
        headerClassName="p-4" bodyClassName="p-4">
        <Input id="corner-composed-input" aria-label="Provider name" defaultValue="Local provider" />
      </AiProviderCard>
      <div id="corner-nested" className="rounded-ds-dialog border border-ds-border bg-ds-surface-1 ds-inset-card">
        <div id="corner-inner" className="rounded-ds-lg border border-ds-border bg-ds-surface-2 ds-inset-panel">
          <Button id="corner-inner-button" className="w-full">Bookmark action</Button>
        </div>
      </div>
      <ToggleGroup id="corner-segments" aria-label="Bookmark view" defaultValue="first" slidingIndicator items={[
        { value: 'first', label: 'List' }, { value: 'second', label: 'Grid' }
      ]} />
      <Select ariaLabel="Bookmark source" value={selected} onValueChange={setSelected} options={[
        { value: 'first', label: 'Bookmarks bar' }, { value: 'second', label: 'Other bookmarks' }
      ]} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <SwitchControl aria-label="Show titles" />
        <CheckboxControl aria-label="Select bookmark" />
        <Badge>Local</Badge>
        <span id="corner-pill" className="rounded-full border border-ds-border px-3 py-1">Pinned</span>
        <span id="corner-circle" className="rounded-full bg-ds-surface-3" style={{ width: 32, height: 32 }} />
      </div>
      <Progress id="corner-progress" value={50} label="Import progress" />
      <a id="corner-bookmark" href="#bookmark" className={getBookmarkTileClass({ showTitles: true })} style={{ '--icon-shell-size': '32px' } as CSSProperties}>
        <BookmarkIconShell customIcon={false} fallbackLabel="D" favicon={{
          pageUrl: '', src: '/favicon.svg', fetchpriority: 'high', loading: 'eager'
        }} />
        <span>Design references</span>
      </a>
      <InlineMenu open={menu} onOpenChange={setMenu} label="Bookmark actions"
        className="curator-cascade-popup" trigger="Bookmark actions" triggerProps={{ id: 'corner-menu-trigger' }}
        actions={[
          { id: 'edit', label: 'Edit bookmark' },
          { id: 'move', label: 'Move bookmark', children: [
            { id: 'design', label: 'Design folder' },
            { id: 'development', label: 'Development folder' }
          ] }
        ]} />
      <Button id="corner-dialog-trigger" onClick={() => setDialog(true)}>Edit title</Button>
      <DialogOverlay open={dialog} onOpenChange={setDialog} keepMounted={false}
        className="fixed inset-0 z-50 grid place-items-center p-4">
        <DialogBackdrop className="absolute inset-0 bg-ds-overlay" />
        <DialogPanel id="corner-dialog" className="relative w-full max-w-lg rounded-ds-dialog border border-ds-border bg-ds-surface-2 ds-inset-dialog">
          <DialogTitle className="mb-4 text-lg text-ds-text-primary">Edit bookmark title</DialogTitle>
          <Input id="corner-dialog-input" aria-label="New title" defaultValue="Design references" />
          <DialogClose className="mt-4" render={<Button id="corner-dialog-close" />}>Done</DialogClose>
        </DialogPanel>
      </DialogOverlay>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Fixture />)
