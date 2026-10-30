import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/vendor/textures/engine.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false
})
const { engine, getTextureFrameTiming } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

async function createTextureHarness(name) {
  const component = name[0].toUpperCase() + name.slice(1)
  const shims = {
    engine: 'let draw; export function engine(root, callback) { draw=callback; return ()=>{}; } export const take=()=>draw;',
    react: `
      let effects=[];
      export const useEffect=fn=>effects.push(fn);
      export const useRef=value=>({current:value});
      export const useId=()=>'texture-test';
      export function flush() { const pending=effects; effects=[]; pending.forEach(fn=>fn()); }
    `,
    'react/jsx-runtime': `
      let nodes=[];
      export function jsx(tag, props) {
        const node={style:{...props.style}, attributes:{...props},
          setAttribute(key,value){this.attributes[key]=value}};
        nodes.push(node);
        if (typeof props.ref==='function') props.ref(node);
        else if (props.ref) props.ref.current=node;
        return node;
      }
      export const jsxs=jsx;
      export const Fragment='fragment';
      export const reset=()=>{nodes=[]};
      export const snapshot=()=>JSON.stringify(nodes.map(node=>[node.style,node.attributes.d]));
    `
  }
  const result = await build({
    stdin: {
      contents: `
        import { ${component} } from './src/vendor/textures/${name}.tsx';
        import { take } from 'texture-engine-test';
        import { flush } from 'react';
        import { reset, snapshot } from 'react/jsx-runtime';
        export function create() { reset(); ${component}({}); flush(); return {draw:take(),snapshot}; }
      `,
      resolveDir: process.cwd(), loader: 'tsx'
    },
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', write: false,
    plugins: [{
      name: 'deterministic-texture-frames',
      setup(build) {
        build.onResolve({ filter: /^(react|react\/jsx-runtime|texture-engine-test)$|^\.\/engine$/ }, args => ({
          path: args.path === './engine' || args.path === 'texture-engine-test' ? 'engine' : args.path,
          namespace: 'texture-test'
        }))
        build.onLoad({ filter: /.*/, namespace: 'texture-test' }, args => ({
          contents: shims[args.path], loader: 'js'
        }))
      }
    }]
  })
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).create
}

for (const name of ['current', 'settle', 'curtain', 'sphere', 'watch', 'twist']) {
  test(`${name}: the actual SVG deformation changes, converges, and returns home at 10/60/144Hz`, async () => {
    const create = await createTextureHarness(name)
    for (const hz of [10, 60, 144]) {
      const { draw, snapshot } = create()
      const before = snapshot()
      const { steps, dt } = getTextureFrameTiming(1000 / hz)
      let active = 0
      let moving = true
      for (let frame = 0; frame < hz * 3; frame++) {
        const offset = Math.min(2, Math.floor(frame / Math.max(1, hz / 12)))
        for (let step = 0; step < steps; step++) {
          active += (1 - active) * (1 - Math.exp(-18 * dt))
          if (1 - active < 0.002) active = 1
          moving = draw({ x: 580 + offset * 12, y: 360 + offset * 12, active, reduced: false }, dt)
        }
      }
      assert.notEqual(snapshot(), before, `${name} at ${hz}Hz must update its SVG, not just its animation state.`)
      assert.equal(moving, false, `${name} at ${hz}Hz must converge while the pointer is stationary.`)
      for (let frame = 0; frame < hz * 3; frame++) {
        for (let step = 0; step < steps; step++) {
          active += -active * (1 - Math.exp(-18 * dt))
          if (active < 0.002) active = 0
          moving = draw({ x: 604, y: 384, active, reduced: false }, dt)
        }
      }
      assert.equal(active, 0)
      assert.equal(moving, false, `${name} at ${hz}Hz must settle after leaving the background.`)
    }
  })
}

test('the real animation scheduler is idle by default, filters input and cancels on hide/reduce/dispose', () => {
  const names = ['window', 'document', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver']
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const target = () => {
    const listeners = new Map()
    return {
      listeners,
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback) },
      emit(type, event = {}) { listeners.get(type)?.forEach(callback => callback(event)) }
    }
  }
  const win = target()
  const doc = { ...target(), hidden: false }
  const queries = new Map()
  const frames = new Map()
  let frameId = 0
  let time = 1
  let draws = 0
  Object.assign(globalThis, {
    window: win, document: doc, IntersectionObserver: undefined,
    matchMedia: query => {
      if (!queries.has(query)) queries.set(query, { ...target(), matches: false })
      return queries.get(query)
    },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId },
    cancelAnimationFrame: id => frames.delete(id)
  })
  const step = () => {
    time += 1000 / 60
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach(callback => callback(time))
  }
  const move = allowed => win.emit('pointermove', {
    pointerType: 'mouse', buttons: 0, clientX: 420, clientY: 260, allowed
  })
  try {
    const root = { dataset: {}, querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 732, height: 516 }) }) }
    const dispose = engine(root, (_pointer, dt) => { draws++; assert.ok(dt <= 1 / 60 + Number.EPSILON); return false }, [160, 112], {
      eventTarget: win, acceptsPointer: event => event.allowed
    })
    assert.equal(frames.size, 0)
    move(false)
    assert.equal(frames.size, 0, 'Moving over controls must not start an idle loop.')
    move(true)
    assert.equal(frames.size, 1)
    for (let frame = 0; frame < 80; frame++) step()
    assert.ok(draws > 0)
    assert.equal(frames.size, 0)
    assert.equal(root.dataset.textureRunning, 'false')
    win.emit('pointerleave')
    for (let frame = 0; frame < 80; frame++) step()
    assert.equal(frames.size, 0)
    move(true)
    doc.hidden = true
    doc.emit('visibilitychange')
    assert.equal(frames.size, 0, 'A hidden tab cancels pending frames immediately.')
    doc.hidden = false
    move(true)
    const reduced = queries.get('(prefers-reduced-motion: reduce)')
    reduced.matches = true
    reduced.emit('change')
    assert.equal(frames.size, 0)
    reduced.matches = false
    move(true)
    dispose()
    assert.equal(frames.size, 0)
    for (const collection of [win.listeners, doc.listeners, ...[...queries.values()].map(query => query.listeners)]) {
      assert.ok([...collection.values()].every(listeners => listeners.size === 0))
    }
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
