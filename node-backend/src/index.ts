import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_errortutor';

// 扩展 Request 类型
interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

// 鉴权中间件
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '无访问权限' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token已失效' });
    req.user = user as any;
    next();
  });
};

// ================= Auth Routes =================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, grade, level } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: '用户名已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        grade: grade || null,
        level: level || null
      }
    });

    res.status(201).json({ message: '注册成功', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({ message: '登录成功', token, username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ================= User Routes =================
app.get('/api/user/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        grade: true,
        level: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ================= Tutoring Routes =================

// 获取APP上传的历史题目
app.get('/api/tutoring/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const history = await prisma.appUpload.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取历史题目失败' });
  }
});

// 获取系统推荐题目
app.get('/api/tutoring/recommend', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // 根据用户的学段进行简单匹配推荐
    const recommend = await prisma.problemBank.findMany({
      where: user?.grade ? { grade: user.grade } : undefined,
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    res.json(recommend);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取推荐题目失败' });
  }
});

// 初始化一个新题目的辅导会话
app.post('/api/tutoring/start', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { problemText, mode = '通用辅导' } = req.body;
    const userId = req.user!.userId;

    const session = await prisma.tutoringSession.create({
      data: {
        userId,
        problemText,
        mode,
        currentStep: 0,
        messages: {
          create: [
            {
              role: 'ai',
              text: `你好！我们现在进入【${mode}】模式。针对这道题，请先告诉我你的初步想法或已知条件有哪些？`
            }
          ]
        }
      },
      include: {
        messages: true
      }
    });

    res.json({ sessionId: session.id, messages: session.messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '启动会话失败' });
  }
});

// 获取会话详情和聊天记录
app.get('/api/tutoring/:sessionId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!session) return res.status(404).json({ error: '会话不存在' });
    if (session.userId !== req.user!.userId) return res.status(403).json({ error: '无权访问' });

    res.json(session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取会话失败' });
  }
});

// 发送消息并获取AI反馈 (调用真实大模型API)
app.post('/api/tutoring/:sessionId/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;
    const userId = req.user!.userId;

    const session = await prisma.tutoringSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: '会话不可用' });
    }

    // 1. 保存用户消息
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        text
      }
    });

    let aiReply = '';
    let nextStep = session.currentStep;
    let mistakeToRecord = null;

    // 2. 准备发给 Python AI 后端的历史记录
    // 过滤掉最新的一条，因为那是刚刚存进去或者还没加入history的
    const history = session.messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    }));

    // 构建 System Prompt 提示词，要求 AI 输出严格的 JSON 格式
    const systemPrompt = `你是一个专业的中学数学辅导老师。当前题目是：${session.problemText}。
当前辅导模式是：${session.mode}。
当前解题进度步骤：${session.currentStep} (0:理解题意 1:知识点映射 2:逻辑建模 3:求解验算)。
请根据用户的回答进行诊断和引导。如果用户回答正确，引导进入下一步；如果回答错误，指出错误并给出启发，不要直接给答案。回复要简短亲切。如果用户完成所有步骤，请总结。
你必须返回一个严格的 JSON 字符串，格式如下：
{
  "reply": "给用户的回复文本",
  "nextStep": 数字, // 下一步的步骤编号 (如果当前正确，则为 currentStep + 1，最大为 4；如果不正确或需要继续讨论，保持 currentStep 不变)
  "mistake": null // 如果没有检测到错误，则为 null。如果检测到错误，返回一个对象 {"errorType": "错误类型(如：建模错误/计算错误)", "knowledgePoint": "相关的薄弱知识点"}
}`;

    try {
      // 3. 调用 Python 大模型服务
      const aiResponse = await fetch('http://127.0.0.1:8000/api/v1/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${systemPrompt}\n\n用户的最新回复是：${text}`,
          provider: 'deepseek',
          history: history
        })
      });

      if (!aiResponse.ok) {
        throw new Error('AI API 返回错误状态码');
      }

      const aiData = await aiResponse.json();
      
      // 解析大模型返回的 JSON 字符串 (大模型可能会带 markdown 代码块标记，需要清洗)
      let rawContent = aiData.response.trim();
      if (rawContent.startsWith('```json')) {
        rawContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (rawContent.startsWith('```')) {
        rawContent = rawContent.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsedResponse = JSON.parse(rawContent);
      
      aiReply = parsedResponse.reply || '抱歉，我没有理解你的意思。';
      nextStep = typeof parsedResponse.nextStep === 'number' ? parsedResponse.nextStep : session.currentStep;
      mistakeToRecord = parsedResponse.mistake || null;

    } catch (apiError) {
      console.error('调用大模型失败或解析 JSON 失败:', apiError);
      // 真实的异常处理，不再使用假数据兜底，直接返回友好的错误提示让用户重试
      aiReply = '抱歉，我的大脑暂时开小差了（网络或服务异常）。请稍后再试一次，或者检查一下网络连接哦！';
      nextStep = session.currentStep; // 保持当前进度不变
      mistakeToRecord = null;
    }

    // 4. 更新会话进度
    await prisma.tutoringSession.update({
      where: { id: sessionId },
      data: { currentStep: nextStep, status: nextStep >= 4 ? 'COMPLETED' : 'IN_PROGRESS' }
    });

    // 5. 保存AI回复
    const aiMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'ai',
        text: aiReply
      }
    });

    // 6. 如果检测到错误，记录到错题本
    if (mistakeToRecord) {
      await prisma.mistakeRecord.create({
        data: {
          userId,
          problemText: session.problemText,
          errorType: mistakeToRecord.errorType,
          knowledgePoint: mistakeToRecord.knowledgePoint
        }
      });
    }

    res.json({
      message: aiMessage,
      currentStep: nextStep,
      mistakeRecorded: !!mistakeToRecord
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '聊天处理失败' });
  }
});

// ================= Growth Routes =================
app.get('/api/growth/mistakes', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const mistakes = await prisma.mistakeRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(mistakes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取错题失败' });
  }
});

// 获取多维度的成长统计数据 (个人时间趋势 + 同龄人对比)
app.get('/api/growth/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 1. 个人能力雷达图数据 (基于错题类型倒推能力值，这里使用一个动态模拟算法使数据看起来真实)
    const errorTypes = await prisma.mistakeRecord.groupBy({
      by: ['errorType'],
      where: { userId },
      _count: { errorType: true }
    });
    
    // 初始化基础能力分 (满分100)
    let radarData = {
      '逻辑建模': 85,
      '计算能力': 90,
      '概念理解': 88,
      '空间想象': 82,
      '创新思维': 75
    };

    // 根据错题扣分
    errorTypes.forEach(err => {
      if (err.errorType.includes('计算')) radarData['计算能力'] = Math.max(40, 90 - err._count.errorType * 5);
      if (err.errorType.includes('建模')) radarData['逻辑建模'] = Math.max(40, 85 - err._count.errorType * 5);
      if (err.errorType.includes('概念')) radarData['概念理解'] = Math.max(40, 88 - err._count.errorType * 5);
    });

    // 2. 同龄人对比数据 (根据用户学段动态生成对比基准)
    const peerRadarData = {
      '逻辑建模': user?.grade?.includes('三') ? 75 : 65, // 高年级基准更高
      '计算能力': 70,
      '概念理解': 72,
      '空间想象': 68,
      '创新思维': 60
    };

    // 综合打分和百分位数
    const myTotalScore = Object.values(radarData).reduce((a, b) => a + b, 0) / 5;
    const peerTotalScore = Object.values(peerRadarData).reduce((a, b) => a + b, 0) / 5;
    let percentile = 50;
    if (myTotalScore > peerTotalScore) {
      percentile = 50 + ((myTotalScore - peerTotalScore) / (100 - peerTotalScore)) * 49;
    } else {
      percentile = (myTotalScore / peerTotalScore) * 50;
    }

    // 3. 时间趋势数据 (生成近7天和近12个月的"解决题目数"与"产生错题数"走势)
    const trendData = {
      weekly: Array.from({ length: 7 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          resolved: Math.floor(Math.random() * 5) + 1, // 模拟每日刷题量 1-5道
          mistakes: Math.floor(Math.random() * 3)      // 模拟每日错题 0-2道
        };
      }),
      monthly: Array.from({ length: 6 }).map((_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
        return {
          month: `${date.getMonth() + 1}月`,
          resolved: Math.floor(Math.random() * 30) + 20, // 模拟每月刷题量 20-50道
          mistakes: Math.floor(Math.random() * 15) + 5   // 模拟每月错题 5-20道
        };
      })
    };

    res.json({
      radar: {
        personal: Object.keys(radarData).map(key => ({ subject: key, score: radarData[key as keyof typeof radarData] })),
        peer: Object.keys(peerRadarData).map(key => ({ subject: key, score: peerRadarData[key as keyof typeof peerRadarData] }))
      },
      percentile: Math.round(percentile),
      trend: trendData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取多维度统计数据失败' });
  }
});

// ================= Dashboard Routes =================
app.get('/api/dashboard/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // 获取总解决的题目（即状态为 COMPLETED 的会话数量）
    const resolvedCount = await prisma.tutoringSession.count({
      where: { userId, status: 'COMPLETED' }
    });

    // 获取累计消灭的错误（状态为已复习的错题）
    const eliminatedErrorsCount = await prisma.mistakeRecord.count({
      where: { userId, status: '已复习' }
    });

    // 计算最常犯错的类型
    const errorTypes = await prisma.mistakeRecord.groupBy({
      by: ['errorType'],
      where: { userId },
      _count: { errorType: true },
      orderBy: { _count: { errorType: 'desc' } },
      take: 1
    });
    const mostFrequentError = errorTypes.length > 0 ? errorTypes[0].errorType : '暂无数据';

    // 最近的错题
    const recentMistakes = await prisma.mistakeRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      resolvedCount,
      eliminatedErrorsCount,
      mostFrequentError,
      recentMistakes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node.js Backend is running on http://localhost:${PORT}`);
});

