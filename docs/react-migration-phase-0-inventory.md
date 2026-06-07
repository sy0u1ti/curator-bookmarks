# React Migration Phase 0 Inventory

This inventory is the working guardrail for the native React, Tailwind, and Base UI migration described in `docs/spark/2026-06-08-react-runtime-migration-design.md`.

## Baseline

- Working tree baseline was clean before Phase 0 edits.
- `npm run typecheck` initially failed on existing Base UI wrapper type mismatches and an AI model picker island naming mismatch.
- `npm run typecheck` now passes after wrapper and compatibility island fixes.
- `npm run build` passes.
- `npm test` currently fails because `scripts/run-tests.mjs` does not exist.
- `npm run smoke:extension` is also expected to fail for the same missing `scripts/` directory reason.

## Base UI Documentation Read

The migration requirement to read Base UI docs before implementation has been satisfied for this Phase 0 baseline work:

- `https://base-ui.com/llms.txt`
- `https://base-ui.com/react/components/select`
- `https://base-ui.com/react/components/drawer`
- `https://base-ui.com/react/components/progress`
- `https://base-ui.com/react/handbook/composition`

Local package type definitions under `node_modules/@base-ui/react` were also checked for the exact installed API surface:

- `Select.Root` supports `modal`.
- `Select.Portal` supports `container`.
- `Drawer.Popup` supports `initialFocus` and `finalFocus`.
- `Progress.Indicator` is a Base UI div primitive and supports standard component props such as class names, data attributes, and style.

## Legacy Runtime Files

| File | Approx. Lines | Exported Runtime Surface | DOM Operation Count | Migration Role |
| --- | ---: | --- | ---: | --- |
| `src/popup/popup-runtime.ts` | 4,558 | `startPopupRuntime` | 108 | Phase 1 removal target |
| `src/newtab/newtab-runtime.ts` | 13,075 | `startNewTabRuntime` | 450 | Phase 2 removal target |
| `src/options/options-runtime.ts` | 10,125 | `startOptionsRuntime` | 302 | Phase 3 removal target |
| `src/options/sections/dashboard-runtime.ts` | 5,979 | dashboard helpers, event handlers, render functions | 112 | Phase 3 removal target after extracting pure helpers |
| `src/options/sections/tag-cloud-runtime.ts` | 632 | `startTagCloudPhysics`, `stopTagCloudPhysics` | 14 | Phase 3 removal or React ref-based physics target |

DOM operation counts were gathered from occurrences of selectors and imperative DOM operations such as `querySelector`, `getElementById`, `addEventListener`, `replaceChildren`, `textContent =`, `classList`, `createElement`, `appendChild`, and direct style mutation.

## Runtime Island Files

| File | Approx. Lines | Current Role | Final State |
| --- | ---: | --- | --- |
| `src/popup/components/PopupRuntimeIslands.tsx` | 1,300 | React islands controlled by popup runtime | Convert to normal popup components, then delete island render API |
| `src/newtab/components/RuntimeIslands.tsx` | 1,782 | React islands controlled by newtab runtime | Convert to normal newtab components, then delete island render API |
| `src/options/components/DashboardRuntimeIslands.tsx` | 825 | React islands controlled by dashboard runtime | Convert to dashboard components, then delete island render API |

## Export Classification

### Popup

- `startPopupRuntime`: page startup, DOM event binding, state initialization, and imperative render ownership.
- Final destination: `PopupApp` plus `usePopupController`, React components, and non-DOM popup services.

### Newtab

- `startNewTabRuntime`: page startup, settings, background, search, drag, dashboard overlay, and imperative render ownership.
- Final destination: `NewtabApp` plus focused hooks for bookmarks, settings, background, search, drag, clock, and dashboard overlay.

### Options

- `startOptionsRuntime`: route handling, settings, management workflows, modal state, and delegated event binding.
- Final destination: `OptionsApp`, options domain controllers, React route/hash state, and non-DOM services.

### Dashboard

Dashboard runtime exports fall into three groups:

- Pure or mostly pure helpers to extract early:
  - drag snapshot helpers
  - selection label helpers
  - virtual metrics helpers
  - speed dial message helpers
  - favicon fallback helper
- React controller actions:
  - search/filter input handling
  - selection mutations
  - tag popover/editor state
  - drag state
  - move/delete workflows
- Imperative UI render and DOM event handlers to replace:
  - `renderDashboardSection`
  - dashboard card/list rendering
  - virtual list DOM mutation
  - tag editor/popover DOM positioning
  - drag overlay DOM mutation

### Tag Cloud Runtime

- `startTagCloudPhysics` and `stopTagCloudPhysics` own pointer event listeners and element transforms.
- Final destination should be a React ref-driven component or removal if the surrounding tag management feature is retired during options migration.

## Base UI Primitive Inventory

Current handcrafted primitive files under `src/ui/primitives`:

- `Badge.tsx`
- `Button.tsx`
- `Card.tsx`
- `Checkbox.tsx`
- `CloseButton.tsx`
- `Collapsible.tsx`
- `Dialog.tsx`
- `DotMatrixLoader.tsx`
- `Drawer.tsx`
- `EmptyState.tsx`
- `IconButton.tsx`
- `Input.tsx`
- `Menu.tsx`
- `Popover.tsx`
- `Progress.tsx`
- `Select.tsx`
- `Slider.tsx`
- `Spinner.tsx`
- `Switch.tsx`
- `Tabs.tsx`
- `Textarea.tsx`
- `Toast.tsx`
- `Tooltip.tsx`
- `utils.ts`

Final classification:

- Rebuild or keep as documented Base UI composition:
  - Checkbox
  - Collapsible
  - Dialog
  - Drawer
  - Menu
  - Popover
  - Progress
  - Select
  - Slider
  - Switch
  - Tabs
  - Toast
  - Tooltip
- Convert to simple Tailwind presentational components:
  - Badge
  - Button
  - Card
  - CloseButton
  - EmptyState
  - IconButton
  - Input
  - Textarea
  - Spinner
  - DotMatrixLoader
- Keep only if it remains a tiny helper:
  - `utils.ts`

The first Phase 0 code fix updated existing Base UI wrappers to match current usage and installed Base UI APIs. This is a compatibility fix, not the final primitive cleanup.

## CSS Inventory

| File | Approx. Lines | Final Direction |
| --- | ---: | --- |
| `src/options/options.css` | 12,640 | Gradually replace component internals with Tailwind during options/dashboard migration |
| `src/popup/popup.css` | 6,984 | Gradually replace component internals with Tailwind during popup migration |
| `src/newtab/newtab-deferred.css` | 5,077 | Preserve only deferred/global/media/animation rules that still need CSS |
| `src/newtab/newtab.css` | 3,133 | Gradually replace component internals with Tailwind during newtab migration |
| `src/shared/ui-refresh.css` | 384 | Audit for shared legacy selectors and fold into tokens/utilities where possible |
| `src/styles/globals.css` | 38 | Keep as global entry if still needed |
| `src/styles/tokens.css` | 23 | Keep or convert into Tailwind-compatible token layer |
| `src/styles/tailwind.css` | 18 | Keep as Tailwind entry |

## Smoke Paths To Preserve

No runnable smoke scripts currently exist in the checked-in `scripts/` directory. Until scripts are restored or recreated, manual or Playwright smoke paths should cover:

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

## Immediate Next Step

Phase 1 should start with popup. Before replacing UI, extract popup non-DOM logic from `popup-runtime.ts` into services and a controller boundary, then render those flows directly from `PopupApp`.
