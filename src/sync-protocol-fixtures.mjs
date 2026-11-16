// Local protocol fixtures shaped from the pinned floccus adapters. These verify
// Curator's real MV3 integration, not the availability of any hosted provider.
import { createServer } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import path from 'node:path'

export async function createSyncProtocolServer(directory, { controls = false } = {}) {
  const requests = [], unexpected = []
  const objects = new Map(), collections = [], links = [], lists = [], bookmarks = [], ncBookmarks = []
  const ncFolders = []
  const driveFiles = new Map()
  const webdavFiles = new Map()
  const dropboxFiles = new Map()
  let linkwardenVersion = '2.17.0'
  const linkwardenUser = { id: 1, name: 'Fixture user', collectionOrder: [], theme: 'dark' }
  const orderedLinks = collectionId => links
    .filter(link => String(link.collectionId) === String(collectionId))
    .sort((first, second) => second.collectionOrder - first.collectionOrder || Number(second.id) - Number(first.id))
  const supportsLinkOrder = () => linkwardenVersion === null || Number(linkwardenVersion.split('.')[0]) > 2 ||
    (Number(linkwardenVersion.split('.')[0]) === 2 && Number(linkwardenVersion.split('.')[1]) >= 17)
  const controlToken = controls ? randomUUID() : null
  let nextcloudLocked = false
  let nextId = 1, revision = 0
  const allocate = () => String(nextId++)
  const gitRoot = path.join(directory, 'git')
  const bare = path.join(gitRoot, 'sync.git'), seed = path.join(directory, 'seed')
  await mkdir(gitRoot, { recursive: true })
  const git = (...args) => execFileSync('git', args, { windowsHide: true, stdio: 'pipe' })
  git('init', '--bare', '--initial-branch=main', bare)
  git('init', '--initial-branch=main', seed)
  git('-C', seed, '-c', 'user.name=Curator test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'Seed')
  git('-C', seed, 'push', bare, 'main')
  git('-C', bare, 'config', 'http.receivepack', 'true')
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://local')
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      let raw = Buffer.concat(chunks)
      const method = request.method, route = url.pathname
      requests.push({ method, route, query: url.search, body: raw.toString('utf8').slice(0,300) })
      const reply = (status, value = {}, headers = {}) => {
        const body = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
        response.writeHead(status, { 'content-type': 'application/json', 'content-length': body.length, ...headers })
        response.end(method === 'HEAD' ? undefined : body)
      }
      let body = {}
      try { body = JSON.parse(raw.toString()) || {} } catch {
        body = Object.fromEntries(new URLSearchParams(raw.toString()))
      }
      if (controls && route === '/__qa/fixture' && method === 'POST') {
        if (request.headers.authorization !== `Bearer ${controlToken}`) return reply(403)
        const { provider, file, action } = body
        if (provider === 'linkwarden') {
          if (action === 'configure') {
            if ('version' in body) linkwardenVersion = body.version
            if (Array.isArray(body.collections)) collections.splice(0, collections.length, ...body.collections)
            if (Array.isArray(body.links)) links.splice(0, links.length, ...body.links)
            if (body.user) Object.assign(linkwardenUser, body.user)
          } else if (action === 'order') {
            body.ids.forEach((id, index) => {
              const link = links.find(item => String(item.id) === String(id))
              if (link) link.collectionOrder = body.ids.length - index
            })
          } else if (action !== 'read') {
            return reply(400, { error: 'Unknown Linkwarden fixture action' })
          }
          return reply(200, { version: linkwardenVersion, collections, links, user: linkwardenUser })
        }
        const item = provider === 'webdav' ? webdavFiles.get(`/dav/${file}`)
          : provider === 's3' ? objects.get(`bookmarks/${file}`)
            : provider === 'google-drive' ? [...driveFiles.values()].find(item => item.name === file && !item.trashed)
              : provider === 'dropbox' ? dropboxFiles.get(`/${file}`) : null
        if (action === 'read') {
          return reply(200, { exists: Boolean(item), content: item?.content?.toString('utf8') ?? null })
        }
        if (action === 'lock') {
          const now = Date.now()
          if (provider === 'webdav') webdavFiles.set(`/dav/${file}.lock`, { content: Buffer.from(String(now)), modified: now })
          else if (provider === 's3') objects.set(`bookmarks/${file}.lock`, { content: Buffer.from(String(now)), etag: '"fixture-lock"' })
          else if (provider === 'google-drive' && item) item.appProperties = { ...item.appProperties, locked: String(now) }
          else if (provider === 'dropbox' && item) item.property_groups = [{ template_id: 'ptid:fixture', fields: [{ name: 'locked', value: String(now) }] }]
          else if (provider === 'nextcloud-bookmarks') nextcloudLocked = true
          else return reply(400, { error: 'This fixture has no external lock' })
          return reply(200, { locked: true })
        }
        if (action === 'unlock') {
          if (provider === 'webdav') webdavFiles.delete(`/dav/${file}.lock`)
          else if (provider === 's3') objects.delete(`bookmarks/${file}.lock`)
          else if (provider === 'google-drive' && item) item.appProperties = { ...item.appProperties, locked: 'false' }
          else if (provider === 'dropbox' && item) item.property_groups = [{ template_id: 'ptid:fixture', fields: [{ name: 'locked', value: '' }] }]
          else if (provider === 'nextcloud-bookmarks') nextcloudLocked = false
          return reply(200, { locked: false })
        }
        return reply(400, { error: 'Unknown fixture action' })
      }
      if (route.startsWith('/dav/')) {
        if (request.headers.authorization !== 'Basic ' + Buffer.from('curator:fixture-token').toString('base64')) return reply(401)
        const item = webdavFiles.get(route)
        if (method === 'PROPFIND') {
          if (route !== '/dav/' && !item) return reply(404)
          const properties = route === '/dav/' ? '<d:resourcetype><d:collection/></d:resourcetype>' : `<d:getcontentlength>${item.content.length}</d:getcontentlength>`
          return reply(207, `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${route}</d:href><d:propstat><d:prop>${properties}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`, { 'content-type': 'application/xml' })
        }
        if (method === 'GET' || method === 'HEAD') return item
          ? reply(200, item.content, { 'content-type': 'application/octet-stream', 'last-modified': new Date(item.modified).toUTCString() })
          : reply(404)
        if (method === 'PUT') { webdavFiles.set(route, { content: raw, modified: Date.now() }); return reply(item ? 204 : 201, '') }
        if (method === 'DELETE') return reply(webdavFiles.delete(route) ? 204 : 404, '')
        if (method === 'MOVE') {
          if (!item) return reply(404)
          webdavFiles.set(new URL(request.headers.destination, 'http://local').pathname, item)
          webdavFiles.delete(route)
          return reply(201, '')
        }
        return reply(405)
      }
      if (route.startsWith('/git/')) {
        if (request.headers['content-encoding'] === 'gzip') raw = gunzipSync(raw)
        const child = spawn('git', ['http-backend'], { windowsHide: true, env: {
          ...process.env, GIT_PROJECT_ROOT: gitRoot, GIT_HTTP_EXPORT_ALL: '1',
          PATH_INFO: route.slice(4), QUERY_STRING: url.search.slice(1), REQUEST_METHOD: method,
          CONTENT_TYPE: request.headers['content-type'] || '', CONTENT_LENGTH: String(raw.length),
          REMOTE_USER: 'curator', SERVER_PROTOCOL: 'HTTP/1.1'
        } })
        const result = []
        child.stdout.on('data', chunk => result.push(chunk))
        child.stderr.on('data', () => {})
        child.on('error', error => { unexpected.push(error.message); if (!response.headersSent) reply(500) })
        child.on('close', () => {
          if (response.headersSent) return
          const resultBuffer = Buffer.concat(result), split = resultBuffer.indexOf('\r\n\r\n')
          if (split < 0) return reply(500, 'invalid Git CGI response')
          const headers = {}, lines = resultBuffer.subarray(0,split).toString().split('\r\n')
          let status = 200
          for (const line of lines) {
            const index = line.indexOf(':')
            const key = line.slice(0,index).toLowerCase(), value = line.slice(index+1).trim()
            if (key === 'status') status = Number(value.split(' ')[0])
            else headers[key] = value
          }
          response.writeHead(status, headers)
          response.end(resultBuffer.subarray(split+4))
        })
        child.stdin.end(raw)
        return
      }
      if (route.startsWith('/s3/')) {
        if (!request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')) return reply(403)
        const key = route.slice('/s3/'.length)
        if (method === 'HEAD' && (key === 'bookmarks' || key === 'bookmarks/')) return reply(200, '', { 'x-amz-bucket-region': 'us-east-1' })
        const file = objects.get(key)
        if (method === 'PUT') {
          if (request.headers['if-none-match'] === '*' && file) return reply(412)
          if (request.headers['if-match'] && file?.etag !== request.headers['if-match']) return reply(412)
          const etag = `"${createHash('sha256').update(raw).digest('hex')}"`
          objects.set(key, { content: raw, etag })
          return reply(200, '', { etag })
        }
        if (method === 'DELETE') { objects.delete(key); return reply(204, '') }
        if (!file) return reply(404, '<Error><Code>NoSuchKey</Code></Error>')
        return reply(200, file.content, { etag: file.etag, 'last-modified': new Date().toUTCString() })
      }
      if (route.startsWith('/linkwarden/')) {
        if (request.headers.authorization !== 'Bearer fixture-token') return reply(401)
        const api = route.slice('/linkwarden'.length)
        if (api === '/api/v1/config') return reply(200, { response: { INSTANCE_VERSION: linkwardenVersion } })
        if (api === '/api/v1/users/me' && method === 'GET') return reply(200, { response: linkwardenUser })
        if (api === '/api/v1/users/1' && method === 'PUT') {
          Object.assign(linkwardenUser, body)
          return reply(200, { response: linkwardenUser })
        }
        if (api === '/api/v1/search') return reply(200, { data: { links, nextCursor: null } })
        if (api === '/api/v1/collections' && method === 'GET') return reply(200, { response: collections })
        if (api === '/api/v1/collections' && method === 'POST') {
          const collection = { id: allocate(), parentId: null, ownerId: 1, createdAt: new Date().toISOString(), ...body }
          collections.push(collection); return reply(200, { response: collection })
        }
        const collectionId = api.match(/^\/api\/v1\/collections\/([^/]+)$/)?.[1]
        if (collectionId) {
          const item = collections.find(item => String(item.id) === collectionId)
          if (!item) return reply(404)
          if (method === 'PUT') Object.assign(item, body)
          if (method === 'DELETE') collections.splice(collections.indexOf(item), 1)
          return reply(200, { response: item })
        }
        if (api === '/api/v1/links' && method === 'POST') {
          const item = {
            id: allocate(), name: body.name, url: body.url, collectionId: body.collection.id, tags: body.tags || [],
            ...(supportsLinkOrder() ? { collectionOrder: (orderedLinks(body.collection.id)[0]?.collectionOrder || 0) + 1 } : {}),
          }
          links.push(item); return reply(200, { response: item })
        }
        const orderId = api.match(/^\/api\/v1\/links\/([^/]+)\/order$/)?.[1]
        if (orderId && method === 'PUT') {
          if (!supportsLinkOrder()) return reply(404)
          const item = links.find(link => String(link.id) === orderId)
          if (!item) return reply(404)
          const siblings = orderedLinks(item.collectionId).filter(link => link !== item)
          const previous = body.beforeId === undefined ? -1 : siblings.findIndex(link => String(link.id) === String(body.beforeId))
          if (body.beforeId !== undefined && previous < 0) return reply(404)
          siblings.splice(previous + 1, 0, item)
          siblings.forEach((link, index) => { link.collectionOrder = siblings.length - index })
          return reply(200, { response: item })
        }
        const linkId = api.match(/^\/api\/v1\/links\/([^/]+)$/)?.[1]
        if (linkId) {
          const item = links.find(item => String(item.id) === linkId)
          if (!item) return reply(404)
          if (method === 'PUT') {
            if (String(item.collectionId) !== String(body.collection.id) && supportsLinkOrder()) {
              item.collectionOrder = (orderedLinks(body.collection.id)[0]?.collectionOrder || 0) + 1
            }
            Object.assign(item, { name: body.name, url: body.url, collectionId: body.collection.id, tags: body.tags })
          }
          if (method === 'DELETE') links.splice(links.indexOf(item),1)
          return reply(200, { response: item })
        }
      }
      if (route.startsWith('/karakeep/')) {
        if (request.headers.authorization !== 'Bearer fixture-token') return reply(401)
        const api = route.slice('/karakeep'.length)
        if (api === '/api/v1/lists' && method === 'GET') return reply(200, { lists })
        if (api === '/api/v1/lists' && method === 'POST') {
          const list = { id: allocate(), parentId: null, ...body }; lists.push(list); return reply(200, list)
        }
        const inList = api.match(/^\/api\/v1\/lists\/([^/]+)\/bookmarks(?:\/([^/]+))?$/)
        if (inList) {
          const [, listId, bookmarkId] = inList
          if (!bookmarkId) return reply(200, { bookmarks: bookmarks.filter(item => item.lists.includes(listId)), nextCursor: null })
          const item = bookmarks.find(item => item.id === bookmarkId)
          if (method === 'PUT' && !item.lists.includes(listId)) item.lists.push(listId)
          if (method === 'DELETE') item.lists = item.lists.filter(id => id !== listId)
          return reply(200)
        }
        if (api === '/api/v1/bookmarks' && method === 'POST') {
          const item = { id: allocate(), title: body.title, content: { type: 'link', url: body.url }, tags: [], lists: [] }
          bookmarks.push(item); return reply(200,item)
        }
        const itemMatch = api.match(/^\/api\/v1\/bookmarks\/([^/]+)(?:\/(lists|tags))?$/)
        if (itemMatch) {
          const item = bookmarks.find(item => item.id === itemMatch[1])
          if (!item) return reply(404)
          if (itemMatch[2] === 'lists') return reply(200, { lists: lists.filter(list => item.lists.includes(list.id)) })
          if (itemMatch[2] === 'tags') return reply(200, { tags: [] })
          if (method === 'PATCH') Object.assign(item, body)
          if (method === 'DELETE') bookmarks.splice(bookmarks.indexOf(item),1)
          return reply(200, item)
        }
        const listId = api.match(/^\/api\/v1\/lists\/([^/]+)$/)?.[1]
        if (listId) {
          const item = lists.find(item => item.id === listId)
          if (method === 'PATCH') Object.assign(item, body)
          if (method === 'DELETE') lists.splice(lists.indexOf(item),1)
          return reply(item ? 200 : 404, item)
        }
      }
      if (route.startsWith('/nextcloud/')) {
        const api = route.slice('/nextcloud/'.length), base = 'index.php/apps/bookmarks/public/rest/v2/'
        if (request.headers.authorization !== 'Basic ' + Buffer.from('curator:fixture-token').toString('base64')) return reply(401)
        if (api === 'ocs/v2.php/cloud/capabilities') return reply(200, { ocs: { meta: { status: 'ok', statuscode: 100 }, data: { capabilities: { bookmarks: { 'javascript-bookmarks': true } } } } })
        if (api === base + 'lock') {
          if (method === 'DELETE') nextcloudLocked = false
          return reply(nextcloudLocked ? 423 : 200, { status: nextcloudLocked ? 'error' : 'success' })
        }
        if (api === base + 'folder' && method === 'GET') return reply(200, { status: 'success', data: ncFolders })
        if (api === base + 'folder' && method === 'POST') {
          const folder = { id: allocate(), title: body.title, parentId: String(body.parent_folder ?? -1) }
          ncFolders.push(folder); revision++; return reply(200, { status: 'success', item: folder })
        }
        if (api.endsWith('/hash')) return reply(200, { status: 'success', data: String(revision) })
        const children = api.match(/folder\/([^/]+)\/children$/)
        if (children) return reply(200, { status: 'success', data: ncBookmarks.filter(item => item.folders.includes(children[1])).map(item => ({ ...item, type: 'bookmark' })) })
        if (api.endsWith('/childorder')) return reply(200, { status: 'success', data: [] })
        const removedFromFolder = api.match(/folder\/([^/]+)\/bookmarks\/([^/]+)$/)
        if (removedFromFolder && method === 'DELETE') {
          const item = ncBookmarks.find(item => item.id === removedFromFolder[2])
          if (item) {
            item.folders = item.folders.filter(id => id !== removedFromFolder[1])
            if (!item.folders.length) ncBookmarks.splice(ncBookmarks.indexOf(item),1)
          }
          revision++
          return reply(200,{status:'success'})
        }
        if (api === base + 'bookmark' && method === 'GET') return reply(200, {
          status: 'success', data: url.searchParams.has('url') ? ncBookmarks.filter(item => item.url === url.searchParams.get('url')) : ncBookmarks
        })
        if (api === base + 'bookmark' && method === 'POST') {
          const folder = body['folders[]'] ?? body.folders ?? '-1'
          const item = { id: allocate(), title: body.title, url: body.url, folders: [String(Array.isArray(folder) ? folder[0] : folder)], tags: [] }
          ncBookmarks.push(item); revision++; return reply(200, { status: 'success', item })
        }
        const itemMatch = api.match(/bookmark\/([^/]+)(?:\/folder\/([^/]+))?$/)
        if (itemMatch) {
          const item = ncBookmarks.find(item => item.id === itemMatch[1])
          if (!item) return reply(404, { status: 'error' })
          if (method === 'PUT') Object.assign(item, { title: body.title || item.title, url: body.url || item.url })
          if (method === 'DELETE') ncBookmarks.splice(ncBookmarks.indexOf(item),1)
          revision++; return reply(200, { status: 'success', item })
        }
      }
      if (route.startsWith('/oauth/')) {
        if (route.endsWith('/token')) {
          const params = new URLSearchParams(raw.toString())
          if (params.get('grant_type') === 'authorization_code' && !params.get('code_verifier')) return reply(400)
          return reply(200, { access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer' })
        }
        if (route.endsWith('/about')) return reply(200, { user: { displayName: 'Fixture Google' } })
        if (route.endsWith('/users/get_current_account')) {
          if (method !== 'POST' || raw.toString() !== 'null' || !request.headers['content-type']?.startsWith('application/json')) {
            return reply(400, { error: 'Expected a JSON null request body' })
          }
          return reply(200, { name: { display_name: 'Fixture Dropbox' } })
        }
        if (route.includes('/www.googleapis.com/')) {
          const upload = route.match(/\/upload\/drive\/v3\/files(?:\/([^/]+))?$/)
          if (upload) {
            const id = upload[1] || allocate()
            const file = driveFiles.get(id) || { id, name: '', appProperties: {}, trashed: false }
            file.content = raw
            file.size = String(raw.length)
            driveFiles.set(id,file)
            return reply(200,{id})
          }
          if (route.endsWith('/drive/v3/files')) {
            const name = url.searchParams.get('q')?.match(/name = '((?:\\.|[^'])*)'/)?.[1]?.replace(/\\(.)/g, '$1')
            return reply(200, { files: [...driveFiles.values()].filter(item => !name || item.name === name).map(({ content, ...metadata }) => metadata) })
          }
          const id = route.match(/\/drive\/v3\/files\/([^/]+)$/)?.[1]
          if (id) {
            const file = driveFiles.get(id)
            if (!file) return reply(404)
            if (method === 'DELETE') { driveFiles.delete(id); return reply(204,'') }
            if (method === 'PATCH') Object.assign(file,body)
            if (url.searchParams.get('alt') === 'media') return reply(200,file.content,{ 'content-type':'application/octet-stream' })
            const { content, ...metadata } = file
            return reply(200,metadata)
          }
        }
        if (route.includes('dropboxapi.com/2/')) {
          const args = request.headers['dropbox-api-arg'] ? JSON.parse(request.headers['dropbox-api-arg']) : body
          const dropboxFile = dropboxFiles.get(args.path) || [...dropboxFiles.values()].find(item => item.id === args.path)
          if (route.endsWith('/templates/list_for_user')) return reply(200,{template_ids:['ptid:fixture']})
          if (route.endsWith('/templates/get_for_user')) return reply(200,{ name:'locked',fields:[{name:'locked',type:'string'}] })
          if (route.endsWith('/templates/add_for_user')) return reply(200,{template_id:'ptid:fixture'})
          if (route.endsWith('/properties/overwrite')) {
            if (dropboxFile) dropboxFile.property_groups=body.property_groups
            return reply(200)
          }
          if (route.endsWith('/files/search_v2')) return reply(200,{matches:[],has_more:false})
          if (route.endsWith('/files/get_metadata')) {
            if (!dropboxFile) return reply(409,{error_summary:'path/not_found/',error:{'.tag':'path',path:{'.tag':'not_found'}}})
            const {content,...metadata}=dropboxFile
            return reply(200,metadata)
          }
          if (route.endsWith('/files/upload')) {
            const filePath = dropboxFile?.path_display || args.path
            const file = { ...(dropboxFile || {}), '.tag': 'file', id: dropboxFile?.id || `id:${allocate()}`,
              name: filePath.split('/').at(-1), path_display: filePath, path_lower: filePath.toLowerCase(), size: raw.length, content: raw }
            dropboxFiles.set(filePath, file)
            return reply(200, { id: file.id, size: raw.length })
          }
          if (route.endsWith('/files/download')) return reply(dropboxFile?200:409,dropboxFile?.content||'',{'content-type':'application/octet-stream'})
        }
      }
      unexpected.push(`${method} ${route} ${raw.toString().slice(0,150)}`)
      reply(501, { error: `Unimplemented fixture endpoint: ${method} ${route}` })
    } catch (error) {
      unexpected.push(error.stack)
      if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: error.message }))
    }
  })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  return {
    base: `http://127.0.0.1:${server.address().port}`, requests, unexpected, controlToken,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  }
}
