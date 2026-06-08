import { type CSSProperties, useCallback } from 'react'
import { Button } from '../../ui/primitives/Button'
import { DotMatrixLoader } from '../../ui/primitives/DotMatrixLoader'
import {
  type NewTabContentView,
  type NewTabElementModule,
  type NewTabMissingFolderModule,
  type NewTabOnboardingModule,
  type NewTabPageModule
} from '../content-state'
import { useNewtabContentView } from '../newtab-content-store'
import { useNewtabClockView } from '../newtab-clock-store'
import { useNewtabSearchWidgetView } from '../newtab-search-widget-store'
import { ClockWidgetContent } from './RuntimeIslands'
import { NewtabSearchWidget } from './NewtabSearchWidget'

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
      <div className="newtab-utility-stack">
        {utilityModules.map((module) => (
          <UtilityModule module={module} key={module.id} />
        ))}
      </div>
      <PrimarySlot module={primaryModule} />
    </main>
  )
}

function UtilityModule({ module }: { module: NewTabPageModule }) {
  if (module.kind === 'onboarding') {
    return <OnboardingStrip module={module} />
  }

  if (module.kind === 'clock') {
    return <ClockModule />
  }

  if (module.kind === 'clock-spacer') {
    return <div className="newtab-clock-spacer" aria-hidden="true" />
  }

  if (module.kind === 'search') {
    return <SearchModule />
  }

  if (module.kind === 'element') {
    return <MountedElementModule module={module} />
  }

  return null
}

function PrimarySlot({ module }: { module: NewTabPageModule | undefined }) {
  const mountPrimaryElement = useCallback((node: HTMLDivElement | null) => {
    if (!node || !module || module.kind !== 'element') {
      return
    }
    module.element.dataset.newtabModule = module.id
    if (module.element.parentElement === node) {
      return
    }
    node.replaceChildren(module.element)
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

function MountedElementModule({ module }: { module: NewTabElementModule }) {
  const mountElement = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return
    }
    module.element.dataset.newtabModule = module.id
    if (module.element.parentElement === node.parentElement) {
      return
    }
    node.replaceWith(module.element)
  }, [module])

  return <div hidden ref={mountElement} />
}

function SearchModule() {
  const view = useNewtabSearchWidgetView()
  if (!view) {
    return null
  }

  return <NewtabSearchWidget view={view} />
}

function ClockModule() {
  const state = useNewtabClockView()
  if (!state) {
    return null
  }

  const settings = state.settings
  return (
    <section
      className="newtab-clock"
      style={{ '--clock-scale': String(settings.clockSize / 100) } as CSSProperties}
      data-clock-display-mode={settings.displayMode}
      data-clock-density={settings.density}
      data-clock-show-seconds={String(settings.showSeconds && settings.displayMode !== 'date')}
      data-clock-hour12={String(settings.hour12 && settings.displayMode !== 'date')}
      aria-label={state.ariaLabel}
    >
      <ClockWidgetContent state={state} />
    </section>
  )
}

function OnboardingStrip({ module }: { module: NewTabOnboardingModule }) {
  return (
    <section className="newtab-onboarding-strip" aria-label="Curator 首次使用引导">
      <div className="newtab-onboarding-copy">
        <strong>Curator 已将新标签页设为书签搜索和快捷入口</strong>
        <span>核心书签功能默认本地；网页搜索、精选远程背景、AI/Jina 和链接检测可关闭或跳过。</span>
      </div>
      <div className="newtab-onboarding-actions">
        <Button type="button" onClick={module.onOpenFolderSettings} unstyled>
          选择来源
        </Button>
        <Button className="secondary" type="button" onClick={module.onSkip} unstyled>
          我知道了
        </Button>
      </div>
    </section>
  )
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
