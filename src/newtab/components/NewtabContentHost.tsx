import { useCallback } from 'react'
import { Button } from '../../ui/primitives/Button'
import { DotMatrixLoader } from '../../ui/primitives/DotMatrixLoader'
import {
  type NewTabContentView,
  type NewTabElementModule,
  type NewTabMissingFolderModule,
  type NewTabPageModule
} from '../content-state'
import { useNewtabContentView } from '../newtab-content-store'

export function NewtabContentHost() {
  const view = useNewtabContentView()

  if (!view) {
    return null
  }

  if (view.type === 'state') {
    return <GenericState action={view.action} actionLabel={view.actionLabel} message={view.message} />
  }

  return <NewTabPage view={view} />
}

function NewTabPage({ view }: { view: Extract<NewTabContentView, { type: 'page' }> }) {
  const utilityModules = view.modules.filter((module) => module.placement === 'utility')
  const [primaryModule] = view.modules.filter((module) => module.placement === 'primary')
  const pageClassName = [
    'newtab-page',
    view.hasSearch ? 'has-search' : '',
    view.hasClock ? 'has-clock' : ''
  ].filter(Boolean).join(' ')

  return (
    <main
      className={pageClassName}
      data-content-state={view.contentState}
      data-icon-vertical-center={view.iconVerticalCenter}
    >
      <div
        className="newtab-utility-stack"
        ref={(node) => {
          mountElementModules(node, utilityModules)
        }}
      />
      <PrimarySlot module={primaryModule} />
    </main>
  )
}

function PrimarySlot({ module }: { module: NewTabPageModule | undefined }) {
  const mountPrimaryElement = useCallback((node: HTMLDivElement | null) => {
    if (!node || !module || module.kind !== 'element') {
      return
    }
    mountElementModules(node, [module])
  }, [module])

  if (!module) {
    return <div className="newtab-primary-slot" />
  }

  if (module.kind === 'loading') {
    return (
      <div className="newtab-primary-slot">
        <LoadingState label={module.label} />
      </div>
    )
  }

  if (module.kind === 'missing-folder') {
    return (
      <div className="newtab-primary-slot">
        <MissingFolderState module={module} />
      </div>
    )
  }

  return <div className="newtab-primary-slot" ref={mountPrimaryElement} />
}

function mountElementModules(node: HTMLElement | null, modules: NewTabPageModule[]): void {
  if (!node) {
    return
  }

  const elements = modules
    .filter((module): module is NewTabElementModule => module.kind === 'element')
    .map((module) => {
      module.element.dataset.newtabModule = module.id
      return module.element
    })

  node.replaceChildren(...elements)
}

function LoadingState({ label }: { label: string }) {
  return (
    <section className="newtab-state newtab-loading-state" aria-label={label}>
      <DotMatrixLoader className="newtab-state-loader" />
    </section>
  )
}

function MissingFolderState({ module }: { module: NewTabMissingFolderModule }) {
  return (
    <section className="newtab-state folder-missing" aria-labelledby="newtab-missing-folder-title">
      <h1 id="newtab-missing-folder-title">
        {module.reason === 'selected-unavailable' ? '已选书签来源不可用' : '当前没有显示来源'}
      </h1>
      <p>
        {module.reason === 'selected-unavailable'
          ? '之前选择的文件夹可能已被删除或移动。请打开设置里的“书签来源”，重新选择要显示的文件夹。'
          : '没有找到可直接展示的非空文件夹。你可以选择已有来源，或新建专用文件夹后添加书签。'}
      </p>
      <div className="newtab-state-actions">
        <Button className="newtab-button" type="button" onClick={module.onOpenFolderSettings} unstyled>
          选择现有来源
        </Button>
        <Button
          className="newtab-button secondary"
          type="button"
          disabled={module.creatingFolder}
          onClick={module.onCreateFolder}
          unstyled
        >
          {module.creatingFolder ? '正在创建' : '新建专用文件夹'}
        </Button>
      </div>
    </section>
  )
}

function GenericState({
  action,
  actionLabel = '',
  message
}: {
  action?: () => void
  actionLabel?: string
  message: string
}) {
  return (
    <section className="newtab-state">
      <p>{message}</p>
      {actionLabel && action ? (
        <Button className="newtab-button secondary" type="button" onClick={action} unstyled>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}
