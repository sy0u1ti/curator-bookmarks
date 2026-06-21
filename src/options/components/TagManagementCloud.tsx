import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { buildTagCloudItems, type TagCloudItem, type TagCloudTier } from '../../shared/tag-cloud.js'
import { Button } from '../../ui/base/Button.js'
import { cx } from '../../ui/base/utils.js'
import { useTagManagementCloudState } from './tag-management-cloud-store.js'
import { patchTagManagementControlsForm } from './tag-management-controls-store.js'
import { useTagCloudPhysics } from './useTagCloudPhysics.js'

const TAG_MANAGEMENT_EMPTY_CLASS =
  'rounded-lg border border-[var(--ui-divider-subtle)] bg-[#171719] px-4 py-[18px] text-[13px] leading-[1.7] text-[var(--ui-text-secondary)]'
const TAG_MANAGEMENT_CLOUD_ROOT_CLASS =
  'relative m-0 h-[clamp(500px,calc(100vh-232px),980px)] min-h-0 overflow-hidden rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] p-0 shadow-none [contain:layout_paint] touch-none select-none hover:border-[var(--ui-divider)] hover:bg-[#080808] max-[760px]:h-[clamp(420px,calc(100vh-282px),760px)]'
const TAG_MANAGEMENT_CLOUD_ITEM_CLASS = 'list-none'
const TAG_MANAGEMENT_CLOUD_WORD_CLASS =
  'absolute left-0 top-0 max-w-[min(300px,46%)] cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis border-0 bg-transparent p-[2px_4px] [color:rgba(245,245,247,var(--tag-alpha))] [font-family:inherit] text-[length:var(--tag-size)] font-[760] [letter-spacing:0] leading-[1.05] opacity-0 pointer-events-auto [transform:translate3d(var(--tag-x),var(--tag-y),0)_translate(-50%,-50%)] will-change-transform animate-[tag-cloud-word-enter_420ms_var(--ui-ease-standard)_forwards] [transition:color_var(--ui-motion-standard)_var(--ui-ease-standard),opacity_var(--ui-motion-standard)_var(--ui-ease-standard),text-shadow_var(--ui-motion-standard)_var(--ui-ease-standard),filter_var(--ui-motion-standard)_var(--ui-ease-standard)] hover:z-[2] hover:[color:var(--ui-text-primary)] hover:[text-shadow:0_0_14px_rgba(59,130,246,0.26)] focus-visible:z-[2] focus-visible:outline-none focus-visible:[color:var(--ui-text-primary)] focus-visible:[text-shadow:0_0_14px_rgba(59,130,246,0.26)]'
const TAG_MANAGEMENT_CLOUD_TIER_CLASS: Record<TagCloudTier, string> = {
  core: 'font-[780]',
  body: 'font-[690]',
  mist: 'font-[560]'
}
const TAG_MANAGEMENT_CLOUD_PROMINENT_CLASS = '[color:rgba(213,255,190,var(--tag-alpha))]'
const TAG_MANAGEMENT_CLOUD_TAIL_CLASS = 'font-[560]'
const TAG_MANAGEMENT_CLOUD_DRAGGING_CLASS =
  'z-[5] [color:var(--ui-text-primary)] [filter:drop-shadow(0_0_12px_rgba(59,130,246,0.22))] [text-shadow:0_0_18px_rgba(59,130,246,0.34)]'

export function TagManagementCloud() {
  const cloudRef = useRef<HTMLUListElement | null>(null)
  const wordRefsRef = useRef<Map<string, HTMLElement> | null>(null)
  if (wordRefsRef.current === null) {
    wordRefsRef.current = new Map()
  }
  const { stats } = useTagManagementCloudState()
  const [dimensions, setDimensions] = useState(() => getTagCloudDimensions(null))
  const items = useMemo(() => buildTagCloudItems(stats, {
    widthPx: dimensions.widthPx,
    heightPx: dimensions.heightPx
  }), [dimensions.heightPx, dimensions.widthPx, stats])
  const simulationKey = useMemo(
    () => items.map((item) => `${item.tag}:${item.rank}:${item.leftPercent}:${item.topPercent}`).join('|'),
    [items]
  )
  const setWordElement = useCallback((tag: string, element: HTMLElement | null) => {
    if (!element) {
      wordRefsRef.current?.delete(tag)
      return
    }
    wordRefsRef.current?.set(tag, element)
  }, [])
  const getWordElement = useCallback((tag: string) => (
    wordRefsRef.current?.get(tag) ?? null
  ), [])
  const physics = useTagCloudPhysics(cloudRef, items, getWordElement, simulationKey)

  useLayoutEffect(() => {
    const root = cloudRef.current
    if (!root) {
      return undefined
    }

    const updateDimensions = () => {
      const nextDimensions = getTagCloudDimensions(root)
      setDimensions((currentDimensions) => {
        if (
          currentDimensions.widthPx === nextDimensions.widthPx &&
          currentDimensions.heightPx === nextDimensions.heightPx
        ) {
          return currentDimensions
        }
        return nextDimensions
      })
    }

    updateDimensions()
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updateDimensions)
      : null
    observer?.observe(root)
    return () => {
      observer?.disconnect()
    }
  }, [items.length])

  if (!items.length) {
    return (
      <div className={TAG_MANAGEMENT_EMPTY_CLASS}>
        还没有可管理的标签。先在 popup、书签仪表盘或智能分析里添加标签，之后这里会显示使用频率和整理操作。
      </div>
    )
  }

  return (
    <ul
      ref={cloudRef}
      className={TAG_MANAGEMENT_CLOUD_ROOT_CLASS}
      aria-label="标签词云，字号越大表示使用越频繁"
      onPointerMove={physics.onPointerMove}
      onPointerUp={physics.onPointerUp}
      onPointerCancel={physics.onPointerCancel}
    >
      {items.map((item) => (
        <TagManagementCloudWord
          dragging={physics.draggingTag === item.tag}
          item={item}
          key={`${item.tag}:${item.rank}`}
          onClick={physics.consumeSuppressedClick}
          onPointerDown={physics.onWordPointerDown}
          setWordElement={setWordElement}
        />
      ))}
    </ul>
  )
}

function getTagCloudDimensions(root: HTMLElement | null): { widthPx: number; heightPx: number } {
  return {
    widthPx: Math.max(960, Math.floor(root?.clientWidth || 0)),
    heightPx: Math.min(820, Math.max(520, Math.floor(window.innerHeight * 0.68)))
  }
}

function TagManagementCloudWord({
  dragging,
  item,
  onClick,
  onPointerDown,
  setWordElement
}: {
  dragging: boolean
  item: TagCloudItem
  onClick: (tag: string) => boolean
  onPointerDown: (tag: string, event: ReactPointerEvent<HTMLElement>) => void
  setWordElement: (tag: string, element: HTMLElement | null) => void
}) {
  const className = cx(
    TAG_MANAGEMENT_CLOUD_WORD_CLASS,
    TAG_MANAGEMENT_CLOUD_TIER_CLASS[item.tier],
    item.accent && TAG_MANAGEMENT_CLOUD_PROMINENT_CLASS,
    item.tail && TAG_MANAGEMENT_CLOUD_TAIL_CLASS,
    dragging && TAG_MANAGEMENT_CLOUD_DRAGGING_CLASS
  )

  return (
    <li className={TAG_MANAGEMENT_CLOUD_ITEM_CLASS}>
      <Button
        className={className}
        type="button"
        ref={(element) => setWordElement(item.tag, element)}
        onClick={(event: ReactMouseEvent<HTMLElement>) => {
          if (onClick(item.tag)) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          patchTagManagementControlsForm({ focusTarget: true, sourceTag: item.tag })
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLElement>) => {
          onPointerDown(item.tag, event)
        }}
        style={{
          '--tag-x': `${item.leftPercent}%`,
          '--tag-y': `${item.topPercent}%`,
          '--tag-size': `${item.fontSizePx}px`,
          '--tag-alpha': item.opacity
        } as CSSProperties}
        title={item.tag}
        aria-label={`选择标签 ${item.tag}`}
        unstyled
      >
        {item.tag}
      </Button>
    </li>
  )
}
