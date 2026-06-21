const BOOKMARK_MENU_INTERACTION_SELECTOR = [
  '[data-newtab-bookmark-menu-surface]',
  '[data-bookmark-id]'
].join(', ')

export function isBookmarkMenuInteractionTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(BOOKMARK_MENU_INTERACTION_SELECTOR))
}
