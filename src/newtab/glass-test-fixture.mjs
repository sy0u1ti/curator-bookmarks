export async function installGlassWallpaperFixture(context, page) {
  const url = 'https://example.com/curator-glass-wallpaper.png'
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1440
    canvas.height = 1000
    const context = canvas.getContext('2d')
    context.fillStyle = '#122035'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#304863'
    context.lineWidth = 16
    for (let x = -1000; x < 2440; x += 40) {
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x + 1000, 1000)
      context.stroke()
    }
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await context.route(url, route => route.fulfill({
    contentType: 'image/png', body: Buffer.from(image, 'base64'),
    headers: { 'access-control-allow-origin': '*' }
  }))
  return url
}
