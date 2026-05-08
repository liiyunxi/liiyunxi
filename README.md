# JobHunter Pro

Boss直聘简历自动投递工具 - 支持浏览器自动化登录、Cookie管理、Web界面实时监控

[English](./README_EN.md) | 简体中文

## ✨ 特性

- 🔐 **浏览器自动化登录** - 使用 Puppeteer 实现 Boss 直聘自动登录
- 🍪 **智能 Cookie 管理** - 自动保存和加载登录状态（24小时有效期）
- 🌐 **Web 界面** - 可视化控制面板，支持登录控制和实时投递监控
- ⚡ **WebSocket 实时推送** - 投递进度实时更新
- 💻 **CLI 工具** - 命令行批量投递简历
- 📊 **数据分析** - 投递统计和可视化图表
- 🎯 **演示模式** - 无需登录即可体验完整功能

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 演示模式（无需登录）

```bash
npm run apply -- --demo -k "Java AI应用开发"
```

### 真实投递模式

#### 1. 安装 Puppeteer（如需自动登录）

```bash
npm install puppeteer
```

如果 Puppeteer 下载失败，可使用国内镜像：

```bash
PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors npm install puppeteer
```

#### 2. 登录 Boss 直聘

```bash
npm run login
```

系统会提示输入手机号和密码，自动完成登录并保存 Cookie。

#### 3. 搜索职位

```bash
npm run search -- -k "Java AI应用开发" -c "北京"
```

#### 4. 批量投递

```bash
npm run apply -- -k "Java AI应用开发" -l 20 --auto-login
```

参数说明：
- `-k`: 搜索关键词
- `-c`: 城市
- `-l`: 投递数量限制
- `--auto-login`: Cookie 失效时自动重新登录
- `--demo`: 演示模式
- `--headless`: 无头模式运行

### Web 界面

```bash
npm run web
# 或
npm run serve

# 访问 http://localhost:3000
```

Web 界面功能：
1. Boss 直聘登录
2. 设置搜索条件
3. 开始投递
4. 实时监控投递进度
5. 演示模式

## 📁 项目结构

```
jobhunter-pro/
├── src/
│   ├── core/
│   │   ├── engine.js           # 核心引擎
│   │   ├── browser.js          # 浏览器自动化 (Puppeteer)
│   │   ├── scraper.js          # 职位爬虫
│   │   ├── applier.js          # 投递模块
│   │   └── analytics.js        # 数据分析
│   ├── cli/
│   │   └── index.js            # CLI 入口
│   ├── web/
│   │   ├── index.html          # Web 界面
│   │   └── app.js              # 前端逻辑
│   └── server.js               # Express + WebSocket 服务器
├── data/
│   └── cookies.json            # 登录 Cookie 存储
├── package.json
├── SPEC.md                     # 技术规格说明
├── USAGE.md                    # 详细使用指南
└── README.md
```

## 🛠 技术栈

### 后端
- **运行时**：Node.js 18+
- **框架**：Express.js
- **爬虫**：Puppeteer (无头浏览器) + 原生 HTTP 请求
- **数据**：SQLite (本地轻量存储)
- **实时**：WebSocket

### 前端
- **框架**：原生 HTML + CSS + JavaScript
- **图表**：Chart.js (轻量级可视化)

### CLI 工具
- **框架**：Commander.js
- **交互**：Inquirer.js
- **日志**：Pino

## ⚠️ 注意事项

- 请遵守 Boss 直聘的服务条款
- 合理设置投递频率，避免账号被封
- Cookie 有效期为 24 小时，过期后需重新登录
- 本工具仅供学习交流使用

## 📝 License

MIT License

## 🙏 致谢

- [Puppeteer](https://github.com/puppeteer/puppeteer) - 浏览器自动化
- [Boss 直聘](https://www.zhipin.com) - 求职平台
