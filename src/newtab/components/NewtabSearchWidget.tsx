import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type Ref } from 'react'
import { Button, Icon, InlineMenuList, Input } from '../../ui'
import {
  setNewtabSearchWidgetNodes,
  type NewtabSearchWidgetView,
  type SearchChipViewModel,
  type SearchEngineMenuState,
  type SearchHintState,
  type SearchSuggestionViewModel,
  type SearchWidgetNaturalButtonState,
  type SavedSearchesState
} from '../newtab-search-widget-store'

export function NewtabSearchWidget({ view }: { view: NewtabSearchWidgetView }) {
  const slotRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const engineButtonRef = useRef<HTMLButtonElement | null>(null)
  const engineMenuRef = useRef<HTMLDivElement | null>(null)
  const shell = view.shell
  const slotStyle = useMemo(() => ({
    '--search-width': `${shell.width}vw`,
    '--search-height': `${shell.height}px`,
    '--search-offset-y': `${shell.offsetY}px`
  }) as CSSProperties, [shell.height, shell.offsetY, shell.width])
  const formStyle = useMemo(() => ({
    '--search-width': `${shell.width}vw`,
    '--search-height': `${shell.height}px`,
    '--search-bg-alpha': shell.backgroundAlpha
  }) as CSSProperties, [shell.backgroundAlpha, shell.height, shell.width])

  useLayoutEffect(() => {
    const nodes = {
      engineButton: engineButtonRef.current,
      engineMenu: engineMenuRef.current,
      input: inputRef.current,
      slot: slotRef.current
    }
    setNewtabSearchWidgetNodes(nodes)
    view.onNodesChange?.(nodes)
  })

  useEffect(() => {
    const onNodesChange = view.onNodesChange
    return () => {
      const nodes = {
        engineButton: null,
        engineMenu: null,
        input: null,
        slot: null
      }
      setNewtabSearchWidgetNodes(nodes)
      onNodesChange?.(nodes)
    }
  }, [view.onNodesChange])

  return (
    <section
      className="newtab-search-slot"
      style={slotStyle}
      data-search-auto-vertical-center={String(shell.autoVerticalCenter)}
      aria-label={shell.ariaLabel}
      ref={slotRef}
    >
      <div className="newtab-search-shell" onBlur={view.interactions.onRootBlur}>
        <form
          className="newtab-search"
          style={formStyle}
          role="search"
          aria-label={shell.ariaLabel}
          onSubmit={view.interactions.onSubmit}
        >
          <Icon name="Search" className="newtab-search-icon" size={16} aria-hidden="true" />
          <SearchWidgetInput view={view} inputRef={inputRef} />
          <SearchWidgetClearButton view={view} />
          <SearchWidgetSeparator view={view} />
          <SearchWidgetNaturalButton view={view} />
          <SearchWidgetEngineButton view={view} buttonRef={engineButtonRef} />
          <SearchWidgetSubmitButton view={view} />
        </form>
        <SearchWidgetEngineMenu view={view} menuRef={engineMenuRef} />
        <SearchWidgetSuggestionsPanel view={view} />
      </div>
    </section>
  )
}

function SearchWidgetInput({
  inputRef,
  view
}: {
  inputRef: Ref<HTMLInputElement>
  view: NewtabSearchWidgetView
}) {
  const { combobox, interactions, shell } = view

  return (
    <Input
      className="newtab-search-input"
      type="search"
      autoComplete="off"
      enterKeyHint="search"
      placeholder={shell.placeholder}
      spellCheck={false}
      role="combobox"
      aria-label={shell.inputAriaLabel}
      aria-autocomplete="list"
      aria-controls="newtab-search-suggestions"
      aria-expanded={combobox.expanded}
      aria-activedescendant={combobox.activeDescendantId || undefined}
      onFocus={interactions.onInputFocus}
      onInput={interactions.onInputInput}
      onKeyDown={interactions.onInputKeyDown}
      ref={inputRef}
      unstyled
    />
  )
}

function SearchWidgetClearButton({ view }: { view: NewtabSearchWidgetView }) {
  const { hasInputValue } = view.action

  return (
    <Button
      className={hasInputValue ? 'newtab-search-clear' : 'newtab-search-clear hidden'}
      type="button"
      aria-label="清空搜索"
      onClick={view.interactions.onClear}
      unstyled
    >
      <Icon name="X" size={14} aria-hidden="true" />
    </Button>
  )
}

function SearchWidgetSeparator({ view }: { view: NewtabSearchWidgetView }) {
  const { hasInputValue } = view.action

  return (
    <span
      className={hasInputValue ? 'newtab-search-separator' : 'newtab-search-separator hidden'}
      aria-hidden="true"
    />
  )
}

function SearchWidgetSubmitButton({ view }: { view: NewtabSearchWidgetView }) {
  const { canSubmit } = view.action

  return (
    <Button
      className="newtab-search-submit"
      type="submit"
      aria-label="搜索网页"
      aria-disabled={!canSubmit}
      title="搜索网页"
      disabled={!canSubmit}
      unstyled
    >
      <Icon name="Search" className="newtab-search-submit-icon" size={14} aria-hidden="true" />
    </Button>
  )
}

function SearchWidgetNaturalButton({ view }: { view: NewtabSearchWidgetView }) {
  const { natural } = view.buttons

  return (
    <Button
      className={getNaturalSearchButtonClassName(natural)}
      type="button"
      aria-pressed={natural.active}
      aria-label={natural.ariaLabel}
      title={natural.title}
      onClick={view.interactions.onToggleNatural}
      unstyled
    >
      {natural.label}
    </Button>
  )
}

function SearchWidgetEngineButton({
  buttonRef,
  view
}: {
  buttonRef: Ref<HTMLButtonElement>
  view: NewtabSearchWidgetView
}) {
  const { engine } = view.buttons

  return (
    <Button
      className="newtab-search-engine"
      type="button"
      aria-haspopup="menu"
      aria-expanded={engine.expanded ? 'true' : 'false'}
      aria-label={engine.ariaLabel}
      disabled={engine.disabled}
      title={engine.title}
      onClick={view.interactions.onEngineToggle}
      onKeyDown={view.interactions.onEngineKeyDown}
      ref={buttonRef}
      unstyled
    >
      {engine.label}
    </Button>
  )
}

function SearchWidgetEngineMenu({
  menuRef,
  view
}: {
  menuRef: Ref<HTMLDivElement>
  view: NewtabSearchWidgetView
}) {
  const { engineMenu } = view
  if (!engineMenu.open) {
    return null
  }

  return (
    <div
      className="newtab-search-engine-menu"
      role="menu"
      aria-label="搜索引擎"
      onKeyDown={engineMenu.onKeyDown}
      ref={menuRef}
    >
      <SearchEngineMenu state={engineMenu} />
    </div>
  )
}

function SearchWidgetSuggestionsPanel({ view }: { view: NewtabSearchWidgetView }) {
  const { panel } = view

  return (
    <div
      id="newtab-search-suggestions-panel"
      className={panel.panelVisible
        ? 'newtab-search-suggestions-panel'
        : 'newtab-search-suggestions-panel hidden'}
    >
      <div className="newtab-search-chips" aria-label="当前搜索条件">
        <SearchChips chips={view.chips} />
      </div>
      <div className="newtab-search-section-label">
        <SearchSectionLabel label={view.sectionLabel} />
      </div>
      <div
        id="newtab-search-suggestions"
        className="newtab-search-suggestions"
        role="listbox"
        aria-label="匹配的书签"
        hidden={!panel.suggestionsVisible}
      >
        <SearchSuggestions suggestions={view.suggestions} />
      </div>
      <div className="newtab-search-hint" role="status" aria-live="polite">
        <SearchHint state={view.hint} />
      </div>
      <div className="newtab-saved-searches" aria-label="已保存搜索">
        <SavedSearches state={view.savedSearches} />
      </div>
    </div>
  )
}

function getNaturalSearchButtonClassName(state: SearchWidgetNaturalButtonState): string {
  return [
    'newtab-search-natural',
    state.active ? 'active' : '',
    state.pending ? 'pending' : '',
    state.fallback ? 'fallback' : ''
  ].filter(Boolean).join(' ')
}

function SearchEngineMenu({ state }: { state: SearchEngineMenuState }) {
  return (
    <>
      <InlineMenuList
        actions={state.items.map((item) => ({
          id: item.id,
          label: item.label,
          className: item.active ? 'newtab-search-engine-item active' : 'newtab-search-engine-item',
          closeOnSelect: false,
          onSelect: item.onSelect,
          attributes: {
            role: 'menuitemradio',
            'aria-checked': String(item.active),
            tabIndex: '-1'
          }
        }))}
        className="newtab-search-engine-menu-items"
        label="搜索引擎"
      />
      <div className="newtab-search-engine-menu-hint">{state.hint}</div>
    </>
  )
}

function SearchChips({ chips }: { chips: SearchChipViewModel[] }) {
  if (!chips.length) {
    return null
  }

  return (
    <>
      {chips.map((chip) => (
        <span className={`newtab-search-chip ${chip.kind}`} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </>
  )
}

function SearchSuggestions({ suggestions }: { suggestions: SearchSuggestionViewModel[] }) {
  return (
    <>
      {suggestions.map((suggestion) => (
        <Button
          id={suggestion.elementId}
          className={[
            'newtab-search-suggestion',
            suggestion.command ? 'command' : '',
            suggestion.active ? 'active' : ''
          ].filter(Boolean).join(' ')}
          type="button"
          role="option"
          aria-selected={suggestion.active}
          aria-label={suggestion.ariaLabel}
          onPointerDown={(event) => {
            event.preventDefault()
          }}
          onClick={suggestion.onSelect}
          unstyled
          key={suggestion.id}
        >
          <span className="newtab-search-suggestion-mark" aria-hidden="true">
            {suggestion.mark}
          </span>
          <span className="newtab-search-suggestion-copy">
            <strong>{suggestion.title}</strong>
            <span>{suggestion.meta}</span>
          </span>
        </Button>
      ))}
    </>
  )
}

function SearchSectionLabel({ label }: { label: string }) {
  return label ? <>{label}</> : null
}

function SearchHint({ state }: { state: SearchHintState }) {
  if (state.type === 'empty') {
    return null
  }

  if (state.type === 'webFallback') {
    return (
      <Button
        className="newtab-search-web-hint"
        type="button"
        title={state.title}
        aria-label={state.ariaLabel}
        onPointerDown={(event) => {
          event.preventDefault()
        }}
        onClick={state.onSelect}
        unstyled
      >
        {state.label}
      </Button>
    )
  }

  return <>{state.text}</>
}

function SavedSearches({ state }: { state: SavedSearchesState }) {
  if (!state.show) {
    return null
  }

  return (
    <>
      <div className="newtab-saved-search-head">
        <span className={state.error ? 'error' : ''}>{state.error || '保存搜索'}</span>
        {state.canSaveCurrent ? (
          <Button
            className="newtab-saved-search-save"
            type="button"
            disabled={state.hasCurrentSaved}
            onPointerDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              void state.onSaveCurrent()
            }}
            unstyled
          >
            {state.hasCurrentSaved ? '已保存' : '保存'}
          </Button>
        ) : null}
      </div>
      {state.items.length ? (
        <div className="newtab-saved-search-list">
          {state.items.map((item) => (
            <span className="newtab-saved-search-chip" key={item.id}>
              <Button
                className="newtab-saved-search-apply"
                type="button"
                title={item.query}
                onPointerDown={(event) => {
                  event.preventDefault()
                }}
                onClick={item.onApply}
                unstyled
              >
                {item.label}
              </Button>
              <Button
                className="newtab-saved-search-delete"
                type="button"
                aria-label={`删除保存搜索：${item.label}`}
                onPointerDown={(event) => {
                  event.preventDefault()
                }}
                onClick={() => {
                  void item.onDelete()
                }}
                unstyled
              >
                <Icon name="X" size={12} aria-hidden="true" />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  )
}
