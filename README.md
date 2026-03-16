# 数智学堂 - Next.js 全栈版本

这是一个将原有的 React + Node.js + Python 三端架构整合为单一 Next.js 全栈项目的版本。

## 项目结构

```
next-frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes (替代原 node-backend)
│   │   │   ├── auth/          # 认证相关 API
│   │   │   ├── dashboard/     # 仪表盘 API
│   │   │   ├── growth/        # 成长轨迹 API
│   │   │   ├── tutoring/      # 辅导会话 API
│   │   │   └── uploads/       # 文件上传 API
│   │   ├── dashboard/         # 仪表盘页面
│   │   ├── growth/            # 成长轨迹页面
│   │   ├── login/             # 登录页面
│   │   ├── profile/           # 个人设置页面
│   │   ├── register/          # 注册页面
│   │   ├── tutoring/          # 辅导页面
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # React 组件
│   │   └── Navbar.tsx         # 导航栏
│   ├── lib/                   # 工具库
│   │   ├── api.ts             # API 客户端
│   │   ├── auth.ts            # 认证工具
│   │   └── db.ts              # Prisma 客户端
│   ├── store/                 # 状态管理
│   │   └── userStore.ts       # 用户状态
│   └── types/                 # TypeScript 类型
│       └── index.ts
├── prisma/                    # 数据库模型
│   └── schema.prisma
├── python-ocr/                # Python OCR 服务
│   ├── services/
│   │   ├── ocr_service.py    # OCR 服务
│   │   └── llm_factory.py    # LLM 工厂
│   ├── main.py               # FastAPI 入口
│   └── requirements.txt
├── .env                       # 环境变量
└── next.config.mjs            # Next.js 配置
```

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Ant Design
- **数据库**: SQLite + Prisma ORM
- **认证**: JWT
- **状态管理**: Zustand
- **OCR**: Python + PaddleOCR (独立服务)
- **LLM**: DeepSeek API

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
DEEPSEEK_API_KEY="your-deepseek-api-key"
OCR_SERVICE_URL="http://localhost:8000"
```

### 3. 初始化数据库

```bash
npx prisma migrate dev
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 5. 启动 OCR 服务 (可选)

如果需要图片识别功能，启动 Python OCR 服务：

```bash
cd python-ocr
# 创建虚拟环境并安装依赖
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 启动服务
python main.py
```

## API 路由

### 认证
| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/profile` | GET | 获取用户信息 |

### 辅导
| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/tutoring/sessions` | POST | 创建辅导会话 |
| `/api/tutoring/sessions/:id` | GET | 获取会话详情 |
| `/api/tutoring/sessions/:id/messages` | POST | 发送消息 |
| `/api/tutoring/sessions/:id/messages` | GET | 获取消息列表 |
| `/api/tutoring/history` | GET | 获取历史题目 |
| `/api/tutoring/recommend` | GET | 获取推荐题目 |

### 成长
| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/growth/stats` | GET | 获取统计数据 |
| `/api/growth/mistakes` | GET | 获取错题列表 |

### 上传
| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/uploads/questions/:grade` | POST | 上传题目图片 |

## 与原项目的区别

1. **单一框架**: 从 React + Node.js + Python 三端整合为 Next.js 单一框架
2. **文件路由**: 使用 Next.js 文件系统路由替代 React Router
3. **API Routes**: 使用 Next.js API Routes 替代 Express 后端
4. **数据库**: 使用 Prisma ORM 替代原生 SQL
5. **部署简化**: 只需部署一个 Next.js 应用

## 迁移完成的内容

- ✅ 所有前端页面和组件
- ✅ 认证系统 (登录/注册/用户信息)
- ✅ Tutoring API (会话管理、消息、历史、推荐)
- ✅ Growth API (统计数据、错题列表)
- ✅ Dashboard API
- ✅ 文件上传 API
- ✅ Python OCR 服务
- ✅ DeepSeek LLM 集成
- ✅ 数据库模型和迁移

## 生产环境部署

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

## 注意事项

1. Python OCR 服务需要单独启动，端口为 8000
2. 确保设置正确的环境变量
3. 首次运行需要初始化数据库
