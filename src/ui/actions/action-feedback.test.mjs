import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const { createHoldConfirmation } = await load('src/ui/actions/hold-confirmation.ts')
const { getActionFeedbackStatus, IDLE_ACTION_FEEDBACK, ACTION_FEEDBACK_DURATION_MS } = await load('src/shared/action-feedback.ts')

function fixture() {
  const tasks = new Map()
  const history = []
  let time = 0
  let sequence = 0
  let confirms = 0
  const control = createHoldConfirmation({
    onChange: phase => history.push(phase),
    onConfirm: () => { confirms++ },
    durationMs: 900,
    schedule(callback, delay) { const id = ++sequence; tasks.set(id, { callback, due: time + delay }); return id },
    unschedule(id) { tasks.delete(id) }
  })
  return {
    control, history, tasks,
    get confirms() { return confirms },
    advance(ms) {
      time += ms
      for (const [id, task] of tasks) {
        if (task.due <= time) { tasks.delete(id); task.callback() }
      }
    }
  }
}

{
  const test = fixture()
  test.control.start()
  test.advance(899)
  test.control.release()
  test.advance(10000)
  assert.equal(test.confirms, 0, 'early release must never confirm')
  assert.equal(test.history.at(-1), 'idle')
}
{
  const test = fixture()
  test.control.start()
  test.advance(900)
  assert.equal(test.confirms, 0, 'elapsed time alone must not perform a destructive action')
  assert.equal(test.history.at(-1), 'ready')
  test.control.release()
  test.control.release()
  test.control.activate()
  test.control.start()
  test.advance(5000)
  assert.equal(test.confirms, 1, 'one confirmation per mounted request')
}
{
  const test = fixture()
  test.control.start()
  const staleCallback = [...test.tasks.values()][0].callback
  test.control.cancel()
  test.control.start()
  staleCallback()
  assert.equal(test.history.at(-1), 'holding', 'an old timer cannot arm a new gesture')
  test.advance(900)
  test.control.cancel()
  test.control.release()
  assert.equal(test.confirms, 0, 'moving away or losing focus cancels even after the threshold')
}
{
  const test = fixture()
  test.control.start()
  test.advance(500)
  test.control.start()
  test.advance(400)
  test.control.release()
  assert.equal(test.confirms, 1, 'key repeat must neither restart the clock nor confirm twice')
}
{
  const test = fixture()
  test.control.activate()
  assert.equal(test.confirms, 0, 'assistive activation must first arm')
  test.control.cancel()
  test.control.activate()
  assert.equal(test.confirms, 0, 'blur cancels assistive arming')
  test.control.activate()
  assert.equal(test.confirms, 1, 'assistive users have an untimed two-activation alternative')
}
{
  const test = fixture()
  test.control.start()
  const staleCallback = [...test.tasks.values()][0].callback
  test.control.dispose()
  staleCallback()
  test.advance(5000)
  assert.equal(test.confirms, 0)
  assert.equal(test.tasks.size, 0, 'unmount clears timers')
}
assert.equal(getActionFeedbackStatus(IDLE_ACTION_FEEDBACK, 100), 'idle')
assert.equal(getActionFeedbackStatus({ status: 'pending', updatedAt: 0 }, 999999), 'pending', 'pending must not expire into success')
for (const status of ['success', 'error']) {
  assert.equal(getActionFeedbackStatus({ status, updatedAt: 100 }, 100 + ACTION_FEEDBACK_DURATION_MS - 1), status)
  assert.equal(getActionFeedbackStatus({ status, updatedAt: 100 }, 100 + ACTION_FEEDBACK_DURATION_MS), 'idle')
}
console.log('Action feedback and hold-confirmation regressions passed (8 scenarios).')
