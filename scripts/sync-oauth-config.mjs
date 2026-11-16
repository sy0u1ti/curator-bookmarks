import { createHash, createPublicKey } from 'node:crypto'

/**
 * Publisher configuration, consumed only by the worker build. OAuth clients
 * identify Curator to the provider; end users only sign in to their accounts.
 */
export function resolveSyncOAuthBuild(env, { release = false, manifestKey = '' } = {}) {
  const read = name => String(env[name] || '').trim()
  const publicKey = (read('CURATOR_EXTENSION_PUBLIC_KEY') || manifestKey).replace(/\s/g, '')
  const developmentId = release ? '' : read('CURATOR_DEVELOPMENT_EXTENSION_ID')
  if (developmentId && !/^[a-p]{32}$/.test(developmentId)) {
    throw new Error('CURATOR_DEVELOPMENT_EXTENSION_ID 必须是当前开发版扩展的 32 位 ID。')
  }
  let extensionId = ''
  if (publicKey) {
    try {
      createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' })
      extensionId = createHash('sha256').update(Buffer.from(publicKey, 'base64')).digest('hex').slice(0, 32)
        .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)))
    } catch {
      throw new Error('CURATOR_EXTENSION_PUBLIC_KEY 必须是扩展的 Base64 DER 公钥。')
    }
  }
  const googleId = read('CURATOR_GOOGLE_CLIENT_ID')
  const googleSecret = read('CURATOR_GOOGLE_CLIENT_SECRET')
  const dropboxId = read('CURATOR_DROPBOX_CLIENT_ID')
  if (Boolean(googleId) !== Boolean(googleSecret)) {
    throw new Error('Google 登录需要同时配置 CURATOR_GOOGLE_CLIENT_ID 和 CURATOR_GOOGLE_CLIENT_SECRET。')
  }
  if (googleId && !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(googleId)) {
    throw new Error('CURATOR_GOOGLE_CLIENT_ID 不是有效的 Google OAuth 客户端 ID。')
  }
  if (dropboxId && !/^[a-zA-Z0-9]+$/.test(dropboxId)) {
    throw new Error('CURATOR_DROPBOX_CLIENT_ID 必须是 Dropbox 应用的 App key。')
  }
  const clients = {
    ...(googleId ? { 'google-drive': { clientId: googleId, clientSecret: googleSecret } } : {}),
    ...(dropboxId ? { dropbox: { clientId: dropboxId } } : {})
  }
  if (release) {
    const missing = [
      !publicKey && 'CURATOR_EXTENSION_PUBLIC_KEY',
      !googleId && 'CURATOR_GOOGLE_CLIENT_ID / CURATOR_GOOGLE_CLIENT_SECRET',
      !dropboxId && 'CURATOR_DROPBOX_CLIENT_ID'
    ].filter(Boolean)
    if (missing.length) throw new Error(`发行版缺少登录配置：${missing.join('、')}。请由扩展发行方配置后重新构建。`)
  }
  // An unpacked installation already owns settings under its path-derived ID.
  // Register that redirect alongside the release ID instead of changing its
  // identity when the publisher key is first configured.
  return {
    publicKey: developmentId ? '' : publicKey,
    oauth: { extensionId: developmentId || extensionId, clients }
  }
}
