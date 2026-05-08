# JobHunter Pro 使用指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 演示模式（无需登录）

```bash
npm run apply -- --demo -k "Java AI应用开发"
```

### 3. 真实投递模式

#### 安装 Puppeteer（如需自动登录）

```bash
npm install puppeteer
```

#### 登录 Boss 直聘

```bash
npm run login
```

系统会提示您输入手机号和密码，自动完成登录并保存 Cookie。

#### 搜索职位

```bash
npm run search -- -k "Java AI应用开发" -c "北京"
```

#### 批量投递

```bash
npm run apply -- -k "Java AI应用开发" -l 20 --auto-login
```

- `--auto-login`: Cookie 失效时自动重新登录
- `-l 20`: 投递数量限制

### 4. Web 界面

```bash
npm run serve
# 访问 http://localhost:3000
```

## Cookie 管理

Cookie 保存在 `data/cookies.json`，有效期 24 小时。

- **自动保存**: 使用 `login` 命令登录后自动保存
- **自动刷新**: 使用 `--auto-login` 选项时自动检测并刷新
- **手动管理**: 可直接编辑 `data/cookies.json`

## 常见问题

### Q: Cookie 过期怎么办？

使用 `--auto-login` 选项，程序会自动提示重新登录。

### Q: Puppeteer 下载失败？

由于网络限制，Puppeteer 的 Chromium 可能下载失败。可尝试：

1. 使用国内镜像：
```bash
PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors npm install puppeteer
```

2. 或使用演示模式测试功能

### Q: 如何投递其他岗位？

```bash
# Python 开发
npm run search -- -k "Python AI" -c "上海"

# 前端开发
npm run search -- -k "前端工程师" -c "深圳"
```

## 注意事项

- 请遵守 Boss 直聘的服务条款
- 合理设置投递频率，避免账号被封
- 本工具仅供学习交流使用
