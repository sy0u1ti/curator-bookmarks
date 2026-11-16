/**
 * Ego has no high-level unpacked-extension installer. Use its documented CDP
 * bridge on an agent-owned page; never create or attach to another browser.
 * The command stays asynchronous in the page so a slow installation cannot
 * outlive a timed-out page.evaluate with unknown side effects.
 */
export async function extensionCommand(task, page, method, params) {
  const bindingName = 'curatorQaBridge'
  if (!await page.evaluate(() => typeof window.curatorQaBridge?.send === 'function')) {
    await task.cdp('Target.exposeDevToolsProtocol', { targetId: page.targetId, bindingName })
  }
  await page.evaluate(({ bindingName, method, params }) => {
    const bridge = window[bindingName]
    window.__curatorQaCommand = { pending: true }
    bridge.onmessage = raw => {
      const result = JSON.parse(raw)
      if (result.id === 1) window.__curatorQaCommand = { pending: false, ...result }
    }
    bridge.send(JSON.stringify({ id: 1, method, params }))
  }, { bindingName, method, params })
  await page.waitForFunction(() => window.__curatorQaCommand?.pending === false, undefined, { timeout: 45000 })
  const reply = await page.evaluate(() => window.__curatorQaCommand)
  if (reply.error) throw new Error(`${method}: ${reply.error.message}`)
  return reply.result
}
