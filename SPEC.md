# Boss直聘自动投递简历工具 - 技术规范文档

## 1. 概念与愿景

**JobHunter Pro** — 一款专为求职者设计的智能简历投递辅助工具。核心价值在于节省求职者筛选和投递简历的时间成本，让求职者能够更专注于面试准备而非机械化的重复操作。

本工具提供两种使用模式：
1. **命令行工具**：适合技术用户，支持脚本化、自动化调度
2. **Web演示界面**：适合展示和快速验证，支持实时可视化数据分析

> ⚠️ **重要声明**：本工具仅供学习与演示目的。实际使用时必须遵守目标网站的服务条款和爬虫政策，务必在法律和道德框架内使用。

## 2. 设计语言

### 美学方向
采用 **"数字极客"** 美学 — 结合赛博朋克的霓虹感与极简主义的克制，营造专业、高效、科技感十足的使用体验。

### 配色方案
```css
--bg-primary: #0a0e17;        /* 深空蓝黑 */
--bg-secondary: #111827;       /* 次级背景 */
--bg-card: #1a2332;            /* 卡片背景 */
--accent-primary: #00d4aa;     /* 主强调色-电子绿 */
--accent-secondary: #6366f1;   /* 次强调色-靛蓝 */
--accent-tertiary: #f59e0b;    /* 第三强调色-琥珀 */
--text-primary: #f1f5f9;       /* 主文字 */
--text-secondary: #94a3b8;     /* 次级文字 */
--border: #2d3a4d;              /* 边框色 */
--success: #10b981;             /* 成功状态 */
--warning: #f59e0b;             /* 警告状态 */
--error: #ef4444;               /* 错误状态 */
```

### 字体选择
- **Display**: "JetBrains Mono" — 代码感、技术感
- **Body**: "Inter" — 清晰可读
- **Chinese**: "Noto Sans SC" — 中文支持

### 动效哲学
- 入场动画：元素从下方滑入 + 透明度渐变，延迟 50ms 交错
- 数据更新：数字变化使用弹性动画
- 悬停效果：轻微上浮 + 发光边框
- 进度指示：流光效果 + 脉冲动画

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        JobHunter Pro                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   CLI Client    │    │  Web Interface  │    │   Scheduler  │ │
│  │  (命令行工具)    │    │   (网页演示)    │    │   (定时任务)  │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬───────┘ │
│           │                        │                     │        │
│           └────────────────────────┼─────────────────────┘        │
│                                    │                              │
│                          ┌─────────▼─────────┐                    │
│                          │   Core Engine     │                    │
│                          │  (核心引擎)        │                    │
│                          └─────────┬─────────┘                    │
│                                    │                              │
│  ┌─────────────────────────────────┼─────────────────────────────┐│
│  │                    Module Layer                    │          │
│  ├───────────────┬───────────────┬───────────────┬───────────────┤│
│  │ JobScraper    │ AutoApplier   │ ResumeManager │ DataAnalytics ││
│  │ (职位爬虫)    │ (自动投递)    │ (简历管理)    │ (数据分析)   ││
│  └───────────────┴───────────────┴───────────────┴───────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 模块职责

#### 3.1 Core Engine (核心引擎)
```typescript
interface EngineConfig {
  cookies: CookieManager;        // Cookie管理
  requestThrottle: number;       // 请求节流(ms)
  retryPolicy: RetryPolicy;      // 重试策略
  proxyRotation: ProxyPool;      // 代理池轮换
}
```

#### 3.2 JobScraper (职位爬虫)
- 关键词搜索职位列表
- 解析职位详情（薪资、技能要求、福利）
- 过滤重复职位
- 支持分页爬取

#### 3.3 AutoApplier (自动投递)
- 模拟用户登录态
- 构建投递请求
- 投递频率控制（避免封号）
- 投递结果记录

#### 3.4 ResumeManager (简历管理)
- 简历模板管理
- 简历与职位匹配度分析
- 一键切换简历

#### 3.5 DataAnalytics (数据分析)
- 投递成功率统计
- 薪资分布分析
- 投递趋势可视化
- 职位匹配度热力图

## 4. 数据模型

### 4.1 职位数据
```typescript
interface JobPosition {
  id: string;                    // 职位ID
  title: string;                 // 职位名称
  company: string;               // 公司名称
  companyLogo?: string;          // 公司Logo
  salary: { min: number; max: number; currency: string };
  location: string;              // 工作地点
  experience: string;            // 经验要求
  education: string;             // 学历要求
  tags: string[];                // 技能标签
  welfare: string[];              // 福利标签
  description: string;           // 职位描述
  hrName: string;                // HR名称
  hrAvatar?: string;             // HR头像
  postedTime: string;            // 发布时间
  applyStatus: 'pending' | 'applied' | 'viewed' | 'interview';
  matchScore?: number;           // 匹配度分数
}
```

### 4.2 投递记录
```typescript
interface ApplicationRecord {
  id: string;
  jobId: string;
  position: JobPosition;
  appliedAt: Date;
  status: 'success' | 'failed' | 'duplicate' | 'expired';
  responseTime?: Date;
  notes?: string;
}
```

### 4.3 会话统计
```typescript
interface SessionStats {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalScraped: number;
  totalApplied: number;
  successRate: number;
  averageSalary: number;
  topCompanies: { name: string; count: number }[];
}
```

## 5. API 设计

### 5.1 核心接口
```typescript
// 搜索职位
GET /api/jobs/search?keyword=前端&city=北京&experience=1-3&salary=20-40

// 获取职位详情
GET /api/jobs/:id

// 投递简历
POST /api/apply
Body: { jobId: string, resumeId: string }

// 获取投递历史
GET /api/applications?page=1&limit=20

// 获取统计报表
GET /api/analytics/summary?range=7d

// 上传简历
POST /api/resumes/upload
```

### 5.2 WebSocket 实时事件
```typescript
// 投递进度
{ type: 'application_progress', data: { current: 5, total: 20, jobTitle: '前端工程师' } }

// 实时日志
{ type: 'log', data: { level: 'info', message: '正在投递: xxx公司', timestamp: '...' } }

// 统计更新
{ type: 'stats_update', data: { totalApplied: 15, successRate: 0.85 } }
```

## 6. 数据可视化方案

### 6.1 仪表盘布局
```
┌─────────────────────────────────────────────────────────────────┐
│  📊 JobHunter Pro Dashboard                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ 本周投递  │  │ 面试机会  │  │ 平均薪资  │  │ 成功率   │            │
│  │   47    │  │    8     │  │  ¥28.5K  │  │  78.5%  │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                 │
│  ┌───────────────────────────────┐  ┌─────────────────────────┐│
│  │      📈 投递趋势图             │  │    🏢 公司分布          ││
│  │                               │  │                         ││
│  │    ~~~$     ___               │  │   [饼图/柱状图]         ││
│  │         ___/   \___          │  │                         ││
│  │  _____/              \       │  │                         ││
│  └───────────────────────────────┘  └─────────────────────────┘│
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  📋 最近投递记录                                          │ │
│  │  ─────────────────────────────────────────────────────── │ │
│  │  [职位名称] [公司] [薪资] [状态] [时间]                    │ │
│  │  ...                                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 可视化组件
- **KPI卡片**：关键指标展示，带趋势指示器
- **折线图**：投递数量随时间变化
- **柱状图**：薪资分布区间
- **饼图**：投递状态分布
- **热力图**：投递时间段分析
- **词云**：热门技能标签

## 7. 核心爬取逻辑

### 7.1 请求头模拟
```typescript
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.zhipin.com/',
  'Cookie': '/* 需要有效的登录Cookie */',
};
```

### 7.2 反爬策略
1. **请求频率控制**：每分钟不超过 60 次请求
2. **代理轮换**：使用代理池避免 IP 被封
3. **随机延迟**：请求间隔添加 1-3 秒随机延迟
4. **Cookie 管理**：定期刷新 Cookie
5. **分布式爬取**：多节点协同，分散请求压力

### 7.3 数据解析流程
```
HTML响应 → Cheerio解析 → 数据清洗 → 格式验证 → 存储入库
```

## 8. 技术栈选择

### 后端
- **运行时**：Node.js 18+
- **框架**：Express.js / Fastify
- **爬虫**：Puppeteer (无头浏览器) + 原生 HTTP 请求
- **数据**：SQLite (本地轻量存储)
- **实时**：Socket.IO / WebSocket

### 前端
- **框架**：原生 HTML + CSS + JavaScript (零依赖演示版)
- **图表**：Chart.js (轻量级可视化)
- **图标**：Lucide Icons (SVG图标库)

### CLI工具
- **框架**：Commander.js
- **交互**：Inquirer.js
- **日志**：Pino

## 9. 文件结构
```
jobhunter-pro/
├── src/
│   ├── core/
│   │   ├── engine.js           # 核心引擎
│   │   ├── scraper.js         # 爬虫模块
│   │   ├── applier.js         # 投递模块
│   │   └── analytics.js       # 分析模块
│   ├── cli/
│   │   └── index.js           # CLI入口
│   ├── web/
│   │   ├── index.html         # Web演示页
│   │   ├── styles.css         # 样式表
│   │   └── app.js             # 前端逻辑
│   └── data/
│       └── demo-data.js       # 演示数据
├── package.json
├── SPEC.md
└── README.md
```

## 10. 安全与合规

### 必须遵守
- ✅ 遵守 robots.txt 协议
- ✅ 设置合理的请求频率
- ✅ 不采集个人隐私数据
- ✅ 不用于商业盈利目的

### 严格禁止
- ❌ 绕过登录验证
- ❌ 批量注册账号
- ❌ 干扰网站正常运行
- ❌ 数据买卖与泄露

## 11. 使用示例

### CLI 使用
```bash
# 安装依赖
npm install

# 搜索职位
node src/cli/index.js search -k "前端工程师" -c "北京" -p 20-40

# 批量投递
node src/cli/index.js apply -k "前端工程师" --limit 50

# 查看统计
node src/cli/index.js stats --range 7d

# 启动Web服务
node src/cli/index.js serve --port 3000
```

### Web界面使用
1. 打开 `src/web/index.html`
2. 输入搜索关键词
3. 点击"开始演示"
4. 查看实时数据可视化
