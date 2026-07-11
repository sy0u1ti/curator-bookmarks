// [DEBUG-tree1] 分析用户真实书签结构
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('/mnt/c/Users/Administrator/AppData/Local/Google/Chrome/User Data/Default/Bookmarks', 'utf8'))
let folders = 0, bookmarks = 0, maxDepth = 0
const weird = []
function walk(node, depth) {
  if (node.type === 'folder') {
    folders++
    maxDepth = Math.max(maxDepth, depth)
    if (!node.name || !node.name.trim()) weird.push(JSON.stringify(node.name))
    ;(node.children || []).forEach((c) => walk(c, depth + 1))
  } else if (node.type === 'url') {
    bookmarks++
  }
}
for (const key of Object.keys(data.roots)) walk(data.roots[key], 0)
console.log({ folders, bookmarks, maxDepth, emptyNameFolders: weird.length })
