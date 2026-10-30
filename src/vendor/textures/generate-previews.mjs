import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const output = path.join(root, 'public/textures')
const temporary = path.join(root, '.tmp-test/texture-previews')
const names = ['current', 'settle', 'curtain', 'sphere', 'watch', 'twist']
await mkdir(output, { recursive: true })
await mkdir(temporary, { recursive: true })
const bundlePath = path.join(temporary, 'render.mjs')
await build({
  stdin: {
    contents: `
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      ${names.map(name => `import { ${name[0].toUpperCase() + name.slice(1)} } from './${name}.tsx';`).join('\n')}
      export const previews = { ${names.map(name =>
        `${name}: renderToStaticMarkup(createElement(${name[0].toUpperCase() + name.slice(1)}, { static: true }))`).join(',')} };
    `,
    resolveDir: path.join(root, 'src/vendor/textures'),
    loader: 'tsx'
  },
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  jsx: 'automatic', outfile: bundlePath, logLevel: 'silent'
})
const { previews } = await import(pathToFileURL(bundlePath).href)
for (const [name, markup] of Object.entries(previews)) {
  const svg = markup.match(/<svg[\s\S]*<\/svg>/)?.[0]
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace('fill="currentColor"', 'fill="#fff"')
  if (!svg || /<(?:script|image|foreignObject)\b/i.test(svg)) throw new Error(`Invalid preview: ${name}`)
  await writeFile(path.join(output, `${name}.svg`),
    `<!-- Copyright (c) 2026 Textures (textures.dev). MIT; see LICENSE.txt. -->\n${svg}\n`)
}
await writeFile(path.join(output, 'LICENSE.txt'), await readFile(path.join(root, 'src/vendor/textures/LICENSE')))
console.log(`Generated ${names.length} local texture previews.`)
