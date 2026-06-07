# Chrome Extension Native React Runtime Migration Design

## Summary

Curator currently has React entry points for popup, options, and newtab, but the main UI behavior is still largely driven by legacy runtime files that directly manipulate DOM nodes, attach delegated event listeners, and call imperative render functions. This design moves the extension to a native React architecture while keeping the extension usable throughout the migration.

The selected approach is a staged pure React migration:

1. Use popup as the first complete migration slice.
2. Move newtab next, including settings, search, bookmark grid, drag interactions, background controls, and dashboard overlay entry points.
3. Move options and dashboard last, because they have the largest management workflows and highest mutation surface.
4. Allow short-lived compatibility adapters only while a slice is actively being migrated.
5. Remove legacy runtime and old DOM-driven UI code at the end of each completed slice.

The final state must not depend on `popup-runtime.ts`, `newtab-runtime.ts`, `options-runtime.ts`, or `dashboard-runtime.ts` for UI rendering, event wiring, class toggling, text updates, or DOM tree construction.

## Current State

The extension pages already mount React:

- `src/popup/main.tsx` renders `PopupApp`.
- `src/options/main.tsx` renders `OptionsApp`.
- `src/newtab/main.tsx` renders `NewtabApp`.

Each App then imports a legacy runtime:

- `PopupApp` imports `popup-runtime.js`.
- `OptionsApp` imports `options-runtime.js`.
- `NewtabApp` imports `newtab-runtime.js`.

Large runtime files still own most UI behavior:

- `src/popup/popup-runtime.ts`
- `src/newtab/newtab-runtime.ts`
- `src/options/options-runtime.ts`
- `src/options/sections/dashboard-runtime.ts`

There are also React island files, such as `PopupRuntimeIslands.tsx`, `RuntimeIslands.tsx`, and `DashboardRuntimeIslands.tsx`. These are useful stepping stones, but they are not the final architecture because legacy runtimes still decide when and where to render them.

## Goals

- Make popup, newtab, options, and dashboard native React surfaces.
- Replace legacy imperative UI rendering with React components, hooks, reducers, and context where useful.
- Preserve all extension behavior during migration:
  - bookmark browsing, opening, editing, moving, deleting
  - search, advanced search, natural language search, semantic search fallback
  - smart save and AI classification
  - newtab bookmark display, folders, speed dial, search, clock, backgrounds, settings
  - dashboard browse/filter/select/move/delete/tag workflows
  - options workflows for backup, restore, availability checks, redirects, duplicates, folder cleanup, ignore rules, recycle bin, AI settings, shortcuts
- Keep Chrome extension MV3 constraints intact.
- Keep non-UI business logic reusable and testable outside React.
- Delete old runtime and old DOM rendering code after the corresponding React slice is complete.

## Non-Goals

- Do not rewrite the service worker into React.
- Do not change the manifest behavior unless required by the migration.
- Do not redesign the product visually as part of this migration.
- Do not change storage schemas unless a migration is explicitly required.
- Do not remove existing features to make the migration easier.
- Do not keep long-term React islands controlled by old runtime files.

## Target Architecture

Each page should have one React-owned root:

- `popup/main.tsx -> <PopupApp />`
- `newtab/main.tsx -> <NewtabApp />`
- `options/main.tsx -> <OptionsApp />`

The React app owns:

- initial data loading
- page state
- route/hash state
- UI rendering
- event handling
- modal and popover state
- keyboard navigation
- loading, empty, pending, and error states
- optimistic updates and rollback surfaces where needed

Non-UI modules remain plain TypeScript:

- Chrome API wrappers
- bookmark tree and bookmark mutation services
- search parsing and search index modules
- AI provider and request modules
- repositories and storage modules
- permission helpers
- backup and restore logic
- background media and favicon loading helpers
- drag geometry helpers

These modules must not create page UI, query page elements, mutate class names, write `textContent`, or call `replaceChildren`. If a non-UI module needs to report state, it returns data or emits typed events that React consumes.

## State Model

Each major surface gets a dedicated state boundary:

- Popup: `usePopupController` plus a reducer for view mode, search state, bookmark selection, modal state, smart classifier state, pending actions, and toast queue.
- Newtab: `useNewtabController` plus focused reducers for modules, bookmarks, search, settings drawer, background media, drag state, and dashboard overlay.
- Options: `useOptionsController` for route, overview, settings, global modal state, and shared folder pickers.
- Dashboard: `useDashboardController` for model loading, search/filter, folder navigation, selection, virtual list state, tag editor, drag state, and batch actions.

State should be colocated with the smallest owner that can understand it. Global context should be used only for cross-cutting concerns such as theme, Chrome API service access, toast dispatch, and shared extension data snapshots.

## Migration Phases

### Phase 0: Migration Guardrails

Create a migration inventory before changing behavior:

- List every exported function from each legacy runtime.
- Classify each function as UI render, event handler, state mutation, Chrome API operation, or pure helper.
- Identify DOM selectors and IDs still required by CSS or tests.
- Record current smoke paths for popup, newtab, options, and dashboard.

Add guardrails:

- Keep typecheck and build green after every slice.
- Prefer moving pure helpers before rewriting UI.
- Keep CSS class names stable unless the component migration requires a focused rename.
- Do not delete a runtime section until the equivalent React behavior has been smoke tested.

### Phase 1: Popup React Migration

Popup is the first complete slice because it is smaller than newtab and options but still exercises search, bookmark mutations, modals, smart save, AI setup, and toasts.

Steps:

1. Extract non-DOM logic from `popup-runtime.ts` into popup services and shared helpers.
2. Build `usePopupController` to load bookmarks, manage search state, derive visible folders/results, and expose typed actions.
3. Convert modal flows to React state:
   - move bookmark
   - smart folder save
   - AI provider prompt
   - edit bookmark
   - delete confirmation
4. Convert popup content rendering from runtime-driven islands to normal React components.
5. Convert keyboard navigation and focus management into React hooks.
6. Keep `PopupRuntimeIslands.tsx` only until the equivalent components are directly rendered by `PopupApp`.
7. Delete `popup-runtime.ts` once popup no longer imports it.

Popup acceptance:

- `PopupApp` must not import `popup-runtime.js`.
- Popup UI must not depend on runtime-owned `render()` calls.
- Search, navigation, edit, move, delete, smart save, AI prompt, and toasts must still work.
- Typecheck, build, and popup smoke flow pass.

### Phase 2: Newtab React Migration

Newtab is the second slice because it is the user-facing daily surface and has complex layout, settings, background, search, and drag behavior.

Steps:

1. Extract bookmark loading, settings loading, background loading, and search helpers into non-DOM services.
2. Build `useNewtabController` and focused hooks:
   - `useNewtabBookmarks`
   - `useNewtabSearch`
   - `useNewtabSettings`
   - `useNewtabBackground`
   - `useNewtabDrag`
   - `useNewtabClock`
3. Convert settings drawer from mount helper into a React-rendered component owned by `NewtabApp`.
4. Convert dashboard overlay mount helper into React state and component ownership.
5. Convert featured background modal into direct React ownership.
6. Convert bookmark grid, speed dial, folders, search bar, suggestions, saved searches, clock, toast, and context menus into React components.
7. Keep the instant wallpaper boot script only if it remains necessary for first-paint performance; it must remain a pre-React visual bootstrap and must not become a general UI runtime.
8. Delete `newtab-runtime.ts` once newtab no longer imports it.

Newtab acceptance:

- `NewtabApp` must not import `newtab-runtime.js`.
- Settings drawer, background picker, search, folders, bookmark grid, speed dial, context menus, dashboard entry, and drag workflows work.
- Background first paint remains acceptable.
- Typecheck, build, and newtab smoke flows pass.

### Phase 3: Options And Dashboard React Migration

Options and dashboard are migrated last because they include the broadest settings, batch actions, and destructive workflows.

Steps:

1. Extract options runtime logic into services by domain:
   - availability
   - redirects
   - duplicates
   - folder cleanup
   - recycle bin
   - backup and restore
   - AI settings and model fetching
   - bookmark add history
   - ignore rules
   - shortcuts
2. Convert options route/hash management into React state.
3. Convert shared modals and folder pickers into React state.
4. Convert dashboard runtime into a React dashboard controller.
5. Preserve dashboard virtualization as a React component or hook, with DOM measurement isolated behind refs.
6. Convert dashboard drag, tag editing, selection bar, folder tree, breadcrumbs, filters, and cards into React components.
7. Remove `DashboardRuntimeIslands.tsx` once dashboard components are directly rendered.
8. Delete `options-runtime.ts` and `dashboard-runtime.ts` once options and dashboard no longer import them.

Options/dashboard acceptance:

- `OptionsApp` must not import `options-runtime.js`.
- Dashboard lazy loader must not import `dashboard-runtime.js`.
- All management workflows still support preview, confirmation, automatic backup, and recycle-bin protections.
- Embedded dashboard mode from newtab still works.
- Typecheck, build, and options/dashboard smoke flows pass.

## Compatibility Layer Rules

Compatibility is allowed only during active migration of a slice.

Allowed temporarily:

- an adapter that calls old runtime for an unmigrated workflow
- a wrapper that translates old view-model data into new component props
- a bridge event used to keep a migrated component working while surrounding UI is still old

Not allowed in final state:

- legacy runtime import from any App component
- old runtime owning click/input/keydown handlers for React-rendered UI
- `innerHTML`, `replaceChildren`, `textContent =`, or `classList` as primary UI rendering mechanisms
- React islands rendered by old runtime as the long-term architecture
- hidden DOM templates that React depends on

## Error Handling

React controllers should expose explicit states:

- `idle`
- `loading`
- `ready`
- `empty`
- `pending`
- `error`

Errors from Chrome APIs, AI requests, backup/import flows, search workers, and permission requests should be normalized into typed error objects. UI components should render those errors through React alerts, toasts, or inline messages.

Destructive workflows must keep existing safety properties:

- preview before mutation when the current feature already has preview
- confirmation before destructive action
- automatic backup where currently required
- recycle bin path where currently supported
- visible pending state and disabled repeated submit where mutation is in progress

## Testing And Verification

Required after every migration slice:

- `npm run typecheck`
- `npm run build`
- targeted smoke flow for the migrated page

Recommended smoke coverage:

- Popup:
  - load popup
  - search bookmarks
  - open folder
  - edit bookmark
  - move bookmark
  - delete bookmark through confirmation
  - smart save prompt path
  - AI not-configured path
- Newtab:
  - load newtab
  - display configured bookmarks
  - search bar query and clear
  - settings drawer open/close
  - background settings preview and commit
  - folder and speed dial interactions
  - dashboard overlay open/close
  - drag reorder or drag move path
- Options/dashboard:
  - route navigation
  - availability settings and dry interaction
  - duplicate selection workflow
  - recycle restore/delete workflow
  - backup export/import preview path
  - AI settings model selection path
  - dashboard search/filter/select/card actions
  - embedded dashboard mode from newtab

Regression checks should compare behavior, not implementation. A slice is complete only when old UI runtime code for that slice is gone and the smoke path still passes.

## Cleanup Criteria

The migration is complete only when all of the following are true:

- No App imports `popup-runtime.js`, `newtab-runtime.js`, or `options-runtime.js`.
- Dashboard code no longer imports `dashboard-runtime.js`.
- Legacy runtime files are deleted or reduced to non-UI compatibility-free exports that have been renamed to services.
- Runtime island files are deleted or converted into normal component modules.
- Page UI code does not use `document.querySelector`, `getElementById`, `innerHTML`, `replaceChildren`, `textContent =`, or `classList` for ordinary rendering.
- Remaining direct DOM access is limited to legitimate React ref use cases:
  - focus management
  - measuring layout
  - scroll positioning
  - file input activation
  - canvas or media APIs
  - extension first-paint bootstrap
- The extension builds and smoke tests pass.

## Rollback Strategy

Each phase should be small enough to revert independently.

During a page migration, keep old and new boundaries explicit:

- If a migrated flow fails, revert only that flow or adapter.
- Do not mix unrelated visual redesign with runtime removal.
- Avoid moving storage schemas and UI ownership in the same slice.
- Keep compatibility bridges named and easy to find so they can be deleted at the end of the slice.

## Documentation Updates

When implementation begins, maintain a migration checklist near the implementation plan or in a follow-up tracking document. The checklist should mark:

- runtime exports moved
- components migrated
- old DOM selectors removed
- tests/smoke flows added
- runtime file deletion status

This design document is the target architecture and safety contract. The implementation plan should be written separately before code changes begin.
