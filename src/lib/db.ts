import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 动态计算数据库路径，确保在任何工作目录下都能正确找到
const projectRoot = path.resolve(process.cwd())
const dbPath = path.join(projectRoot, 'prisma', 'dev.db')
const databaseUrl = `file:${dbPath}`

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
