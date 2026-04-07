import fs from 'fs'
import path from 'path'

interface KnowledgeNode {
  id: string
  title: string
  chapter?: string
  level: number
  children?: KnowledgeNode[]
}

// 缓存节点映射
let titleToNodeIdCache: Record<string, string> | null = null
let idToTitleCache: Record<string, string> | null = null

function buildCache() {
  const t2i: Record<string, string> = {}
  const i2t: Record<string, string> = {}
  const dataDir = path.join(process.cwd(), 'src/data')
  
  try {
    const files = fs.readdirSync(dataDir)
    
    const traverse = (nodes: KnowledgeNode[]) => {
      for (const node of nodes) {
        t2i[node.title] = node.id
        i2t[node.id] = node.title
        if (node.chapter) {
          // 有时候 AI 可能会带上章节名
          t2i[`${node.chapter} ${node.title}`] = node.id
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children)
        }
      }
    }

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dataDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        if (data.nodes) {
          traverse(data.nodes)
        }
      }
    }
  } catch (error) {
    console.error('Error building knowledge cache:', error)
  }
  
  return { t2i, i2t }
}

export function getNodeIdByTitle(title: string): string | null {
  if (!titleToNodeIdCache) {
    const cache = buildCache()
    titleToNodeIdCache = cache.t2i
    idToTitleCache = cache.i2t
  }
  
  // 完全匹配
  if (titleToNodeIdCache![title]) {
    return titleToNodeIdCache![title]
  }
  
  // 模糊匹配（如果包含）
  for (const [key, id] of Object.entries(titleToNodeIdCache!)) {
    if (key.includes(title) || title.includes(key)) {
      return id
    }
  }
  
  return null
}

export function getNodeTitleById(id: string): string | null {
  if (!idToTitleCache) {
    const cache = buildCache()
    titleToNodeIdCache = cache.t2i
    idToTitleCache = cache.i2t
  }
  
  return idToTitleCache![id] || null
}
