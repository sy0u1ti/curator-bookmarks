import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = join(repoRoot, 'tmp', 'ui-audit');
const cssFiles = [
  'src/shared/ui-refresh.css',
  'src/popup/popup.css',
  'src/options/options.css',
  'src/newtab/newtab.css',
  'src/newtab/newtab-deferred.css',
];
const htmlFiles = ['src/popup/popup.html', 'src/options/options.html', 'src/newtab/newtab.html'];
const failures = [];

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function listFiles(relativeDir, predicate = () => true) {
  const root = join(repoRoot, relativeDir);
  const results = [];

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = join(currentDir, entry.name);
      const relativePath = absolutePath.slice(repoRoot.length + 1).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
          walk(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && predicate(relativePath)) {
        results.push(relativePath);
      }
    }
  }

  walk(root);
  return results.sort();
}

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function runCommand(command, args, label) {
  console.log(`\n> ${label}`);
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function checkWhitespace() {
  for (const file of cssFiles) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) {
        fail(`${file}:${index + 1} has trailing whitespace`);
      }
    });
  }
}

function checkSharedTokensAndPrimitives() {
  const css = read('src/shared/ui-refresh.css');
  const requiredSnippets = [
    '--ui-bg-main: #0f0f0f;',
    '--ui-bg-page: #0b0b0c;',
    '--ui-surface: #151516;',
    '--ui-surface-raised: #1a1b1d;',
    '--ui-surface-elevated: #202124;',
    '--ui-surface-hover: #242529;',
    '--ui-surface-pressed: #2a2c30;',
    '--ui-surface-selected: #1b251d;',
    '--ui-motion-fast: 140ms;',
    '--ui-motion-standard: 200ms;',
    '--ui-motion-surface: 280ms;',
    '.ui-text-button',
    '.ui-primary-button',
    '.ui-icon-button',
    '.ui-search-field',
    '.ui-input-field',
    '.ui-switch',
    '.ui-status-pill',
    '.ui-menu-item',
    '@media (prefers-reduced-motion: reduce)',
  ];

  for (const snippet of requiredSnippets) {
    assert(css.includes(snippet), `shared UI token/primitive missing: ${snippet}`);
  }
}

function checkFinalLayers() {
  const finalLayers = [
    ['src/popup/popup.css', 'Production polish closure: tokenized palette'],
    ['src/options/options.css', 'Production polish closure: options and dashboard'],
    ['src/newtab/newtab.css', 'Production polish closure: main NewTab controls'],
    ['src/newtab/newtab-deferred.css', 'Production polish closure: NewTab settings drawer'],
  ];

  for (const [file, marker] of finalLayers) {
    const css = read(file);
    const markerIndex = css.lastIndexOf(marker);
    assert(markerIndex >= 0, `${file} is missing final polish layer marker`);
    if (markerIndex >= 0) {
      const finalCss = css.slice(markerIndex);
      let finalCssForRadiusAudit = finalCss;
      if (file === 'src/options/options.css') {
        finalCssForRadiusAudit = finalCssForRadiusAudit.replace(/\.options-panel:not\(\.dashboard-panel\)\s*\{[^}]*\}/gs, '');
      }
      if (file === 'src/newtab/newtab-deferred.css') {
        finalCssForRadiusAudit = finalCssForRadiusAudit.replace(/\.settings-card\s*\{[^}]*\}/gs, '');
        finalCssForRadiusAudit = finalCssForRadiusAudit.replace(
          /\.settings-drawer\s+\.folder-candidates-panel,\s*\.settings-drawer\s+\.reveal-panel-body,\s*\.settings-drawer\s+\.folder-candidate-list\s*\{[^}]*\}/gs,
          '',
        );
      }
      assert(
        !/border-radius:\s*0(?:[;\s]|$)/.test(finalCssForRadiusAudit),
        `${file} final polish layer reintroduces a square border radius`,
      );
      assert(
        /display:\s*inline-flex/.test(finalCss) &&
          /align-items:\s*center/.test(finalCss) &&
          /justify-content:\s*center/.test(finalCss),
        `${file} final polish layer does not normalize inline control alignment`,
      );
      if (file === 'src/options/options.css') {
        assert(
          /\.options-panel:not\(\.dashboard-panel\)\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;/s.test(finalCss),
          `${file} final polish layer must keep page panels unframed`,
        );
        assert(
          !/\.options-shell\s+:where\([^)]*\.options-panel/s.test(finalCss),
          `${file} final polish layer must not include .options-panel in shared card rounding`,
        );
        assert(
          /\.options-modal\s+\.scope-folder-card\s*\{[^}]*display:\s*grid;[^}]*align-items:\s*start;[^}]*justify-content:\s*stretch;[^}]*text-align:\s*left;/s.test(finalCss) &&
            /\.options-modal\s+\.scope-folder-head\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*22px\s+minmax\(0,\s*1fr\);/s.test(finalCss),
          `${file} final polish layer must keep scope folder cards left-aligned and clear of their borders`,
        );
      }
      assert(
        /prefers-reduced-motion:\s*reduce/.test(finalCss) && /transform:\s*none\s*!important/.test(finalCss),
        `${file} final polish layer does not preserve reduced-motion transform removal`,
      );
    }
  }
}

function checkProtectedEntryPoints() {
  const popup = read('src/popup/popup.html');
  const options = read('src/options/options.html');
  const newtab = read('src/newtab/newtab.html');
  const popupMain = read('src/popup/main.tsx');
  const optionsMain = read('src/options/main.tsx');
  const newtabMain = read('src/newtab/main.tsx');
  const popupApp = read('src/popup/PopupApp.tsx');
  const optionsApp = read('src/options/OptionsApp.tsx');
  const optionsCorePanels = read('src/options/components/CorePanels.tsx');
  const optionsModals = read('src/options/components/OptionsModals.tsx');
  const newtabApp = read('src/newtab/NewtabApp.tsx');
  const required = [
    [popup, 'id="popup-root"', 'popup React root'],
    [popup, 'src="./main.tsx"', 'popup React entry script'],
    [popupMain, "document.getElementById('popup-root')", 'popup main mounts the React root'],
    [popupMain, 'createRoot(root).render(<PopupApp />)', 'popup main renders PopupApp'],
    [popupApp, 'id="search-input"', 'popup search input'],
    [popupApp, 'id="folder-filter-trigger"', 'popup folder filter trigger'],
    [popupApp, 'id="smart-classifier"', 'popup smart classifier entry'],
    [popupApp, 'id="edit-modal"', 'popup edit modal'],
    [popupApp, 'id="move-modal"', 'popup move modal'],
    [popupApp, 'id="delete-modal"', 'popup delete modal'],
    [options, 'id="options-root"', 'options React root'],
    [options, 'src="./main.tsx"', 'options React entry script'],
    [optionsMain, "document.getElementById('options-root')", 'options main mounts the React root'],
    [optionsMain, 'createRoot(root).render(<OptionsApp />)', 'options main renders OptionsApp'],
    [optionsApp, 'data-section-link="dashboard"', 'options dashboard entry'],
    [optionsCorePanels, 'id="ai-model-picker-trigger"', 'options AI model picker'],
    [optionsModals, 'id="delete-modal-backdrop"', 'options destructive confirmation modal'],
    [newtab, 'id="newtab-react-root"', 'NewTab React root'],
    [newtab, 'src="./main.tsx"', 'NewTab React entry script'],
    [newtab, 'id="instant-wallpaper-startup-style"', 'NewTab instant wallpaper startup style'],
    [newtab, 'src="/instant-wallpaper-boot.js"', 'NewTab instant wallpaper boot script'],
    [newtabMain, "document.getElementById('newtab-react-root')", 'NewTab main mounts the React root'],
    [newtabMain, 'createRoot(root).render(<NewtabApp />)', 'NewTab main renders NewtabApp'],
    [newtabApp, 'id="newtab-settings-trigger"', 'NewTab settings trigger'],
    [newtabApp, 'id="newtab-dashboard-trigger"', 'NewTab dashboard trigger'],
    [newtabApp, 'id="newtab-root"', 'NewTab runtime root'],
  ];

  for (const [source, needle, label] of required) {
    assert(source.includes(needle), `protected entry point missing: ${label}`);
  }
}

function checkDocumentationEvidence() {
  const docs = read('docs/ui-refactor-library-selection.md');
  const packageJson = JSON.parse(read('package.json'));
  const requiredPackages = [
    'react',
    'react-dom',
    '@vitejs/plugin-react',
    'tailwindcss',
    '@tailwindcss/vite',
    '@base-ui/react',
    'motion',
    'lucide-react',
    'ai-elements',
  ];
  const requiredDocSnippets = [
    '## Documentation Gate',
    '## Installed Packages',
    '## Base UI',
    '## motion',
    '## lucide-react',
    '## Tailwind',
    '## AI Elements',
    '## Verification Gates',
    'Base UI quick start',
    'Motion React docs',
    'Lucide React docs',
    'Tailwind Vite docs',
    'AI Elements setup docs',
    'Fallback wrappers',
    'dialog, drawer, menu, popover, and list variants',
    'npm run smoke:extension',
  ];

  for (const packageName of requiredPackages) {
    const installedVersion =
      packageJson.dependencies?.[packageName] ?? packageJson.devDependencies?.[packageName];
    assert(Boolean(installedVersion), `required migration package is not installed: ${packageName}`);
    assert(docs.includes(`- \`${packageName}\``), `library-selection doc is missing package entry: ${packageName}`);
  }

  for (const snippet of requiredDocSnippets) {
    assert(docs.includes(snippet), `library-selection doc is missing required evidence: ${snippet}`);
  }
}

function checkMotionWrapperCoverage() {
  const transitions = read('src/ui/motion/transitions.ts');
  const motionPanel = read('src/ui/motion/MotionPanel.tsx');
  const dialog = read('src/ui/primitives/Dialog.tsx');
  const drawer = read('src/ui/primitives/Drawer.tsx');
  const menu = read('src/ui/primitives/Menu.tsx');
  const popover = read('src/ui/primitives/Popover.tsx');
  const requiredVariants = ['dialog', 'drawer', 'menu', 'popover', 'list'];

  for (const variant of requiredVariants) {
    assert(
      new RegExp(`${variant}:\\s*\\{`).test(transitions),
      `motion transition variant is missing: ${variant}`,
    );
  }

  assert(
    /useReducedMotion\(\)/.test(motionPanel) && /duration:\s*0\.01/.test(motionPanel),
    'MotionPanel must preserve a reduced-motion fallback',
  );

  for (const [file, contents, variant] of [
    ['src/ui/primitives/Dialog.tsx', dialog, 'dialog'],
    ['src/ui/primitives/Drawer.tsx', drawer, 'drawer'],
    ['src/ui/primitives/Menu.tsx', menu, 'menu'],
    ['src/ui/primitives/Popover.tsx', popover, 'popover'],
  ]) {
    assert(
      contents.includes(`MotionPanel`) && contents.includes(`variant="${variant}"`),
      `${file} must compose Base UI with the shared MotionPanel ${variant} variant`,
    );
  }
}

function checkReactMigrationArchitecture() {
  const removedLegacyFiles = [
    'src/popup/popup.ts',
    'src/options/options.ts',
    'src/newtab/newtab.ts',
    'src/options/shared-options/html.ts',
    'src/popup/render-cache.ts',
    'src/shared/custom-select.ts',
    'src/shared/dot-matrix-loader.ts',
    'src/newtab/dashboard-overlay-template.ts',
    'src/newtab/featured-modal-template.ts',
    'src/newtab/settings-drawer-template.ts',
  ];

  for (const file of removedLegacyFiles) {
    assert(!existsSync(join(repoRoot, file)), `legacy UI file must stay removed: ${file}`);
  }

  const sourceFiles = listFiles('src', (file) => /\.(?:ts|tsx|html)$/.test(file));
  const uiBoundaryImportPattern =
    /(?:from\s+['"](?:@base-ui\/react|@base-ui\/react\/[^'"]+|motion|motion\/react|lucide-react|ai-elements)['"]|import\(\s*['"](?:@base-ui\/react|@base-ui\/react\/[^'"]+|motion|motion\/react|lucide-react|ai-elements)['"]\s*\))/;

  for (const file of sourceFiles) {
    if (file.startsWith('src/ui/')) {
      continue;
    }
    assert(
      !uiBoundaryImportPattern.test(read(file)),
      `feature/domain file imports UI library directly instead of src/ui wrapper: ${file}`,
    );
  }

  const serviceWorkerAndSharedFiles = sourceFiles.filter(
    (file) => file.startsWith('src/service-worker/') || file.startsWith('src/shared/'),
  );
  const pureModuleUiImportPattern =
    /(?:from\s+['"](?:react|react-dom|react-dom\/client|@base-ui\/react|@base-ui\/react\/[^'"]+|motion|motion\/react|lucide-react|ai-elements)['"]|import\(\s*['"](?:react|react-dom|react-dom\/client|@base-ui\/react|@base-ui\/react\/[^'"]+|motion|motion\/react|lucide-react|ai-elements)['"]\s*\))/;
  for (const file of serviceWorkerAndSharedFiles) {
    assert(
      !pureModuleUiImportPattern.test(read(file)),
      `pure extension/domain module must not import React or UI libraries: ${file}`,
    );
  }

  const featureTsxFiles = sourceFiles.filter(
    (file) =>
      file.endsWith('.tsx') &&
      !file.startsWith('src/ui/') &&
      (file.startsWith('src/popup/') || file.startsWith('src/options/') || file.startsWith('src/newtab/')),
  );
  const forbiddenFeatureJsxPattern =
    /<\s*(?:svg|path|select|option|dialog)\b|<\s*input\b[^>]*\btype=["'](?:checkbox|radio)["']|dangerouslySetInnerHTML/;
  for (const file of featureTsxFiles) {
    assert(
      !forbiddenFeatureJsxPattern.test(read(file)),
      `feature TSX must use src/ui wrappers instead of raw primitive markup: ${file}`,
    );
  }

  const runtimeTsFiles = sourceFiles.filter(
    (file) =>
      file.endsWith('.ts') &&
      (file.startsWith('src/popup/') || file.startsWith('src/options/') || file.startsWith('src/newtab/')),
  );
  const staticUiMarkupPattern =
    /(?:['"`]\s*<|<\\\/?)(?:button|input|select|option|textarea|section|article|details|summary|label|ul|li|dialog)\b/;
  for (const file of runtimeTsFiles) {
    assert(
      !staticUiMarkupPattern.test(read(file)),
      `runtime TypeScript must not reintroduce static UI HTML templates: ${file}`,
    );
  }

  const popupHtml = read('src/popup/popup.html');
  const optionsHtml = read('src/options/options.html');
  const newtabHtml = read('src/newtab/newtab.html');
  assert(/<div id="popup-root"><\/div>/.test(popupHtml), 'popup.html must expose only the popup React root');
  assert(/<div id="options-root"><\/div>/.test(optionsHtml), 'options.html must expose only the options React root');
  assert(/<div id="newtab-react-root"><\/div>/.test(newtabHtml), 'newtab.html must expose the NewTab React root');
  assert(
    !popupHtml.includes('id="search-input"') &&
      !optionsHtml.includes('data-section-link=') &&
      !newtabHtml.includes('id="newtab-root"'),
    'page HTML must not reintroduce static extension UI controls outside React roots',
  );
}

function checkFinalCleanupEvidence() {
  const sourceFiles = listFiles('src', (file) => /\.(?:ts|tsx|html)$/.test(file));
  const obsoleteNamePattern = /(?:^|\/)(?:.*legacy.*|.*template.*|.*bridge.*|custom-select|dot-matrix-loader)\.(?:ts|tsx|html)$/i;
  const obsoleteUiMarkupPattern =
    /(?:innerHTML\s*=|insertAdjacentHTML\s*\(|templateHTML|renderHTML|renderHtml|createElement\(\s*['"](?:button|select|option|dialog)['"]\s*\))/;
  const legacyCustomSelectRuntimePattern =
    /(?:data-custom-select|custom-select-native|initCustomSelect|CustomSelect|enhanceCustomSelect)/;

  for (const file of sourceFiles) {
    assert(!obsoleteNamePattern.test(file), `obsolete legacy UI implementation file remains: ${file}`);
    if (file.startsWith('src/ui/')) {
      continue;
    }
    const contents = read(file);
    assert(
      !obsoleteUiMarkupPattern.test(contents),
      `legacy static UI rendering pattern remains outside src/ui wrappers: ${file}`,
    );
    assert(
      !legacyCustomSelectRuntimePattern.test(contents),
      `legacy custom select runtime pattern remains outside src/ui wrappers: ${file}`,
    );
  }

  const featureTsxFiles = sourceFiles.filter(
    (file) =>
      file.endsWith('.tsx') &&
      !file.startsWith('src/ui/') &&
      (file.startsWith('src/popup/') || file.startsWith('src/options/') || file.startsWith('src/newtab/')),
  );
  const allowedNativeInputPattern = /<\s*input\b[^>]*\btype=["'](?:hidden|color|file)["']/g;
  const rawNativeControlPattern = /<\s*(?:button|select|option|textarea|dialog|details|summary)\b|<\s*input\b/;

  for (const file of featureTsxFiles) {
    const stripped = read(file).replace(allowedNativeInputPattern, '');
    assert(
      !rawNativeControlPattern.test(stripped),
      `feature TSX must use src/ui wrappers for native interactive primitives: ${file}`,
    );
  }
}

function checkNewTabFolderAddButtonRegression() {
  const runtime = read('src/newtab/newtab-runtime.ts');
  const css = read('src/newtab/newtab.css');
  const finalMarker = 'Production polish closure: main NewTab controls';
  const finalMarkerIndex = css.lastIndexOf(finalMarker);
  const finalCss = finalMarkerIndex >= 0 ? css.slice(finalMarkerIndex) : css;

  assert(
    /const addButton = target\.closest\('\[data-add-bookmark-folder-id\]'\)[\s\S]{0,320}event\.stopPropagation\(\)/.test(runtime),
    'NewTab folder add button click must not bubble into the global menu closer',
  );
  assert(
    /\.folder-section-add\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px;[^}]*min-height:\s*22px;[^}]*padding:\s*0;/s.test(finalCss),
    'NewTab final polish layer must keep folder add buttons as compact 22px icon buttons',
  );
}

function checkNewTabBookmarkTileRegression() {
  const css = read('src/newtab/newtab.css');
  const finalMarker = 'Production polish closure: main NewTab controls';
  const finalMarkerIndex = css.lastIndexOf(finalMarker);
  const finalCss = finalMarkerIndex >= 0 ? css.slice(finalMarkerIndex) : css;

  assert(
    /\.bookmark-tile\s*\{[^}]*--bookmark-card-bg-alpha:\s*0\.3;[^}]*--bookmark-card-border-alpha:\s*0;[^}]*border:\s*1px\s+solid\s+transparent;[^}]*background:\s*var\(--glass-card-bg\);[^}]*box-shadow:\s*var\(--glass-card-shadow\);[^}]*backdrop-filter:\s*var\(--glass-panel-filter\);/s.test(css),
    'NewTab bookmark tiles must use the same frosted glass treatment as the search/date surfaces without restoring a visible border',
  );
  assert(
    /\.bookmark-tile\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*var\(--glass-card-bg\);[^}]*box-shadow:\s*var\(--glass-card-shadow\);[^}]*backdrop-filter:\s*var\(--glass-panel-filter\);/s.test(finalCss) &&
      /\.bookmark-tile:hover,\s*\.bookmark-tile:focus-visible\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*var\(--newtab-card-hover-bg\);[^}]*box-shadow:\s*var\(--newtab-card-hover-shadow\);[^}]*backdrop-filter:\s*var\(--glass-panel-filter\);/s.test(finalCss) &&
      /\.bookmark-tile:hover,\s*\.bookmark-tile:focus-visible,\s*\.newtab-speed-dial-card:hover,\s*\.newtab-speed-dial-card:focus-visible,\s*\.newtab-quick-link:hover,\s*\.newtab-quick-link:focus-visible\s*\{[^}]*transform:\s*none;/s.test(finalCss),
    'NewTab final polish layer must keep bookmark tiles frosted with a single background-only hover treatment and transparent edge',
  );
  assert(
    /\.bookmark-tile:hover\s+\.bookmark-icon-shell,\s*\.bookmark-tile:focus-visible\s+\.bookmark-icon-shell\s*\{[^}]*border-color:\s*rgb\(var\(--bookmark-card-rgb\)\s*\/\s*0\.12\);[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.34\);/s.test(finalCss) &&
      /\.bookmark-tile:hover\s+\.bookmark-title,\s*\.bookmark-tile:focus-visible\s+\.bookmark-title\s*\{[^}]*color:\s*rgba\(245,\s*245,\s*247,\s*0\.78\);/s.test(finalCss),
    'NewTab bookmark hover must keep inner icon and title styling stable so old inner hover effects do not stack with the card hover',
  );
  assert(
    /body\.bookmark-dragging\s+\.bookmark-tile\.bookmark-drag-ghost,\s*\.bookmark-tile\.bookmark-drag-ghost,\s*\.bookmark-drag-ghost\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*var\(--glass-card-bg\);[^}]*box-shadow:\s*var\(--glass-card-shadow\);[^}]*backdrop-filter:\s*var\(--glass-panel-filter\);[^}]*opacity:\s*1;/s.test(finalCss),
    'NewTab bookmark drag ghost must keep the same frosted glass card treatment instead of becoming transparent',
  );
  assert(
    /body\.bookmark-dragging\s+\.bookmark-tile\.dragging,\s*body\.bookmark-dragging\s+\.bookmark-tile\.dragging:hover,\s*body\.bookmark-dragging\s+\.bookmark-tile\.dragging:active,\s*body\.bookmark-dragging\s+\.bookmark-tile\.dragging:focus-visible\s*\{[^}]*background:\s*var\(--glass-card-bg\);[^}]*box-shadow:\s*var\(--glass-card-shadow\);[^}]*backdrop-filter:\s*var\(--glass-panel-filter\);/s.test(finalCss),
    'NewTab source bookmark tile must remain frosted while dragging',
  );
}

function checkNewTabSearchButtonRegression() {
  const css = read('src/newtab/newtab.css');
  const finalMarker = 'Production polish closure: main NewTab controls';
  const finalMarkerIndex = css.lastIndexOf(finalMarker);
  const finalCss = finalMarkerIndex >= 0 ? css.slice(finalMarkerIndex) : css;

  assert(
    /\.newtab-search-submit\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s.test(finalCss),
    'NewTab search submit must stay transparent so only the magnifier icon is visible',
  );
  assert(
    /\.newtab-search-natural,\s*\.newtab-search-engine\s*\{[^}]*background:\s*rgba\(245,\s*245,\s*247,\s*0\.04\);/s.test(finalCss),
    'NewTab AI and search engine buttons must use a lower-opacity surface',
  );
}

function checkThemeAccentRegression() {
  const finalLayerMarkers = [
    ['src/popup/popup.css', 'Production polish closure: tokenized palette'],
    ['src/options/options.css', 'Production polish closure: options and dashboard'],
    ['src/newtab/newtab.css', 'Production polish closure: main NewTab controls'],
    ['src/newtab/newtab-deferred.css', 'Production polish closure: NewTab settings drawer'],
  ];
  const blueAccentPattern = /#(?:3b82f6|bfdbfe|93c5fd)\b|rgba?\(\s*(?:59\s*,\s*130\s*,\s*246|47\s*,\s*124\s*,\s*246|147\s*,\s*197\s*,\s*253|191\s*,\s*219\s*,\s*254)/i;

  for (const [file, marker] of finalLayerMarkers) {
    const css = read(file);
    const markerIndex = css.lastIndexOf(marker);
    assert(markerIndex >= 0, `${file} is missing final polish layer marker for theme audit`);
    if (markerIndex >= 0) {
      const finalCss = css.slice(markerIndex);
      assert(!blueAccentPattern.test(finalCss), `${file} final polish layer reintroduces the old blue accent`);
    }
  }

  const newtabSettingsCss = read('src/newtab/newtab-deferred.css');
  const finalMarker = 'Production polish closure: NewTab settings drawer';
  const finalMarkerIndex = newtabSettingsCss.lastIndexOf(finalMarker);
  const finalCss = finalMarkerIndex >= 0 ? newtabSettingsCss.slice(finalMarkerIndex) : newtabSettingsCss;
  assert(
    /\.folder-candidate-card\.selected\s+\.folder-candidate-badge\s*\{[^}]*background:\s*var\(--ui-accent-soft\);[^}]*color:\s*var\(--ui-accent-text\);/s.test(finalCss),
    'NewTab selected folder candidate badge must use the shared green accent tokens',
  );
  assert(
    /\.folder-candidates-toggle\.expanded::before[\s\S]*\.custom-select\[data-open="true"\]\s+\.custom-select-trigger-arrow::before\s*\{[^}]*color:\s*var\(--ui-accent\);/s.test(finalCss),
    'NewTab setting dropdown arrows must use the shared green accent token',
  );
}

function checkNewTabSettingsChromeRegression() {
  const css = read('src/newtab/newtab-deferred.css');
  const finalMarker = 'Production polish closure: NewTab settings drawer';
  const finalMarkerIndex = css.lastIndexOf(finalMarker);
  const finalCss = finalMarkerIndex >= 0 ? css.slice(finalMarkerIndex) : css;

  assert(
    /\.settings-card\s*\{[^}]*border:\s*0;[^}]*border-color:\s*transparent;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s.test(finalCss),
    'NewTab settings sections must not be wrapped in an outer card frame',
  );
  assert(
    /\.settings-drawer\s+\.folder-candidates-panel,\s*\.settings-drawer\s+\.reveal-panel-body,\s*\.settings-drawer\s+\.folder-candidate-list\s*\{[^}]*border:\s*0;[^}]*border-color:\s*transparent;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s.test(finalCss),
    'NewTab folder candidate list wrappers must stay transparent so the area is not a big card around small cards',
  );
  assert(
    /\.settings-group-tab\.active\s*\+\s*\.settings-group-tab[\s\S]*\.settings-group-tab\[aria-selected="true"\]\s*\+\s*\.settings-group-tab\s*\{[^}]*border-left-width:\s*1px;/s.test(finalCss),
    'NewTab settings tabs must preserve the next tab left border when the previous tab is selected',
  );
  assert(
    /\.settings-drawer\s+\.icon-reset-defaults\s*\{[^}]*justify-self:\s*center;[^}]*margin:\s*8px\s+auto\s+4px;/s.test(finalCss),
    'NewTab icon layout reset button must stay centered with breathing room below the advanced toggle',
  );
}

function runStaticAudits() {
  console.log('\n> static UI audits');
  checkWhitespace();
  checkSharedTokensAndPrimitives();
  checkFinalLayers();
  checkProtectedEntryPoints();
  checkDocumentationEvidence();
  checkMotionWrapperCoverage();
  checkReactMigrationArchitecture();
  checkFinalCleanupEvidence();
  checkNewTabFolderAddButtonRegression();
  checkNewTabBookmarkTileRegression();
  checkNewTabSearchButtonRegression();
  checkThemeAccentRegression();
  checkNewTabSettingsChromeRegression();

  if (failures.length > 0) {
    console.error('\nStatic UI audit failures:');
    for (const item of failures) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log('Static UI audits passed.');
}

function fileUrl(relativePath) {
  return pathToFileURL(join(repoRoot, relativePath)).href;
}

function buildPlaywrightSpec() {
  const sharedCss = read('src/shared/ui-refresh.css');
  const stripImports = (css) => css.replace(/^@import\s+[^;]+;\s*/gm, '');
  const cssBundle = (...files) => [sharedCss, ...files.map((file) => stripImports(read(file)))].join('\n');
  const popupCss = cssBundle('src/popup/popup.css');
  const optionsCss = cssBundle('src/options/options.css');
  const newtabCss = cssBundle('src/newtab/newtab.css');
  const newtabSettingsCss = cssBundle('src/newtab/newtab.css', 'src/newtab/newtab-deferred.css');

  return `
import { test, expect } from '@playwright/test';

const popupCss = ${JSON.stringify(popupCss)};
const optionsCss = ${JSON.stringify(optionsCss)};
const newtabCss = ${JSON.stringify(newtabCss)};
const newtabSettingsCss = ${JSON.stringify(newtabSettingsCss)};

function parseDurations(value) {
  return value.split(',').map((part) => {
    const trimmed = part.trim();
    if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed);
    if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000;
    return Number.parseFloat(trimmed) || 0;
  });
}

async function setAuditContent(page, html) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(80);
}

async function auditControls(page, scopeSelector) {
  return page.locator(scopeSelector).evaluate((scope) => {
    const failures = [];
    const controls = Array.from(scope.querySelectorAll('[data-audit-control]'));

    function radiusPixels(style) {
      return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ].map((value) => Number.parseFloat(value) || 0);
    }

    for (const element of controls) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }

      if (element.dataset.squareOk !== 'true' && radiusPixels(style).every((value) => value < 1)) {
        failures.push(element.dataset.auditName + ' has square corners');
      }

      const expectedJustify = element.dataset.auditJustify || 'center';

      if (element.dataset.auditButton === 'true') {
        if (!['flex', 'inline-flex', 'grid', 'inline-grid'].includes(style.display)) {
          failures.push(element.dataset.auditName + ' is not flex/grid centered');
        }
        if (!['center', 'normal'].includes(style.alignItems) && style.display.includes('flex')) {
          failures.push(element.dataset.auditName + ' is not vertically centered');
        }
        if (expectedJustify === 'center' && !['center', 'normal'].includes(style.justifyContent) && style.display.includes('flex')) {
          failures.push(element.dataset.auditName + ' is not horizontally centered');
        }
        if (expectedJustify === 'start' && !['flex-start', 'start', 'normal'].includes(style.justifyContent) && style.display.includes('flex')) {
          failures.push(element.dataset.auditName + ' is not start aligned');
        }
        if (element.dataset.auditCompact !== 'true' && rect.height < 26) {
          failures.push(element.dataset.auditName + ' is too short for stable text alignment');
        }
      }

      if (element.dataset.auditField === 'true') {
        if (rect.height < 32) {
          failures.push(element.dataset.auditName + ' field is too short');
        }
        if (style.backgroundColor === 'rgba(0, 0, 0, 0)') {
          failures.push(element.dataset.auditName + ' field has no surface background');
        }
      }

      if (element.dataset.auditSwitch === 'true') {
        const before = getComputedStyle(element, '::before');
        if ((Number.parseFloat(before.borderTopLeftRadius) || 0) < 1) {
          failures.push(element.dataset.auditName + ' switch thumb is square');
        }
        if ((Number.parseFloat(style.borderTopLeftRadius) || 0) < 10) {
          failures.push(element.dataset.auditName + ' switch track is not pill shaped');
        }
      }
    }

    return failures;
  });
}

async function expectPaletteBase(page, selector) {
  const color = await page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(['rgb(15, 15, 15)', 'rgb(11, 11, 12)', 'rgb(0, 0, 0)']).toContain(color);
}

async function expectHoverChange(page, selector) {
  const locator = page.locator(selector).first();
  const before = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor, style.color].join('|');
  });
  await locator.hover();
  await page.waitForTimeout(80);
  const after = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor, style.color].join('|');
  });
  expect(after).not.toBe(before);
}

async function expectReducedMotion(page, html, selector) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setAuditContent(page, html);
  const motion = await page.locator(selector).evaluate((element) => {
    function parseDurationsInPage(value) {
      return value.split(',').map((part) => {
        const trimmed = part.trim();
        if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed);
        if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000;
        return Number.parseFloat(trimmed) || 0;
      });
    }

    const style = getComputedStyle(element);
    return {
      durations: parseDurationsInPage(style.transitionDuration),
      transform: style.transform,
    };
  });
  expect(Math.max(...motion.durations)).toBeLessThanOrEqual(1.5);
  expect(motion.transform).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function expectTextClearOfControlBorders(page, selector) {
  const failures = await page.locator(selector).evaluateAll((elements) => {
    const messages = [];
    const tolerance = 1.5;

    function px(value) {
      return Number.parseFloat(value) || 0;
    }

    function textRects(element) {
      const rects = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest('svg, [aria-hidden="true"], script, style')) return NodeFilter.FILTER_REJECT;
          for (let current = parent; current && current !== element; current = current.parentElement) {
            const position = getComputedStyle(current).position;
            if (position === 'absolute' || position === 'fixed') return NodeFilter.FILTER_REJECT;
          }
          const style = getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0.5 && rect.height > 0.5) {
            rects.push({
              text: node.textContent.trim().replace(/\\s+/g, ' '),
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
            });
          }
        }
        range.detach();
      }

      return rects;
    }

    for (const element of elements) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }

      const inner = {
        top: rect.top + px(style.borderTopWidth) + tolerance,
        right: rect.right - px(style.borderRightWidth) - tolerance,
        bottom: rect.bottom - px(style.borderBottomWidth) - tolerance,
        left: rect.left + px(style.borderLeftWidth) + tolerance,
      };

      for (const textRect of textRects(element)) {
        if (
          textRect.top < inner.top ||
          textRect.right > inner.right ||
          textRect.bottom > inner.bottom ||
          textRect.left < inner.left
        ) {
          messages.push(
            (element.getAttribute('data-audit-name') || element.className || element.tagName) +
              ' text "' +
              textRect.text +
              '" collides with its border',
          );
        }
      }
    }

    return messages;
  });
  expect(failures).toEqual([]);
}

async function expectAuditControlTextClearOfBorders(page, scopeSelector) {
  await expectTextClearOfControlBorders(page, scopeSelector + ' [data-audit-control]');
}

function popupFixture() {
  return \`<!doctype html><html><head><style>\${popupCss}</style></head>
  <body>
    <main class="app-shell" data-audit-base data-audit-scope>
      <header class="hero">
        <button class="search-help-toggle" data-audit-control data-audit-button="true" data-audit-compact="true" data-audit-name="popup help">?</button>
        <button class="hero-settings-button" data-audit-control data-audit-button="true" data-audit-compact="true" data-audit-name="popup settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"></path>
            <path d="M19.4 13.4c.1-.5.1-.9.1-1.4s0-.9-.1-1.4l2-1.5-1.9-3.2-2.4 1a8.5 8.5 0 0 0-2.4-1.4L14.4 3h-4.8l-.4 2.5c-.9.3-1.7.8-2.4 1.4l-2.3-1-1.9 3.2 2 1.5c-.1.5-.1.9-.1 1.4s0 .9.1 1.4l-2 1.5 1.9 3.2 2.3-1c.7.6 1.5 1.1 2.4 1.4l.4 2.5h4.8l.4-2.5c.9-.3 1.7-.8 2.4-1.4l2.4 1 1.9-3.2-2.1-1.5Z"></path>
          </svg>
        </button>
      </header>
      <section class="filter-row">
        <button class="filter-trigger" data-audit-control data-audit-button="true" data-audit-name="popup filter"><span>Filter</span></button>
        <button class="filter-clear" data-audit-control data-audit-button="true" data-audit-name="popup filter clear">Clear</button>
      </section>
      <label class="search-shell" data-audit-control data-audit-field="true" data-audit-name="popup search">
        <span class="search-icon"></span>
        <input class="search-input" value="test">
        <button class="clear-search" data-audit-control data-audit-button="true" data-audit-name="popup clear">Clear</button>
        <button class="natural-search-toggle active" data-audit-control data-audit-button="true" data-audit-name="popup natural">AI</button>
      </label>
      <section class="content-shell">
        <article class="bookmark-card" data-audit-control data-audit-name="popup bookmark row">
          <span class="row-main">Bookmark row</span>
        </article>
      </section>
      <section class="auto-analyze-status completed" data-audit-control data-audit-name="popup smart classification">Smart classification</section>
      <button class="secondary-button primary-button" data-audit-control data-audit-button="true" data-audit-name="popup primary">Save</button>
      <button class="secondary-button" data-audit-control data-audit-button="true" data-audit-name="popup secondary">Cancel</button>
    </main>
    <div class="modal-backdrop hidden">
      <section class="modal-card" data-audit-control data-audit-name="popup modal">
        <input class="modal-input" data-audit-control data-audit-field="true" data-audit-name="popup modal input" value="Title">
        <div id="filter-folder-list" class="modal-list">
          <button class="filter-option" type="button">
            <span class="filter-option-check" aria-hidden="true"></span>
            <span class="filter-option-copy">
              <span class="filter-option-title">书签栏</span>
              <span class="filter-option-path">书签栏 > 标签页</span>
            </span>
          </button>
          <button class="filter-option selected" type="button">
            <span class="filter-option-check" aria-hidden="true"></span>
            <span class="filter-option-copy">
              <span class="filter-option-title">工具类</span>
              <span class="filter-option-path">书签栏 / 工具 / 工具类</span>
            </span>
          </button>
        </div>
        <footer class="modal-actions"><button class="danger-button" data-audit-control data-audit-button="true" data-audit-name="popup danger">Delete</button></footer>
      </section>
    </div>
  </body></html>\`;
}

function optionsFixture() {
  return \`<!doctype html><html><head><style>\${optionsCss}</style></head>
  <body>
    <div class="options-shell" data-audit-scope>
          <aside class="options-sidebar"><a class="options-nav-link active" data-audit-control data-audit-button="true" data-audit-justify="start" data-audit-name="options nav">General</a></aside>
      <main class="options-main" data-audit-base>
        <section class="options-panel" data-audit-panel>
          <div class="options-group ai-feature-settings-card">
            <div class="option-row">
              <span class="option-value" data-audit-control data-audit-name="options pill">Ready</span>
              <button class="options-button" data-audit-control data-audit-button="true" data-audit-name="options primary">Run</button>
              <button class="options-button secondary" data-audit-control data-audit-button="true" data-audit-name="options secondary">Cancel</button>
              <label class="ai-switch"><input type="checkbox" checked><span class="ai-switch-track" data-audit-control data-audit-switch="true" data-audit-name="options switch"></span></label>
              <input class="ai-provider-input" data-audit-control data-audit-field="true" data-audit-name="options input" value="model">
              <details class="ai-advanced-details" open>
                <summary class="ai-advanced-summary">Base URL 与接口选项</summary>
                <label class="ai-settings-field" for="fixture-ai-base-url">
                  <span>自定义 API 接口地址</span>
                  <input id="fixture-ai-base-url" class="ai-provider-input" value="https://api.openai.com/v1">
                </label>
              </details>
            </div>
          </div>
        </section>
        <section class="options-panel dashboard-panel">
          <h1 id="dashboard-title" class="sr-only">书签栏 <span id="dashboard-total">(340)</span></h1>
          <div class="dashboard-toolbar" data-audit-control data-audit-name="dashboard toolbar">
            <div class="dashboard-search-box">
              <label class="options-search dashboard-search">
                <span class="options-search-label">搜索书签</span>
                <span class="dashboard-query-row">
                  <button class="dashboard-help-button" type="button" data-audit-control data-audit-button="true" data-audit-name="dashboard help">?</button>
                  <span class="dashboard-search-input-field">
                    <span class="dashboard-search-icon" aria-hidden="true"></span>
                    <input class="dashboard-search-input" type="search" value="query">
                    <button class="dashboard-clear-search" data-audit-control data-audit-button="true" data-audit-name="dashboard clear">Clear</button>
                    <button class="dashboard-natural-search-toggle active" data-audit-control data-audit-button="true" data-audit-name="dashboard natural">AI</button>
                  </span>
                </span>
              </label>
            </div>
            <div class="dashboard-title-actions">
              <span id="dashboard-status" class="ai-provider-save-state muted"></span>
              <button class="options-button secondary small" type="button" data-dashboard-action="exit-dashboard" data-audit-control data-audit-button="true" data-audit-name="dashboard exit">退出</button>
            </div>
          </div>
          <aside class="dashboard-folder-sidebar">
            <button class="dashboard-folder-tree-item active" type="button">
              <span class="dashboard-folder-tree-branch" aria-hidden="true"></span>
              <span class="dashboard-folder-tree-label">书签栏</span>
              <span class="dashboard-folder-tree-count">340</span>
            </button>
          </aside>
          <div class="dashboard-results-group">
            <div class="dashboard-card-grid" style="grid-template-columns: repeat(2, minmax(280px, 1fr)); min-height: 320px; align-content: start;">
              <article class="dashboard-bookmark-card menu-open" data-dashboard-card data-audit-control data-audit-name="dashboard card">
                <div class="dashboard-card-body">Card</div>
                <div class="dashboard-card-footer">
                  <div class="dashboard-card-actions">
                    <button class="dashboard-icon-action detect-result-action" type="button" data-dashboard-copy="1" aria-label="复制链接">
                      <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="9" height="9" rx="2"></rect><path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <details class="dashboard-card-more" open>
                      <summary class="dashboard-icon-action dashboard-card-more-trigger" aria-expanded="true">More</summary>
                      <div class="dashboard-card-menu" role="menu">
                        <button class="dashboard-card-menu-item" type="button" data-dashboard-action="edit-tags" role="menuitem">
                          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 12 12 20 4 12V4h8l8 8Z"></path></svg>
                          <span>Edit tags</span>
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
              <article class="dashboard-bookmark-card dragging" aria-grabbed="true" data-audit-control data-audit-name="dashboard dragging card">Dragging</article>
            </div>
          </div>
        </section>
      </main>
    </div>
    <div id="scope-modal-backdrop" class="options-modal-backdrop hidden">
      <section class="options-modal options-modal-wide" data-audit-control data-audit-name="options modal">
        <label class="options-search">
          <span class="options-search-label">搜索文件夹</span>
          <input class="options-search-input" value="">
        </label>
        <div id="scope-folder-results" class="detect-results modal-results" role="listbox" aria-label="筛选文件夹">
          <button class="scope-folder-card current" type="button" role="option" aria-selected="true" data-scope-folder-id="">
            <div class="scope-folder-head">
              <span class="scope-folder-icon" aria-hidden="true"></span>
              <strong>全部书签</strong>
            </div>
            <span>不限制来源文件夹</span>
          </button>
          <button class="scope-folder-card" type="button" role="option" aria-selected="false" data-scope-folder-id="toolbar">
            <div class="scope-folder-head">
              <span class="scope-folder-icon" aria-hidden="true"></span>
              <strong>书签栏</strong>
            </div>
            <span>书签栏</span>
          </button>
          <button class="scope-folder-card" type="button" role="option" aria-selected="false" data-scope-folder-id="tools">
            <div class="scope-folder-head">
              <span class="scope-folder-icon" aria-hidden="true"></span>
              <strong>工具类</strong>
            </div>
            <span>书签栏 / 工具 / 工具类</span>
          </button>
        </div>
        <button class="options-button danger" data-audit-control data-audit-button="true" data-audit-name="options modal danger">Delete</button>
      </section>
    </div>
  </body></html>\`;
}

function newtabMainFixture() {
  return \`<!doctype html><html><head><style>\${newtabCss}</style></head>
  <body class="bookmark-dragging">
    <div class="newtab-shell" data-audit-scope>
      <div class="newtab-page">
        <div class="newtab-search" data-audit-control data-audit-field="true" data-audit-name="newtab search" data-audit-base>
          <input class="newtab-search-input" value="query">
          <button class="newtab-search-natural active" data-audit-control data-audit-button="true" data-audit-name="newtab natural">AI</button>
          <button class="newtab-search-engine" data-audit-control data-audit-button="true" data-audit-name="newtab engine">G</button>
          <button class="newtab-search-submit" data-audit-control data-audit-button="true" data-audit-name="newtab submit">
            <span class="newtab-search-icon" aria-hidden="true"></span>
          </button>
        </div>
        <div class="newtab-search-suggestions-panel">
          <button class="newtab-search-suggestion active" data-audit-control data-audit-button="true" data-audit-name="newtab suggestion">
            <span class="newtab-search-suggestion-mark" aria-hidden="true">S</span>
            <span class="newtab-search-suggestion-copy">
              <strong>Suggestion</strong>
              <span>书签栏 / 标签页 · example.com</span>
            </span>
          </button>
        </div>
        <section class="newtab-content">
          <section class="bookmark-folder-section" tabindex="-1">
            <div class="folder-section-header-row">
              <button class="folder-section-header" data-audit-control data-audit-button="true" data-audit-compact="true" data-audit-justify="start" data-audit-name="newtab folder header"><span class="folder-section-title">YouTube</span><span class="folder-section-count">12</span></button>
              <button class="folder-section-add" data-add-bookmark-folder-id="youtube" data-audit-control data-audit-button="true" data-audit-compact="true" data-audit-name="newtab folder add">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
              </button>
            </div>
            <nav class="bookmark-grid">
              <article class="bookmark-tile" data-audit-control data-audit-name="newtab bookmark tile">
                <span class="bookmark-icon-shell"><span class="bookmark-fallback">Y</span></span>
                <span class="bookmark-title">YouTube</span>
              </article>
              <article class="bookmark-tile dragging" data-audit-control data-audit-name="newtab dragging tile">
                <span class="bookmark-icon-shell"><span class="bookmark-fallback">D</span></span>
                <span class="bookmark-title">Dragging</span>
              </article>
              <article class="bookmark-tile bookmark-drag-ghost" data-audit-name="newtab drag ghost">
                <span class="bookmark-icon-shell"></span><span class="bookmark-title">Dragging</span>
              </article>
            </nav>
          </section>
        </section>
        <section class="newtab-speed-dial">
          <a class="newtab-speed-dial-card" data-audit-control data-audit-name="newtab speed dial">
            <span class="newtab-speed-dial-mark"><span class="bookmark-fallback">S</span></span>
            <span class="newtab-speed-dial-copy"><strong>Speed dial</strong></span>
          </a>
        </section>
      </div>
    </div>
    <div class="settings-trigger-zone"><button class="settings-trigger" data-audit-control data-audit-button="true" data-audit-name="newtab settings trigger">Settings</button></div>
    <section class="bookmark-add-menu expanded" role="dialog" aria-label="添加新标签页书签" style="left: 160px; top: 132px;">
      <label class="bookmark-menu-row"><span>标题</span><input class="bookmark-menu-input" value=""></label>
      <label class="bookmark-menu-row"><span>链接</span><input class="bookmark-menu-input" type="url" value=""></label>
      <div class="bookmark-menu-separator"></div>
      <div class="bookmark-menu-actions"><button class="bookmark-menu-action" type="button">添加书签</button></div>
    </section>
  </body></html>\`;
}

function newtabSettingsFixture() {
  return \`<!doctype html><html><head><style>\${newtabSettingsCss}</style></head>
  <body>
    <aside class="settings-drawer open" data-audit-scope data-audit-base>
      <div class="settings-drawer-scroll">
        <button class="settings-close" data-audit-control data-audit-button="true" data-audit-name="settings close">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6.5 6.5 11 11M17.5 6.5l-11 11"></path>
          </svg>
        </button>
        <header class="settings-drawer-header"></header>
        <nav class="settings-group-tabs">
          <button class="settings-group-tab active" aria-selected="true" data-audit-control data-audit-button="true" data-audit-name="settings tab source">来源</button>
          <button class="settings-group-tab" aria-selected="false" data-audit-control data-audit-button="true" data-audit-name="settings tab appearance">外观</button>
          <button class="settings-group-tab" aria-selected="false" data-audit-control data-audit-button="true" data-audit-name="settings tab search">搜索</button>
          <button class="settings-group-tab" aria-selected="false" data-audit-control data-audit-button="true" data-audit-name="settings tab modules">模块</button>
          <button class="settings-group-tab" aria-selected="false" data-audit-control data-audit-button="true" data-audit-name="settings tab advanced">高级</button>
        </nav>
        <section class="settings-card">
          <div class="setting-row">
            <input class="setting-text-input" data-audit-control data-audit-field="true" data-audit-name="settings text" value="Name">
            <label><input class="setting-switch-input" type="checkbox" checked><span class="setting-switch" data-audit-control data-audit-switch="true" data-audit-name="settings switch"></span></label>
            <button class="setting-picker-button" data-audit-control data-audit-button="true" data-audit-name="settings picker">Pick</button>
            <span class="custom-select custom-select-setting" data-custom-select="true">
              <select class="setting-select custom-select-native" aria-hidden="true" tabindex="-1">
                <option selected>Compact layout</option>
              </select>
              <span class="custom-select-trigger" role="combobox" tabindex="0" data-audit-control data-audit-button="true" data-audit-justify="start" data-audit-name="settings custom select">
                <span class="custom-select-trigger-label">Compact layout</span>
                <span class="custom-select-trigger-arrow" aria-hidden="true"></span>
              </span>
            </span>
          </div>
        </section>
        <section class="settings-card">
          <div class="folder-source-panel">
            <button class="folder-candidates-toggle expanded" data-audit-control data-audit-button="true" data-audit-name="settings folder candidates toggle">
              <span data-folder-toggle-label>收起候选文件夹</span>
            </button>
            <div class="folder-candidates-panel is-expanded">
              <div class="reveal-panel-body">
                <label class="setting-floating-field folder-search-field">
                  <input class="setting-text-input" type="search" placeholder="搜索文件夹">
                </label>
                <div class="folder-candidate-list" role="listbox">
                  <button class="folder-candidate-card selected" type="button" data-audit-name="settings folder candidate selected">
                    <span class="folder-candidate-copy">
                      <strong>标签页</strong>
                      <span>书签栏 / 标签页</span>
                      <span>直属 13 / 合计 13</span>
                    </span>
                    <span class="folder-candidate-badge">已选</span>
                  </button>
                  <button class="folder-candidate-card" type="button" data-audit-name="settings folder candidate count">
                    <span class="folder-candidate-copy">
                      <strong>市场</strong>
                      <span>书签栏 / 市场</span>
                      <span>直属 89 / 合计 89</span>
                    </span>
                    <span class="folder-candidate-badge">89</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section class="settings-card">
          <button class="icon-advanced-toggle expanded" data-audit-control data-audit-button="true" data-audit-name="settings icon advanced toggle">
            <span>卡片细节</span>
          </button>
          <div class="icon-advanced-panel is-expanded">
            <div class="reveal-panel-body">
              <button class="icon-reset-defaults" type="button" data-audit-control data-audit-button="true" data-audit-name="settings icon reset">恢复默认布局</button>
              <label class="setting-row slider-row">
                <span>页面宽度 <output class="setting-value">78%</output></span>
                <input class="setting-range" type="range" min="16" max="100" value="78" aria-label="书签卡片页面宽度">
              </label>
            </div>
          </div>
        </section>
      </div>
    </aside>
    <section class="featured-wallpaper-modal open">
      <div class="featured-wallpaper-panel">
        <header class="featured-wallpaper-head">
          <div>
            <p class="featured-wallpaper-kicker">Featured Gallery</p>
            <h3>选择精选图库壁纸</h3>
          </div>
          <div class="featured-wallpaper-actions">
            <button class="featured-wallpaper-action" data-audit-control data-audit-button="true" data-audit-name="featured action">Apply</button>
          </div>
        </header>
        <div class="featured-wallpaper-grid">
          <article class="featured-wallpaper-card is-selected" data-audit-control data-audit-name="featured card">
            <span class="featured-wallpaper-preview">
              <span class="featured-wallpaper-resolution" data-audit-control data-audit-name="featured resolution">1920 x 1080</span>
            </span>
          </article>
        </div>
      </div>
    </section>
  </body></html>\`;
}

test('popup audit: radius, alignment, hover, palette, reduced motion', async ({ page }) => {
  const html = popupFixture();
  await setAuditContent(page, html);
  await expectPaletteBase(page, '[data-audit-base]');
  expect(await auditControls(page, '[data-audit-scope]')).toEqual([]);
  await expectAuditControlTextClearOfBorders(page, '[data-audit-scope]');
  await expectHoverChange(page, '.clear-search');
  await page.locator('.modal-backdrop').evaluate((backdrop) => backdrop.classList.remove('hidden'));
  const folderFilterAlignment = await page.locator('#filter-folder-list .filter-option').first().evaluate((option) => {
    const check = option.querySelector('.filter-option-check');
    const copy = option.querySelector('.filter-option-copy');
    const title = option.querySelector('.filter-option-title');
    const path = option.querySelector('.filter-option-path');
    const optionStyle = getComputedStyle(option);
    const copyStyle = getComputedStyle(copy);
    const checkRect = check.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const pathRect = path.getBoundingClientRect();
    return {
      optionDisplay: optionStyle.display,
      optionAlignItems: optionStyle.alignItems,
      optionJustifyContent: optionStyle.justifyContent,
      optionTextAlign: optionStyle.textAlign,
      checkGridColumnStart: getComputedStyle(check).gridColumnStart,
      copyAlignItems: copyStyle.alignItems,
      copyDisplay: copyStyle.display,
      copyGridColumnStart: copyStyle.gridColumnStart,
      copyTextAlign: copyStyle.textAlign,
      checkIsLeftOfCopy: checkRect.right <= copyRect.left,
      titleAbovePath: titleRect.bottom <= pathRect.top + 0.5,
      titleInsideOption: titleRect.left >= optionRect.left && titleRect.right <= optionRect.right,
      pathInsideOption: pathRect.left >= optionRect.left && pathRect.right <= optionRect.right && pathRect.bottom <= optionRect.bottom,
      titleTextAlign: getComputedStyle(title).textAlign,
      pathTextAlign: getComputedStyle(path).textAlign,
    };
  });
  expect(folderFilterAlignment).toEqual(expect.objectContaining({
    optionDisplay: 'grid',
    optionAlignItems: 'flex-start',
    optionJustifyContent: 'stretch',
    optionTextAlign: 'left',
    checkGridColumnStart: '1',
    copyAlignItems: 'start',
    copyDisplay: 'grid',
    copyGridColumnStart: '2',
    copyTextAlign: 'left',
    checkIsLeftOfCopy: true,
    titleAbovePath: true,
    titleInsideOption: true,
    pathInsideOption: true,
    titleTextAlign: 'left',
    pathTextAlign: 'left',
  }));
  await expectTextClearOfControlBorders(page, [
    '#filter-folder-list .filter-option',
    '.modal-input',
    '.filter-trigger',
    '.filter-clear',
    '.clear-search',
    '.natural-search-toggle',
    '.secondary-button',
    '.danger-button',
  ].join(', '));
  await page.locator('.modal-backdrop').evaluate((backdrop) => backdrop.classList.add('hidden'));
  await page.locator('.bookmark-card').hover();
  const popupBookmarkHover = await page.locator('.bookmark-card').evaluate((card) => {
    const style = getComputedStyle(card);
    return {
      boxShadow: style.boxShadow,
      transform: style.transform,
    };
  });
  expect(popupBookmarkHover).toEqual({
    boxShadow: 'none',
    transform: 'none',
  });
  await expectReducedMotion(page, html, '.clear-search');
});

test('options and dashboard audit: controls, drag hierarchy, hover, reduced motion', async ({ page }) => {
  const html = optionsFixture();
  await setAuditContent(page, html);
  await expectPaletteBase(page, '[data-audit-base]');
  const panelChrome = await page.locator('[data-audit-panel]').evaluate((element) => {
    const panelStyle = getComputedStyle(element);
    const groupStyle = getComputedStyle(element.querySelector('.options-group'));
    return {
      panelBackground: panelStyle.backgroundColor,
      panelBorder: panelStyle.borderTopWidth,
      panelRadius: panelStyle.borderTopLeftRadius,
      groupBackground: groupStyle.backgroundColor,
      groupBorder: groupStyle.borderTopWidth,
    };
  });
  expect(panelChrome).toEqual({
    panelBackground: 'rgba(0, 0, 0, 0)',
    panelBorder: '0px',
    panelRadius: '0px',
    groupBackground: 'rgb(21, 21, 22)',
    groupBorder: '1px',
  });
  expect(await auditControls(page, '[data-audit-scope]')).toEqual([]);
  await expectAuditControlTextClearOfBorders(page, '[data-audit-scope]');
  await expectHoverChange(page, '.options-button.secondary');
  await page.locator('.ai-advanced-summary').hover();
  const advancedSummaryHover = await page.locator('.ai-advanced-summary').evaluate((summary) => {
    const style = getComputedStyle(summary);
    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
    };
  });
  expect(advancedSummaryHover).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    boxShadow: 'none',
    outlineStyle: 'none',
  });
  const optionsInputFocus = await page.locator('#fixture-ai-base-url').evaluate((input) => {
    input.focus();
    const style = getComputedStyle(input);
    const fieldBefore = getComputedStyle(input.closest('.ai-settings-field'), '::before');
    const fieldAfter = getComputedStyle(input.closest('.ai-settings-field'), '::after');
    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineOffset: style.outlineOffset,
      fieldBeforeContent: fieldBefore.content,
      fieldAfterContent: fieldAfter.content,
    };
  });
  expect(optionsInputFocus).toEqual(expect.objectContaining({
    backgroundColor: 'rgb(26, 27, 29)',
    boxShadow: 'none',
    outlineStyle: 'solid',
    outlineOffset: '2px',
    fieldBeforeContent: 'none',
    fieldAfterContent: 'none',
  }));
  await page.locator('#scope-modal-backdrop').evaluate((backdrop) => backdrop.classList.remove('hidden'));
  await expectAuditControlTextClearOfBorders(page, '#scope-modal-backdrop');
  const scopeFolderLayout = await page.locator('#scope-folder-results .scope-folder-card').first().evaluate((card) => {
    const head = card.querySelector('.scope-folder-head');
    const title = card.querySelector('.scope-folder-head strong');
    const path = card.querySelector(':scope > span:last-child');
    const cardStyle = getComputedStyle(card);
    const headStyle = getComputedStyle(head);
    const titleRect = title.getBoundingClientRect();
    const pathRect = path.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      display: cardStyle.display,
      alignItems: cardStyle.alignItems,
      justifyContent: cardStyle.justifyContent,
      textAlign: cardStyle.textAlign,
      headDisplay: headStyle.display,
      headGridColumns: headStyle.gridTemplateColumns,
      titleTextAlign: getComputedStyle(title).textAlign,
      pathTextAlign: getComputedStyle(path).textAlign,
      titleInsideCard: titleRect.left >= cardRect.left && titleRect.right <= cardRect.right && titleRect.top >= cardRect.top && titleRect.bottom <= cardRect.bottom,
      pathInsideCard: pathRect.left >= cardRect.left && pathRect.right <= cardRect.right && pathRect.top >= cardRect.top && pathRect.bottom <= cardRect.bottom,
      pathBelowTitle: pathRect.top >= titleRect.bottom - 0.5,
    };
  });
  expect(scopeFolderLayout).toEqual(expect.objectContaining({
    display: 'grid',
    alignItems: 'start',
    justifyContent: 'stretch',
    textAlign: 'left',
    headDisplay: 'grid',
    titleTextAlign: 'left',
    pathTextAlign: 'left',
    titleInsideCard: true,
    pathInsideCard: true,
    pathBelowTitle: true,
  }));
  expect(scopeFolderLayout.headGridColumns).toContain('22px');
  await expectTextClearOfControlBorders(page, [
    '#scope-folder-results .scope-folder-card',
    '.options-modal .options-search-input',
    '.options-modal .options-button',
  ].join(', '));
  await page.locator('#scope-modal-backdrop').evaluate((backdrop) => backdrop.classList.add('hidden'));
  const dashboardTopChrome = await page.locator('.dashboard-panel').evaluate((panel) => {
    const toolbar = panel.querySelector('.dashboard-toolbar');
    const search = panel.querySelector('.dashboard-search-box');
    const exit = panel.querySelector('[data-dashboard-action="exit-dashboard"]');
    const title = panel.querySelector('#dashboard-title');
    if (!(toolbar instanceof HTMLElement) || !(search instanceof HTMLElement) || !(exit instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      return null;
    }

    const toolbarStyle = getComputedStyle(toolbar);
    const titleStyle = getComputedStyle(title);
    const toolbarRect = toolbar.getBoundingClientRect();
    const searchRect = search.getBoundingClientRect();
    const exitRect = exit.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      visibleLabelCount: panel.querySelectorAll(':scope > .options-section-label').length,
      visibleTitleRowCount: panel.querySelectorAll(':scope > .dashboard-title-row').length,
      titleIsSrOnly: titleStyle.position === 'absolute' && titleStyle.width === '1px' && titleStyle.height === '1px',
      toolbarBorderTopWidth: toolbarStyle.borderTopWidth,
      toolbarBackground: toolbarStyle.backgroundColor,
      toolbarBoxShadow: toolbarStyle.boxShadow,
      toolbarTopDelta: Math.abs(toolbarRect.top - panelRect.top),
      searchCenterDelta: Math.abs((searchRect.left + searchRect.width / 2) - (panelRect.left + panelRect.width / 2)),
      exitAlignedWithSearch: Math.abs(exitRect.top - searchRect.top),
      exitRightOfSearch: exitRect.left >= searchRect.right,
    };
  });
  expect(dashboardTopChrome).toEqual(expect.objectContaining({
    visibleLabelCount: 0,
    visibleTitleRowCount: 0,
    titleIsSrOnly: true,
    toolbarBorderTopWidth: '0px',
    toolbarBackground: 'rgba(0, 0, 0, 0)',
    toolbarBoxShadow: 'none',
    exitRightOfSearch: true,
  }));
  expect(dashboardTopChrome.toolbarTopDelta).toBeLessThanOrEqual(1);
  expect(dashboardTopChrome.searchCenterDelta).toBeLessThanOrEqual(1);
  expect(dashboardTopChrome.exitAlignedWithSearch).toBeLessThanOrEqual(1);
  await page.locator('[data-dashboard-action="edit-tags"]').scrollIntoViewIfNeeded();
  const menuHit = await page.locator('[data-dashboard-action="edit-tags"]').evaluate((item) => {
    const rect = item.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    const grid = document.querySelector('.dashboard-card-grid');
    const card = document.querySelector('.dashboard-bookmark-card.menu-open');
    return {
      action: hit?.closest?.('[data-dashboard-action]')?.getAttribute('data-dashboard-action') || '',
      gridContain: grid ? getComputedStyle(grid).contain : '',
      cardContentVisibility: card ? getComputedStyle(card).contentVisibility : '',
    };
  });
  expect(menuHit).toEqual({
    action: 'edit-tags',
    gridContain: 'layout style',
    cardContentVisibility: 'visible',
  });
  const dashboardCardChrome = await page.locator('.dashboard-bookmark-card.menu-open').evaluate(async (card) => {
    const beforeDefault = getComputedStyle(card, '::before');
    const copyButton = card.querySelector('[data-dashboard-copy]');
    const copyIcon = copyButton?.querySelector('svg');
    const menuItem = card.querySelector('.dashboard-card-menu-item');
    const menuText = menuItem?.querySelector('span');

    if (!(copyButton instanceof HTMLElement) || !(copyIcon instanceof SVGElement) || !(menuItem instanceof HTMLElement) || !(menuText instanceof HTMLElement)) {
      return null;
    }

    const copyRect = copyButton.getBoundingClientRect();
    const iconRect = copyIcon.getBoundingClientRect();
    const menuItemStyle = getComputedStyle(menuItem);
    const menuTextStyle = getComputedStyle(menuText);
    return {
      beforeDefaultBackground: beforeDefault.backgroundColor,
      beforeDefaultWidth: beforeDefault.width,
      iconCenterXDelta: Math.abs((copyRect.left + copyRect.width / 2) - (iconRect.left + iconRect.width / 2)),
      iconCenterYDelta: Math.abs((copyRect.top + copyRect.height / 2) - (iconRect.top + iconRect.height / 2)),
      menuJustifyItems: menuItemStyle.justifyItems,
      menuTextAlign: menuItemStyle.textAlign,
      menuTextLeftDelta: Math.abs(menuText.getBoundingClientRect().left - (menuItem.getBoundingClientRect().left + Number.parseFloat(menuItemStyle.paddingLeft) + 18 + Number.parseFloat(menuItemStyle.columnGap || menuItemStyle.gap || '0'))),
      menuTextSelfAlign: menuTextStyle.textAlign,
    };
  });
  expect(dashboardCardChrome).toEqual(expect.objectContaining({
    beforeDefaultBackground: 'rgba(0, 0, 0, 0)',
    beforeDefaultWidth: '0px',
    menuJustifyItems: 'start',
    menuTextAlign: 'left',
    menuTextSelfAlign: 'left',
  }));
  expect(dashboardCardChrome.iconCenterXDelta).toBeLessThanOrEqual(0.5);
  expect(dashboardCardChrome.iconCenterYDelta).toBeLessThanOrEqual(0.5);
  expect(dashboardCardChrome.menuTextLeftDelta).toBeLessThanOrEqual(1);
  await page.locator('.dashboard-bookmark-card.menu-open').hover();
  const dashboardHoverMotion = await page.locator('.dashboard-bookmark-card.menu-open').evaluate((card) => {
    const style = getComputedStyle(card);
    const before = getComputedStyle(card, '::before');
    return {
      transform: style.transform,
      beforeWidth: before.width,
      beforeBackground: before.backgroundColor,
    };
  });
  expect(dashboardHoverMotion).toEqual({
    transform: 'none',
    beforeWidth: '0px',
    beforeBackground: 'rgba(0, 0, 0, 0)',
  });
  const folderCountChrome = await page.locator('.dashboard-folder-tree-count').evaluate((count) => {
    const style = getComputedStyle(count);
    const rect = count.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      borderTopColor: style.borderTopColor,
      minWidth: style.minWidth,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      width: rect.width,
    };
  });
  expect(folderCountChrome).toEqual(expect.objectContaining({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderTopWidth: '0px',
    borderTopColor: 'rgba(0, 0, 0, 0)',
    minWidth: '0px',
    paddingLeft: '0px',
    paddingRight: '0px',
  }));
  expect(folderCountChrome.width).toBeLessThan(28);
  await expectTextClearOfControlBorders(page, [
    '.options-button',
    '.ai-provider-input',
    '.dashboard-natural-search-toggle',
    '.dashboard-clear-search',
    '.dashboard-folder-tree-item',
    '.dashboard-card-menu-item',
  ].join(', '));
  const dragShadow = await page.locator('.dashboard-bookmark-card.dragging').evaluate((element) => getComputedStyle(element).boxShadow);
  expect(dragShadow).not.toBe('none');
  await expectReducedMotion(page, html, '[data-audit-name="options secondary"]');
});

test('NewTab main audit: search, cards, bookmark drag protection, reduced motion', async ({ page }) => {
  const html = newtabMainFixture();
  await setAuditContent(page, html);
  expect(await auditControls(page, '[data-audit-scope]')).toEqual([]);
  await expectAuditControlTextClearOfBorders(page, '[data-audit-scope]');
  await expectAuditControlTextClearOfBorders(page, '.settings-trigger-zone');
  await expectHoverChange(page, '.newtab-search-submit');
  await page.evaluate(() => document.body.classList.remove('bookmark-dragging'));
  await page.mouse.move(0, 0);
  const bookmarkTileChrome = await page.locator('.bookmark-tile').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
    };
  });
  expect(bookmarkTileChrome.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(bookmarkTileChrome.borderColor).toBe('rgba(0, 0, 0, 0)');
  expect(bookmarkTileChrome.boxShadow).not.toBe('none');
  expect(bookmarkTileChrome.backdropFilter).toContain('blur');
  const newtabCardBeforeHover = await page.locator('.bookmark-tile').first().evaluate((tile) => {
    const icon = tile.querySelector('.bookmark-icon-shell');
    const title = tile.querySelector('.bookmark-title');
    const beforeTileStyle = getComputedStyle(tile);
    const beforeIconStyle = getComputedStyle(icon);
    const beforeTitleStyle = getComputedStyle(title);
    return {
      tileBackground: beforeTileStyle.backgroundColor,
      tileBoxShadow: beforeTileStyle.boxShadow,
      iconBorder: beforeIconStyle.borderTopColor,
      iconBackground: beforeIconStyle.backgroundColor,
      titleColor: beforeTitleStyle.color,
    };
  });
  await page.locator('.bookmark-tile').first().hover();
  await page.waitForTimeout(80);
  const newtabTileHover = await page.locator('.bookmark-tile').first().evaluate((tile) => {
    const icon = tile.querySelector('.bookmark-icon-shell');
    const title = tile.querySelector('.bookmark-title');
    const afterTileStyle = getComputedStyle(tile);
    const afterIconStyle = getComputedStyle(icon);
    const afterTitleStyle = getComputedStyle(title);
    return {
      tileBackground: afterTileStyle.backgroundColor,
      tileBoxShadow: afterTileStyle.boxShadow,
      tileTransform: afterTileStyle.transform,
      iconBorder: afterIconStyle.borderTopColor,
      iconBackground: afterIconStyle.backgroundColor,
      titleColor: afterTitleStyle.color,
    };
  });
  const speedDialBeforeHover = await page.locator('.newtab-speed-dial-card').evaluate((speedDial) => {
    const beforeSpeedStyle = getComputedStyle(speedDial);
    return {
      speedBackground: beforeSpeedStyle.backgroundColor,
      speedBoxShadow: beforeSpeedStyle.boxShadow,
    };
  });
  await page.locator('.newtab-speed-dial-card').hover();
  await page.waitForTimeout(80);
  const speedDialHover = await page.locator('.newtab-speed-dial-card').evaluate((speedDial) => {
    const afterSpeedStyle = getComputedStyle(speedDial);
    return {
      speedBackground: afterSpeedStyle.backgroundColor,
      speedBoxShadow: afterSpeedStyle.boxShadow,
      speedTransform: afterSpeedStyle.transform,
    };
  });
  expect(newtabTileHover).toEqual(expect.objectContaining({
    iconBorder: newtabCardBeforeHover.iconBorder,
    iconBackground: newtabCardBeforeHover.iconBackground,
    titleColor: newtabCardBeforeHover.titleColor,
  }));
  expect(newtabTileHover.tileBackground).not.toBe(newtabCardBeforeHover.tileBackground);
  expect(newtabTileHover.tileBoxShadow).toBe(newtabCardBeforeHover.tileBoxShadow);
  expect(newtabTileHover.tileTransform).toBe('none');
  expect(speedDialHover.speedBackground).not.toBe(speedDialBeforeHover.speedBackground);
  expect(speedDialHover.speedBoxShadow).toBe(speedDialBeforeHover.speedBoxShadow);
  expect(speedDialHover.speedTransform).toBe('none');
  await page.evaluate(() => document.body.classList.add('bookmark-dragging'));
  await page.locator('.bookmark-tile').first().hover();
  const transformWhileDragging = await page.locator('.bookmark-tile').first().evaluate((element) => getComputedStyle(element).transform);
  expect(transformWhileDragging).toBe('none');
  const folderAddButton = await page.locator('.folder-section-add').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: rect.width,
      height: rect.height,
      minHeight: style.minHeight,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
    };
  });
  expect(Math.abs(folderAddButton.width - folderAddButton.height)).toBeLessThanOrEqual(1);
  expect(folderAddButton).toMatchObject({
    width: 22,
    height: 22,
    minHeight: '22px',
    paddingLeft: '0px',
    paddingRight: '0px',
  });
  const addBookmarkMenuChrome = await page.locator('.bookmark-add-menu').evaluate((menu) => {
    const style = getComputedStyle(menu);
    const rect = menu.getBoundingClientRect();
    const inputs = Array.from(menu.querySelectorAll('.bookmark-menu-input'));
    return {
      position: style.position,
      zIndex: Number.parseInt(style.zIndex, 10),
      width: Math.round(rect.width),
      isInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
      hasTitleAndUrlInputs: inputs.length === 2,
      menuRowsDisplay: Array.from(menu.querySelectorAll('.bookmark-menu-row')).map((row) => getComputedStyle(row).display),
      actionDisplay: getComputedStyle(menu.querySelector('.bookmark-menu-action')).display,
      bodyNotExpandedByMenu: document.body.scrollHeight <= window.innerHeight + 1,
    };
  });
  expect(addBookmarkMenuChrome).toEqual(expect.objectContaining({
    position: 'fixed',
    width: 252,
    isInViewport: true,
    hasTitleAndUrlInputs: true,
    menuRowsDisplay: ['grid', 'grid'],
    bodyNotExpandedByMenu: true,
  }));
  expect(addBookmarkMenuChrome.zIndex).toBeGreaterThanOrEqual(80);
  expect(['flex', 'inline-flex']).toContain(addBookmarkMenuChrome.actionDisplay);
  const sourceDraggingTileChrome = await page.locator('.bookmark-tile.dragging').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
      opacity: style.opacity,
      outlineStyle: style.outlineStyle,
    };
  });
  expect(sourceDraggingTileChrome).toEqual(expect.objectContaining({
    borderColor: 'rgba(0, 0, 0, 0)',
    opacity: '1',
    outlineStyle: 'none',
  }));
  expect(sourceDraggingTileChrome.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(sourceDraggingTileChrome.boxShadow).not.toBe('none');
  expect(sourceDraggingTileChrome.backdropFilter).toContain('blur');
  const bookmarkDragGhostChrome = await page.locator('.bookmark-drag-ghost').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      boxShadow: style.boxShadow,
      backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
      opacity: style.opacity,
    };
  });
  expect(bookmarkDragGhostChrome).toEqual(expect.objectContaining({
    borderColor: 'rgba(0, 0, 0, 0)',
    opacity: '1',
  }));
  expect(bookmarkDragGhostChrome.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(bookmarkDragGhostChrome.boxShadow).not.toBe('none');
  expect(bookmarkDragGhostChrome.backdropFilter).toContain('blur');
  const focusedFolderSectionChrome = await page.locator('.bookmark-folder-section').evaluate((section) => {
    if (section instanceof HTMLElement) {
      section.focus();
    }
    const style = getComputedStyle(section);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      backgroundColor: style.backgroundColor,
    };
  });
  expect(focusedFolderSectionChrome).toEqual({
    outlineStyle: 'none',
    outlineWidth: '0px',
    boxShadow: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
  });
  const searchChrome = await page.locator('.newtab-search').evaluate((search) => {
    const submit = search.querySelector('.newtab-search-submit');
    const natural = search.querySelector('.newtab-search-natural');
    const engine = search.querySelector('.newtab-search-engine');
    const submitStyle = getComputedStyle(submit);
    const naturalStyle = getComputedStyle(natural);
    const engineStyle = getComputedStyle(engine);
    return {
      submitBackground: submitStyle.backgroundColor,
      submitBorder: submitStyle.borderTopColor,
      submitBoxShadow: submitStyle.boxShadow,
      naturalBackground: naturalStyle.backgroundColor,
      engineBackground: engineStyle.backgroundColor,
    };
  });
  expect(searchChrome).toEqual({
    submitBackground: 'rgba(0, 0, 0, 0)',
    submitBorder: 'rgba(0, 0, 0, 0)',
    submitBoxShadow: 'none',
    naturalBackground: 'rgba(163, 230, 53, 0.1)',
    engineBackground: 'rgba(245, 245, 247, 0.04)',
  });
  await expectTextClearOfControlBorders(page, [
    '.newtab-search-natural',
    '.newtab-search-engine',
    '.newtab-search-suggestion',
    '.folder-section-header',
    '.bookmark-tile:not(.dragging):not(.bookmark-drag-ghost)',
    '.bookmark-menu-row',
    '.bookmark-menu-action',
  ].join(', '));
  await expectReducedMotion(page, html, '.bookmark-tile:not(.dragging):not(.bookmark-drag-ghost)');
});

test('NewTab settings audit: drawer controls, switches, gallery modal, reduced motion', async ({ page }) => {
  const html = newtabSettingsFixture();
  await setAuditContent(page, html);
  await expectPaletteBase(page, '[data-audit-base]');
  const drawerChrome = await page.locator('.settings-drawer').evaluate((drawer) => {
    const drawerStyle = getComputedStyle(drawer);
    const scrollStyle = getComputedStyle(drawer.querySelector('.settings-drawer-scroll'));
    const tabs = drawer.querySelector('.settings-group-tabs');
    const tabsStyle = getComputedStyle(tabs);
    const tabsAfter = getComputedStyle(tabs, '::after');
    return {
      drawerOverflow: drawerStyle.overflow,
      drawerRadius: drawerStyle.borderTopLeftRadius,
      scrollBackground: scrollStyle.backgroundColor,
      tabsBackground: tabsStyle.backgroundColor,
      tabsBorder: tabsStyle.borderTopWidth,
      tabsAfterContent: tabsAfter.content,
    };
  });
  expect(drawerChrome).toEqual({
    drawerOverflow: 'hidden',
    drawerRadius: '28px',
    scrollBackground: 'rgba(0, 0, 0, 0)',
    tabsBackground: 'rgba(0, 0, 0, 0)',
    tabsBorder: '0px',
    tabsAfterContent: 'none',
  });
  expect(await auditControls(page, '[data-audit-scope]')).toEqual([]);
  await expectAuditControlTextClearOfBorders(page, '[data-audit-scope]');
  await expectAuditControlTextClearOfBorders(page, '.featured-wallpaper-modal');
  const settingsSectionChrome = await page.locator('.settings-card').first().evaluate((card) => {
    const style = getComputedStyle(card);
    return {
      borderTopWidth: style.borderTopWidth,
      borderTopColor: style.borderTopColor,
      borderRadius: style.borderTopLeftRadius,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      overflow: style.overflow,
    };
  });
  expect(settingsSectionChrome).toEqual({
    borderTopWidth: '0px',
    borderTopColor: 'rgba(0, 0, 0, 0)',
    borderRadius: '0px',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    boxShadow: 'none',
    overflow: 'visible',
  });
  const settingsTabsChrome = await page.locator('.settings-group-tabs').evaluate((tabs) => {
    const active = tabs.querySelector('.settings-group-tab.active');
    const next = active.nextElementSibling;
    const activeStyle = getComputedStyle(active);
    const nextStyle = getComputedStyle(next);
    const activeRect = active.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    return {
      activeBorderRightWidth: activeStyle.borderRightWidth,
      nextBorderLeftWidth: nextStyle.borderLeftWidth,
      nextBorderLeftColor: nextStyle.borderLeftColor,
      nextStartsAfterActive: nextRect.left >= activeRect.right,
    };
  });
  expect(settingsTabsChrome).toEqual(expect.objectContaining({
    activeBorderRightWidth: '1px',
    nextBorderLeftWidth: '1px',
    nextStartsAfterActive: true,
  }));
  expect(settingsTabsChrome.nextBorderLeftColor).not.toBe('rgba(0, 0, 0, 0)');
  const customSelectLayout = await page.locator('[data-audit-name="settings custom select"]').evaluate((trigger) => {
    const label = trigger.querySelector('.custom-select-trigger-label');
    const arrow = trigger.querySelector('.custom-select-trigger-arrow');
    const triggerStyle = getComputedStyle(trigger);
    const labelStyle = getComputedStyle(label);
    const arrowStyle = getComputedStyle(arrow);
    const triggerRect = trigger.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const arrowRect = arrow.getBoundingClientRect();
    return {
      display: triggerStyle.display,
      labelGridColumnStart: labelStyle.gridColumnStart,
      arrowGridColumnStart: arrowStyle.gridColumnStart,
      arrowPosition: arrowStyle.position,
    arrowLeftOffset: arrowStyle.left,
      arrowWidth: Math.round(arrowRect.width),
      arrowHeight: Math.round(arrowRect.height),
      arrowBeforeText: arrowRect.right <= labelRect.left,
      arrowInsideTrigger: arrowRect.left >= triggerRect.left && arrowRect.right <= triggerRect.right,
      labelInsideTrigger: labelRect.left >= triggerRect.left && labelRect.right <= triggerRect.right,
    };
  });
  expect(customSelectLayout).toEqual(expect.objectContaining({
    display: 'grid',
    labelGridColumnStart: '2',
    arrowGridColumnStart: '1',
    arrowPosition: 'relative',
    arrowLeftOffset: '0px',
    arrowWidth: 18,
    arrowHeight: 18,
    arrowBeforeText: true,
    arrowInsideTrigger: true,
    labelInsideTrigger: true,
  }));
  const folderCandidateLayout = await page.locator('[data-audit-name="settings folder candidate selected"]').evaluate((card) => {
    const copy = card.querySelector('.folder-candidate-copy');
    const title = copy.querySelector('strong');
    const details = Array.from(copy.querySelectorAll('span'));
    const badge = card.querySelector('.folder-candidate-badge');
    const toggle = document.querySelector('.folder-candidates-toggle');
    const style = getComputedStyle(card);
    const copyStyle = getComputedStyle(copy);
    const titleRect = title.getBoundingClientRect();
    const detailRects = details.map((element) => element.getBoundingClientRect());
    const badgeRect = badge.getBoundingClientRect();
    const badgeStyle = getComputedStyle(badge);
    const toggleArrowStyle = getComputedStyle(toggle, '::before');
    const rows = [titleRect, ...detailRects];
    return {
      display: style.display,
      gridTemplateColumns: style.gridTemplateColumns,
      alignItems: style.alignItems,
      justifyContent: style.justifyContent,
      textAlign: style.textAlign,
      copyGridColumnStart: copyStyle.gridColumnStart,
      copyMinWidth: copyStyle.minWidth,
      badgeGridColumnStart: getComputedStyle(badge).gridColumnStart,
      badgeBackground: badgeStyle.backgroundColor,
      badgeColor: badgeStyle.color,
      toggleArrowColor: toggleArrowStyle.color,
      badgeRightOfCopy: badgeRect.left >= copy.getBoundingClientRect().right,
      noRowBadgeOverlap: rows.every((rect) => rect.right <= badgeRect.left || rect.bottom <= badgeRect.top || rect.top >= badgeRect.bottom),
      rowVerticalOrder: rows.every((rect, index) => index === 0 || rect.top >= rows[index - 1].bottom - 0.5),
    };
  });
  expect(folderCandidateLayout).toEqual(expect.objectContaining({
    display: 'grid',
    alignItems: 'start',
    justifyContent: 'normal',
    textAlign: 'left',
    copyGridColumnStart: '1',
    copyMinWidth: '0px',
    badgeGridColumnStart: '2',
    badgeBackground: 'rgba(159, 206, 161, 0.16)',
    badgeColor: 'rgb(216, 244, 217)',
    toggleArrowColor: 'rgb(159, 206, 161)',
    badgeRightOfCopy: true,
    noRowBadgeOverlap: true,
    rowVerticalOrder: true,
  }));
  const folderCandidateOuterChrome = await page.locator('.folder-candidates-panel').evaluate((panel) => {
    const panelStyle = getComputedStyle(panel);
    const body = panel.querySelector('.reveal-panel-body');
    const list = panel.querySelector('.folder-candidate-list');
    const bodyStyle = getComputedStyle(body);
    const listStyle = getComputedStyle(list);
    return {
      panelBorderTopWidth: panelStyle.borderTopWidth,
      panelBackground: panelStyle.backgroundColor,
      panelBoxShadow: panelStyle.boxShadow,
      bodyBorderTopWidth: bodyStyle.borderTopWidth,
      bodyBackground: bodyStyle.backgroundColor,
      bodyBoxShadow: bodyStyle.boxShadow,
      bodyBorderRadius: bodyStyle.borderTopLeftRadius,
      listBorderTopWidth: listStyle.borderTopWidth,
      listBackground: listStyle.backgroundColor,
      listBoxShadow: listStyle.boxShadow,
      searchHasSurface: getComputedStyle(panel.querySelector('.folder-search-field')).backgroundColor !== 'rgba(0, 0, 0, 0)',
    };
  });
  expect(folderCandidateOuterChrome).toEqual({
    panelBorderTopWidth: '0px',
    panelBackground: 'rgba(0, 0, 0, 0)',
    panelBoxShadow: 'none',
    bodyBorderTopWidth: '0px',
    bodyBackground: 'rgba(0, 0, 0, 0)',
    bodyBoxShadow: 'none',
    bodyBorderRadius: '0px',
    listBorderTopWidth: '0px',
    listBackground: 'rgba(0, 0, 0, 0)',
    listBoxShadow: 'none',
    searchHasSurface: true,
  });
  const iconResetLayout = await page.locator('.icon-reset-defaults').evaluate((button) => {
    const style = getComputedStyle(button);
    const buttonRect = button.getBoundingClientRect();
    const panelRect = button.closest('.reveal-panel-body').getBoundingClientRect();
    const toggleRect = document.querySelector('.icon-advanced-toggle').getBoundingClientRect();
    return {
      justifySelf: style.justifySelf,
      marginTop: style.marginTop,
      topGap: buttonRect.top - toggleRect.bottom,
      centerDelta: Math.abs((buttonRect.left + buttonRect.right) / 2 - (panelRect.left + panelRect.right) / 2),
    };
  });
  expect(iconResetLayout).toEqual(expect.objectContaining({
    justifySelf: 'center',
    marginTop: '8px',
  }));
  expect(iconResetLayout.topGap).toBeGreaterThanOrEqual(7.5);
  expect(iconResetLayout.centerDelta).toBeLessThanOrEqual(1);
  await expectTextClearOfControlBorders(page, [
    '.settings-group-tab',
    '.setting-text-input',
    '.setting-picker-button',
    '.custom-select-trigger',
    '.folder-candidates-toggle',
    '.folder-candidate-card',
  ].join(', '));
  await expectHoverChange(page, '.featured-wallpaper-action');
  await expectReducedMotion(page, html, '.setting-picker-button');
});
`;
}

function runPlaywrightAudits() {
  console.log('\n> Playwright UI smoke audits');
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  const specRelativePath = 'tmp/ui-audit/ui-polish.spec.js';
  const specPath = join(repoRoot, specRelativePath);
  writeFileSync(specPath, buildPlaywrightSpec(), 'utf8');
  try {
    execFileSync('npx', ['playwright', 'test', specRelativePath, '--reporter=list', '--workers=1'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  runCommand('npm', ['run', 'typecheck'], 'typecheck');
  runCommand('npm', ['run', 'build'], 'production build');
  runStaticAudits();

  if (!existsSync(join(repoRoot, 'node_modules'))) {
    console.warn('node_modules is missing; skipping Playwright UI smoke audits.');
  } else {
    runPlaywrightAudits();
    runCommand('npm', ['run', 'smoke:extension'], 'unpacked extension smoke');
  }
} catch (error) {
  if (error && typeof error === 'object' && 'status' in error) {
    process.exit(error.status ?? 1);
  }
  console.error(error);
  process.exit(1);
}
