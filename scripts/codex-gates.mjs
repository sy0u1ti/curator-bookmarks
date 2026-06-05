// Codex Neutral Dark UI Refactor — objective verification gates (spec Section 2A).
//
// These are the machine-checkable gates referenced by
// docs/extension-codex-neutral-dark-ui-refactor-spec.md:
//   - auditTokenContrast  -> 2A.5 WCAG contrast floor over the design tokens
//   - auditUiInventory    -> 2A.7 frozen interaction/component inventory (drift detection)
//   - auditBundleBudget   -> 2A.6 bundle + newtab first-paint budget (baseline-relative)
//
// Each function is pure-ish: it reads the repo and returns an array of
// human-readable failure strings ([] === pass). run-tests.mjs feeds those into
// its existing `failures` collector, so they run under `npm run validate`.
// They can also be invoked standalone for quick iteration:
//   node -e "import('./scripts/codex-gates.mjs').then(m => console.log(m.auditTokenContrast(process.cwd())))"

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

// --------------------------------------------------------------------------
// shared fs helpers (self-contained so this module has no coupling to run-tests)
// --------------------------------------------------------------------------

function read(repoRoot, relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function walk(absoluteDir, predicate, results = []) {
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(absolutePath, predicate, results);
      }
      continue;
    }
    if (entry.isFile() && predicate(absolutePath)) {
      results.push(absolutePath);
    }
  }
  return results;
}

// --------------------------------------------------------------------------
// 2A.5 — WCAG contrast floor
// --------------------------------------------------------------------------

// sRGB 8-bit channel -> linear-light value (WCAG 2.x relative luminance).
function channelToLinear(value8bit) {
  const c = value8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

function parseHex(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (h.length === 8) h = h.slice(0, 6); // drop alpha; contrast uses the solid color
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Parse `--name: #hex;` declarations from a CSS file into name -> {r,g,b}.
// rgba()/var()/non-hex values are intentionally ignored (borders, etc. are not
// part of the text-on-surface contrast contract).
function parseColorTokens(css) {
  const map = new Map();
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/gi;
  let match;
  while ((match = re.exec(css)) !== null) {
    const rgb = parseHex(match[2]);
    if (rgb) map.set(match[1], rgb);
  }
  return map;
}

// Tiers: 'body' = normal text (>= 4.5:1), 'ui' = large text / state indicator /
// meaningful boundary (>= 3:1). Disabled + purely decorative roles are omitted.
//
// NOTE (lockstep, spec 2A.1/2A.3): these reference the CURRENT `--color-*`
// token names. When Phase 1 renames tokens to the Section 5.3 `--surface-*` /
// `--text-*` / `--semantic-*` scheme, update this table in the SAME phase. A
// missing token here is a hard failure (drift), not a silent skip.
const CONTRAST_PAIRINGS = [
  { text: '--color-text', surface: '--color-bg', tier: 'body' },
  { text: '--color-text', surface: '--color-bg-panel', tier: 'body' },
  { text: '--color-text-muted', surface: '--color-bg', tier: 'body' },
  { text: '--color-text-muted', surface: '--color-bg-panel', tier: 'body' },
  // 'subtle' is a muted/large/decorative role per 2A.5 -> 3:1 floor, not 4.5.
  { text: '--color-text-subtle', surface: '--color-bg', tier: 'ui' },
  { text: '--color-text-subtle', surface: '--color-bg-panel', tier: 'ui' },
  // semantic state colors used as text/icon on canvas -> 3:1 floor.
  { text: '--color-danger', surface: '--color-bg', tier: 'ui' },
  { text: '--color-warning', surface: '--color-bg', tier: 'ui' },
  { text: '--color-success', surface: '--color-bg', tier: 'ui' },
];

const TIER_MIN = { body: 4.5, ui: 3.0 };

export function auditTokenContrast(repoRoot, tokensRelPath = 'src/styles/tokens.css') {
  const failures = [];
  if (!existsSync(join(repoRoot, tokensRelPath))) {
    return [`contrast gate: ${tokensRelPath} not found (2A.1 canonical token source).`];
  }
  const tokens = parseColorTokens(read(repoRoot, tokensRelPath));

  for (const { text, surface, tier } of CONTRAST_PAIRINGS) {
    const fg = tokens.get(text);
    const bg = tokens.get(surface);
    if (!fg) {
      failures.push(`contrast gate: token ${text} not found in ${tokensRelPath} — update CONTRAST_PAIRINGS after the 2A.1 token rename.`);
      continue;
    }
    if (!bg) {
      failures.push(`contrast gate: token ${surface} not found in ${tokensRelPath} — update CONTRAST_PAIRINGS after the 2A.1 token rename.`);
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    const min = TIER_MIN[tier];
    if (ratio < min) {
      failures.push(
        `contrast gate: ${text} on ${surface} is ${ratio.toFixed(2)}:1, below the ${min}:1 (${tier}) floor (2A.5).`,
      );
    }
  }
  return failures;
}

// --------------------------------------------------------------------------
// 2A.7 — frozen interaction/component inventory (drift detection)
// --------------------------------------------------------------------------

// Extract exported runtime symbol names from a TS/TSX module (functions, consts,
// classes, named re-exports, default). Types/interfaces are excluded — this is a
// runtime *component* inventory, not an API surface dump.
function extractExports(source) {
  const names = new Set();
  const lines = source.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if ((m = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(line))) names.add(m[1]);
    else if ((m = /^export\s+const\s+([A-Za-z0-9_]+)/.exec(line))) names.add(m[1]);
    else if ((m = /^export\s+class\s+([A-Za-z0-9_]+)/.exec(line))) names.add(m[1]);
    else if (/^export\s+default\b/.test(line)) names.add('default');
    else if ((m = /^export\s*\{([^}]*)\}/.exec(line))) {
      for (const part of m[1].split(',')) {
        const seg = part.trim();
        if (!seg || seg.startsWith('type ')) continue;
        const asMatch = /(?:\bas\s+)([A-Za-z0-9_]+)$/.exec(seg);
        names.add(asMatch ? asMatch[1] : seg.replace(/\s+as\s+.*/, '').trim());
      }
    }
  }
  return [...names];
}

export function generateUiInventory(repoRoot, uiRelDir = 'src/ui') {
  const uiDir = join(repoRoot, uiRelDir);
  if (!existsSync(uiDir)) return [];
  const files = walk(uiDir, (p) => /\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p));
  const entries = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replaceAll('\\', '/');
    for (const name of extractExports(read(repoRoot, rel))) {
      entries.push(`${rel}::${name}`);
    }
  }
  return [...new Set(entries)].sort();
}

export function auditUiInventory(repoRoot, snapshotRelPath = 'scripts/ui-inventory.json') {
  const current = generateUiInventory(repoRoot);
  const snapshotPath = join(repoRoot, snapshotRelPath);

  if (!existsSync(snapshotPath)) {
    writeFileSync(snapshotPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
    console.log(`  inventory: bootstrapped frozen snapshot with ${current.length} entries -> ${snapshotRelPath}`);
    return [];
  }

  let frozen;
  try {
    frozen = JSON.parse(read(repoRoot, snapshotRelPath));
  } catch (error) {
    return [`inventory gate: ${snapshotRelPath} is not valid JSON (${error instanceof Error ? error.message : error}).`];
  }

  const frozenSet = new Set(frozen);
  const currentSet = new Set(current);
  const added = current.filter((x) => !frozenSet.has(x));
  const removed = frozen.filter((x) => !currentSet.has(x));

  if (added.length === 0 && removed.length === 0) return [];

  const failures = [];
  if (added.length) {
    failures.push(
      `inventory gate (2A.7): ${added.length} new src/ui export(s) not in the frozen inventory — add them to ${snapshotRelPath} AND to the Phase 7 acceptance matrix: ${added.slice(0, 12).join(', ')}${added.length > 12 ? ', …' : ''}`,
    );
  }
  if (removed.length) {
    failures.push(
      `inventory gate (2A.7): ${removed.length} frozen export(s) removed — confirm intentional and update ${snapshotRelPath}: ${removed.slice(0, 12).join(', ')}${removed.length > 12 ? ', …' : ''}`,
    );
  }
  return failures;
}

// --------------------------------------------------------------------------
// 2A.6 — bundle + newtab first-paint budgets (baseline-relative)
// --------------------------------------------------------------------------

const ENTRY_PAGES = ['popup', 'options', 'newtab'];

// Per spec 2A.6 defaults: newtab first-load +15%, other entries +25%, totals +25%.
const GROWTH_CEILINGS = {
  totalJs: 1.25,
  totalCss: 1.25,
  popup: 1.25,
  options: 1.25,
  newtab: 1.15, // first-paint critical (includes instant-wallpaper-boot.js)
};

function sumByExt(distDir, ext) {
  let total = 0;
  walk(distDir, (p) => p.endsWith(ext)).forEach((p) => {
    total += statSync(p).size;
  });
  return total;
}

// First-load size for an entry: every /assets/*.js|css plus other absolute
// js/css the entry HTML references (CRXJS emits the entry chunk + modulepreload
// of its static imports + css; newtab also references instant-wallpaper-boot.js).
function entryFirstLoadBytes(repoRoot, distDir, page) {
  const htmlRel = `dist/src/${page}/${page}.html`;
  const htmlPath = join(repoRoot, htmlRel);
  if (!existsSync(htmlPath)) return null;
  const html = read(repoRoot, htmlRel);
  const refs = new Set();
  const re = /(?:src|href)="(\/[^"]+\.(?:js|css))"/g;
  let m;
  while ((m = re.exec(html)) !== null) refs.add(m[1]);

  let total = 0;
  for (const ref of refs) {
    const assetPath = join(distDir, ref.replace(/^\//, ''));
    if (existsSync(assetPath)) total += statSync(assetPath).size;
  }
  return total;
}

export function measureBundle(repoRoot, distRelDir = 'dist') {
  const distDir = join(repoRoot, distRelDir);
  const entries = {};
  for (const page of ENTRY_PAGES) {
    const bytes = entryFirstLoadBytes(repoRoot, distDir, page);
    if (bytes !== null) entries[page] = bytes;
  }
  return {
    totalJs: sumByExt(distDir, '.js'),
    totalCss: sumByExt(distDir, '.css'),
    entries,
  };
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

export function auditBundleBudget(repoRoot, baselineRelPath = 'scripts/perf-baseline.json', distRelDir = 'dist') {
  const distDir = join(repoRoot, distRelDir);
  if (!existsSync(distDir) || !existsSync(join(distDir, 'manifest.json'))) {
    console.warn('  bundle: dist/ missing (run `npm run build` first); skipping bundle budget gate.');
    return [];
  }

  const current = measureBundle(repoRoot, distRelDir);
  const baselinePath = join(repoRoot, baselineRelPath);

  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n', 'utf8');
    console.log(
      `  bundle: bootstrapped baseline -> ${baselineRelPath} ` +
        `(js ${fmtKb(current.totalJs)}, css ${fmtKb(current.totalCss)}, ` +
        `newtab first-load ${current.entries.newtab ? fmtKb(current.entries.newtab) : 'n/a'})`,
    );
    return [];
  }

  let baseline;
  try {
    baseline = JSON.parse(read(repoRoot, baselineRelPath));
  } catch (error) {
    return [`bundle gate: ${baselineRelPath} is not valid JSON (${error instanceof Error ? error.message : error}).`];
  }

  const failures = [];
  const checkGrowth = (key, currentBytes, baseBytes) => {
    if (typeof baseBytes !== 'number' || typeof currentBytes !== 'number') return;
    const ceiling = GROWTH_CEILINGS[key] ?? 1.25;
    if (currentBytes > baseBytes * ceiling) {
      const pct = (((currentBytes - baseBytes) / baseBytes) * 100).toFixed(1);
      failures.push(
        `bundle gate (2A.6): ${key} grew ${pct}% (${fmtKb(baseBytes)} -> ${fmtKb(currentBytes)}), ` +
          `over the +${Math.round((ceiling - 1) * 100)}% ceiling. Re-baseline only with justification.`,
      );
    }
  };

  checkGrowth('totalJs', current.totalJs, baseline.totalJs);
  checkGrowth('totalCss', current.totalCss, baseline.totalCss);
  for (const page of ENTRY_PAGES) {
    checkGrowth(page, current.entries?.[page], baseline.entries?.[page]);
  }
  return failures;
}

// --------------------------------------------------------------------------
// convenience: run all gates, return combined failures
// --------------------------------------------------------------------------

export function runCodexGates(repoRoot) {
  return [
    ...auditTokenContrast(repoRoot),
    ...auditUiInventory(repoRoot),
    ...auditBundleBudget(repoRoot),
  ];
}
