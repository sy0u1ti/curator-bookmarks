import type { CSSProperties } from 'react'

export const folderRowClass = 'relative block min-h-[34px]'
export const folderCardClass = [
  'relative grid min-h-[34px] w-full min-w-0 grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-[7px] rounded-ds-sm border border-transparent bg-transparent py-1.5 pr-2 pl-2 text-left text-ds-text-primary outline-none',
  'transition-[border-color,background-color,color,transform,scale] duration-ds-fast ease-ds-standard',
  'popup-folder-card active:scale-[0.993]'
].join(' ')
export const folderCardActiveClass =
  'bg-ds-text-primary/[0.055] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[2px] before:rounded-full before:bg-ds-text-primary/70 before:content-[""]'
export const folderBranchClass =
  'relative inline-grid h-2.5 w-2.5 flex-none place-items-center justify-self-center rounded-bl-[4px] border-b border-l border-b-white/20 border-l-white/20 bg-transparent text-ds-text-secondary'
export const folderMainClass =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[7px]'
export const folderTitleClass =
  'min-w-0 truncate text-left text-xs font-bold leading-tight text-ds-text-primary'
export const folderCountClass =
  'min-w-0 justify-self-end bg-transparent p-0 text-right text-xs font-semibold leading-tight text-ds-text-disabled [font-variant-numeric:tabular-nums]'
export const folderCountActiveClass = 'text-ds-text-secondary'

export function getFolderDepthStyle(depth: number): CSSProperties {
  const normalizedDepth = Math.max(0, Number(depth) || 0)
  return { paddingLeft: `${8 + normalizedDepth * 16}px` }
}
