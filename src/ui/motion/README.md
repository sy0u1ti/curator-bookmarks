# Curator motion

Motion communicates input, selection and spatial relationships. It must not
postpone a data update, move a status slot, or change the user's hit target.
The visual design and the existing component/lifecycle ownership stay intact.

## Reference and adaptation

The initial reference is Magpie **0.1.2378**, followed by the locally installed
**0.1.2411** for interaction continuity, not a recreation from screenshots.
Its embedded frontend was extracted and analyzed with REA without execution.
Exact source slices and their hashes are under `.tmp/magpie-sidebar-20261031/`
and `.tmp/magpie-continuity-20261101/` (intentionally not shipped).

Relevant source:

- `assets/app.js`: `navTopGo` / `navTopStep`, response 0.42 seconds and damping
  ratio 0.84. A new target preserves velocity; the target is remeasured while
  the list folds. First placement is immediate.
- `assets/navlamp.js`: text-only pointer light, not a row background. Curator
  keeps that distinction but uses native text colour instead of the source's
  shared pointer coordinates and transparent glyph mask, which muddied small
  sidebar labels and kept moving the light in previously hovered rows.
- `assets/app.js`: surface spring samples, response 0.42 seconds and damping
  0.8, approximately 1.5% overshoot over a 570 ms tail.
- `assets/app.css`: `--ease: cubic-bezier(.2, .8, .2, 1)`, short control
  feedback, and a non-scaling sidebar press.
- `navSubEnter` / `navSubLeave`: 460 / 380 ms disclosure, 380 ms item entry,
  60 ms initial delay and 28 ms between items.

Curator adopts that hierarchy, not every effect indiscriminately. Full-width
rows never shrink, ordinary disclosures have a shorter budget than navigation,
live values stay immediate, and settings pages fade without sliding. Existing
New Tab materials, corner contours and status-layout contracts are unchanged.

## Shared roles

`src/styles/tokens.css` owns the values. Components choose a role, not a nearby
number. Durations below are milliseconds.

| Role | Enter / change | Exit | Curve |
| --- | --- | --- | --- |
| Small press / release | 120 / 160 | - | `--ds-ease-standard` |
| Control colour | 160 | 160 | `--ds-ease-standard` |
| Switch / segment | 280 | 280 | `--ds-ease-standard` |
| Ordinary disclosure | 280 | 220 | `--ds-ease-settle` |
| Sidebar disclosure | 460 | 380 | `--ds-ease-settle` |
| Menu / popover geometry | 420 | 220 | `--ds-ease-settle` |
| Menu / drawer opacity | 180 | 140 | `--ds-ease-standard` |
| Dialog geometry | 570 | 260 | surface spring / settle |
| Dialog opacity | 240 | 140 | `--ds-ease-standard` |
| Drawer geometry | 460 | 340 | `--ds-ease-settle` |
| Toast opacity | 220 | 140 | `--ds-ease-standard` |
| Settings-page opacity | 240 | - | `--ds-ease-standard` |

The long surface tail must not delay content or input: opacity has its own
shorter clock. Only the dialog entrance uses the sampled overshooting curve;
chevrons, switches, exits and layout interpolation are monotonic.

The popup's existing 240 ms symmetric skeleton crossfade is deliberately
retained. It is a data handoff, not a surface entrance. Its user-tuned selection
indicator also retains a 100 ms translation and 80 ms fade with
`cubic-bezier(0.22, 1, 0.36, 1)` for both pointer and keyboard input.
Spinners, progress signals and drag tracking retain their own functional clocks.

## Ownership and interruption

- Base UI owns overlay/disclosure presence and focus. CSS transitions handle
  starting and ending styles, including reversal. Never add a parallel
  timeout-based presence system.
- `src/shared/motion-spring.ts` owns interactive spring integration. Both the
  Options selection and the reasoning slider use it. Integration steps are
  at most 1/240 second, and a suspended frame is capped at 1/30 second.
- The sidebar's controller survives React section changes. Retarget the force,
  not the current position or velocity. Its main spring marks the active parent;
  a separate 300 ms indicator moves inside the selected sublist. Resize/scroll
  do not replay entry. Navigation rows keep their actual layout and hit areas.
- Submenus belong to the active route: they open on parent activation and close
  when leaving the group. Parent and selected child stay marked together.
  Re-entering a group restores its last child. Hover does not open a group.
- Native text-colour hover affects one label only. It never uses transparent
  text, a shared light map, a row fill, or a pointer animation loop.
- Selection uses a translucent neutral fill with a half-pixel top rim and a
  small shadow, matching Magpie's relief. There is no leading vertical marker
  and no text/backdrop blur. Reduced transparency gets an opaque fallback.
- Selection, a saved value and a completed action commit independently of the
  visual settling tail. No content is held back to finish an animation.

## Accessibility and frequency

`ThemeProvider` installs the shared input/visibility policy, including portals.
Keyboard input removes interpolation and delay, not the final transform that
encodes switch position or drawer state. Busy indicators are not accelerated
to a 1 ms loop. The popup selection indicator explicitly opts out with
`data-motion-keyboard="preserve"` on that element only; this never exempts it
from reduced motion, which snaps spatial changes while retaining state.

The popup's held-arrow scroll is functional motion, not a surface animation.
Ordinary taps commit selection in the input turn and keep their 100 ms
highlight translation. Entering a hold or reversing it uses the same 100 ms
curve to travel from the current presentation to the requested edge. Later
repeats do not restart that journey. Wheel, touch, pointer down, editing, pane
changes, blur, reduced motion and unmount cancel the scroll owner.

Repeat input uses a cancellable microtask batch, not a requestAnimationFrame
queue before rendering. An input burst still coalesces, but does not spend an
extra display frame waiting to begin. A tap flushes pending accepted input;
generation checks prevent cancelled work from replaying after a pane/query
change. The row follower overlaps successive steps by one 60 Hz frame to
absorb occasional OS repeat jitter; the final tail is capped at 100 ms.

The sidebar's text hover is fine-pointer only; a touch never activates it. Closed
navigation children are inert immediately. Initial content paints settled;
stagger belongs only to opening a small navigation sublist, capped below 300 ms.

## Motion and layout continuity

Magpie's `modalHold` anchors the control being used after interaction;
`frame` separates a dialog's fixed controls from its scrolling fields.
`openModal` preserves editing focus and scroll during content refresh, and
`foldMoves` keeps the current presentation until a reversible animation finishes.
Its reader anchoring also distinguishes data relayout from intentional scrolling.

Curator applies those principles through React identity and bounded layout,
not a global mutation observer that continually scrolls the page back:

- `DialogPanel layout="workspace"` gives search/editing dialogs a stable top
  edge. `DialogHeader`, `DialogBody` and `DialogFooter` separate control chrome
  from scrollable content. Model and folder searches shrink their results
  without moving the search field or reserving a large empty result panel.
  Folder cancellation lives beside the title, not beneath changing results.
- Small confirmations keep the normal centred layout and all their consent
  safeguards. Workspace entrance/exit retains the shared motion roles; content
  updates never replay the panel entrance.
- A custom-model draft belongs to one mounted form session. Background catalog
  updates cannot key-remount the textarea, discard its edits or reset selection.
  A new session reads the latest saved values. Base UI alone restores focus.
- `useListExit` reconciles keyed rows before React commits. Removed data is
  represented by the same inert node until its CSS animations finish, not
  unmounted and reinserted after an effect. Revival cancels the old completion
  and reverses the transition in place. Query/page scope changes, keyboard
  actions and reduced motion replace rows immediately.
- List rendering stays mounted through the last row's exit before showing an
  empty state. Only data removal animates; live values and filtering do not.
- Options resets scroll once before paint when the route actually changes.
  Re-selecting the same route does not reset the reader. An explicit provider
  anchor has one cancelable scroll request, not several competing callbacks.
- Folder keyboard navigation focuses synchronously and scrolls only its result
  region. Deferred focus tasks cannot jump the page or steal later input.

## Popup repeat scrolling

The local Magpie 0.1.2411 reference has frame-scaled drag autoscroll
(`dragRows`), cached measurements during movement, and scroll ownership that
ends when the reader takes over. Its model picker still rebuilds a list and
uses nearest scrolling; no dedicated held-key virtual-list engine was found
in the inspected frontend. Curator adapts the ownership principles, not that
picker rendering strategy.

- `PopupContentHost` alone reveals the selection. Virtualization never writes
  `scrollTop`; it mounts a distant target before the host reveals it. Native
  scroll anchoring is disabled in both panes so spacer changes are not
  compensated a second time by the browser.
- A buffered virtual window advances in groups, not on every row boundary.
  A viewport-sized overscan keeps the entire edge-to-edge journey painted.
  Only viewport/font-size changes remeasure the row pitch. Bookmark identity,
  not a modulo slot, owns DOM, focus, menus and reorder capture.
- Selection publishes only the changed indices, reusing the catalog and row
  models. It does not rescan or rebuild thousands of records. Background search
  indexing yields to input.
- `popup-navigation-view-store.ts` separates presentation from navigation.
  The content tree is memoized; row selectors change only for the previous and
  next active row, and virtual-window snapshots change only at a buffer boundary.
  React still owns every row's selection attributes, menu state and focus.
- The highlight's `transform` retains the original selection curve. A separate
  `translate` tracks scroll displacement from cached geometry, without
  restarting that curve or reconciling React on every scroll frame. Changing
  scroll modes preserves that coordinate basis, not just the target position.
- Native scroll events and the sole programmatic writer keep both scroll
  position caches current. Reading `scrollTop` after React changes row/action
  styles would force layout before a tap's animation can start.
- A persistent resize observer reuses the measured sizes. Selecting another
  row does not force a second layout read from the observer's initial delivery.
  A real viewport resize repeats the pending keyboard reveal using fresh
  geometry, so an interrupted disclosure cannot hide the selected row.
- Held navigation docks at the directional edge with an 8 px inset, unless
  clamped by the beginning/end of the list. A bounded row layer moves on the
  compositor; native scroll rebases within half a viewport or one scrollbar
  pixel, whichever is smaller, and flushes on release/takeover. This avoids
  forcing layout on every repeated key without visibly jumping the thumb.
  Docking uses `translate` and subsequent row advances use `transform`, with
  independent clocks. Cadence follows the incoming repeat interval, not a new
  ease-out on every row. There is no application per-frame scroll loop.
- Reversal and cancellation preserve both current offsets. Reduced motion
  commits the same selection and edge destination without spatial animation.

Deliberately not copied: holding loaded content for a decorative loading bird,
global click-driven scroll locks, or tiny-origin dialog scaling that compromises
text. None is needed to establish these ownership and geometry invariants.

## Checks

- `npm run typecheck`
- `npm test` includes spring retarget/frame-rate checks and structural motion
  and layout contracts.
- `npm run test:sidebar-motion-browser -- --space <ego-space-id>` builds once,
  then checks the real Options shell in an isolated Ego fixture at
  1440 / 768 / 390 px.
- After a build, `node src/ui/motion/motion-coverage.test.mjs --space <id>`
  checks production CSS with shared controls and overlays.
- `npm run test:layout-stability-browser -- --space <id>` exercises loading,
  pending, error, long-error, success, selection and keyboard paths.
- `npm run test:interaction-continuity-browser -- --space <id>` covers result
  filtering, catalog refresh, editor identity/selection, focus return, scrolling,
  short viewports, interrupted exits, reduced motion and same-route navigation.
- `npm run test:popup-repeat-browser -- --space <id>` checks 10,000-row bookmark
  and folder panes using the real startup/controller, in Ego at popup and
  narrow side-panel sizes. `--page p2` reuses another managed page;
  `--duration 30000` extends each hold to 30 seconds. Tests assert intermediate
  positions, immediate tap selection, interrupted/reversed docking, mounted
  viewport coverage, wheel takeover, reduced motion and activation identity.
  Timing reports include input counts, React commits, worst frames and long
  tasks. Main-thread rAF gaps are diagnostic samples, not proof of compositor
  presentation or a promise of zero dropped frames on every machine. Short
  motion checks capture every frame to avoid Ego/Chromium's occluded-window
  1 Hz throttling; long throughput runs use a lighter capture.

Read the Ego skill before browser checks. Never run a build concurrently with
another build or a check consuming `dist/`. Fixtures stub Chrome I/O and never
touch user bookmarks, tabs, credentials or extension storage.

## Frame-budget acceptance

`npm run test:popup-frames-browser -- --space <id> --require-zero` uses native
CDP key repeats generated outside the renderer, and records Chromium
`BeginFrame`, `DrawFrame` and `DroppedFrame` events for the owned renderer only.
It does not add a per-frame JavaScript sampler. Partial updates count as
failures even if Chrome also drew a fallback frame. An inactive/1 Hz renderer
cannot pass by producing no frames.

The opaque, self-contained fixture excludes ordinary third-party content
scripts, like an extension document does. Its local JS/CSS/images are embedded;
no browser extensions, permissions, CORS protections or user storage are changed.
Use `--isolated` with the ordinary popup regression command for the same setup.

A CSS-only moving-strip control runs before the app scenarios. Zero-drop
acceptance requires a visible foreground surface and zero dropped frames in
both the control and the app. `--capture` is available for background diagnosis,
but screenshot readback changes compositor reporting and cannot certify zero
display drops. Reports preserve failed/partial frames rather than hiding them
behind an average or a percentile. Input-cadence tests separately guard against
stationary scroll frames at 60/120/165 Hz when a repeat arrives 16 ms late.
