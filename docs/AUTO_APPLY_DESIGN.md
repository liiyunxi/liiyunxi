# Boss直聘自动化投递方案

## 概述

本方案实现真正的浏览器自动化投递功能，通过 Puppeteer 模拟人工操作完成简历投递。

## 投递流程

```
开始投递
  ↓
检查登录状态
  ↓ (未登录)
提示登录
  ↓ (已登录)
搜索职位列表
  ↓
遍历职位
  ├─→ 进入职位详情页
  ├─→ 检查是否已投递
  ├─→ 点击"立即沟通"按钮
  ├─→ 处理投递确认弹窗
  ├─→ 等待投递结果
  ├─→ 记录投递状态
  └─→ 延迟等待
  ↓
投递完成 → 生成报告
```

## 核心功能

### 1. 浏览器控制 (BrowserManager)
- 启动无头/有头浏览器
- 登录状态管理
- Cookie 持久化
- 页面导航

### 2. 职位搜索 (JobSearcher)
- 搜索条件构建
- 职位列表解析
- 分页处理
- 职位链接提取

### 3. 自动投递 (AutoApplier)
- 职位详情页访问
- 投递按钮点击
- 弹窗处理
- 异常处理

### 4. 反检测措施 (AntiDetection)
- 随机延迟
- 鼠标轨迹模拟
- User-Agent 轮换
- 请求间隔随机化

## 技术实现

### BrowserManager
```javascript
- launch(): 启动浏览器
- login(credentials): 登录
- navigate(url): 页面导航
- waitForSelector(selector): 等待元素
- click(selector): 点击元素
- evaluate(script): 执行脚本
- getCookies(): 获取Cookie
- close(): 关闭浏览器
```

### JobSearcher
```javascript
- search(keyword, city): 搜索职位
- parseJobList(): 解析职位列表
- getJobLinks(): 获取职位链接
- hasNextPage(): 检查是否有下一页
- nextPage(): 翻页
```

### AutoApplier
```javascript
- applyForJob(jobUrl): 投递单个职位
- checkAppliedStatus(): 检查投递状态
- clickApplyButton(): 点击投递按钮
- handleConfirmDialog(): 处理确认弹窗
- waitForResult(): 等待结果
- isCaptchaShown(): 检测验证码
- handleCaptcha(): 处理验证码
```

## 反爬虫策略

### 1. 请求间隔
- 基础延迟：3-8秒
- 随机抖动：±1-2秒
- 投递间隔：30-60秒

### 2. 用户行为模拟
- 随机鼠标移动
- 滚动页面
- 停留时间随机化

### 3. 请求头优化
- 真实的 User-Agent
- 合理的 Accept-Language
- 完整的 Referer 链

## 异常处理

### 1. 网络异常
- 自动重试（最多3次）
- 指数退避策略

### 2. UI 异常
- 元素未找到：等待 + 重试
- 弹窗阻塞：处理弹窗
- 页面卡住：刷新页面

### 3. 业务异常
- 已投递职位：跳过
- 职位已下架：跳过
- 投递失败：记录 + 继续

## 状态管理

### 投递状态
- `pending`: 待投递
- `applying`: 投递中
- `success`: 投递成功
- `failed`: 投递失败
- `skipped`: 已跳过
- `duplicate`: 重复投递

### 记录字段
- jobId: 职位ID
- jobTitle: 职位名称
- company: 公司名称
- salary: 薪资范围
- status: 投递状态
- appliedAt: 投递时间
- error: 错误信息（如有）

## 性能优化

### 1. 并发控制
- 单个浏览器实例
- 串行投递（避免被封）
- 可配置的延迟间隔

### 2. 缓存策略
- Cookie 缓存（24小时有效）
- 职位列表缓存
- 避免重复请求

### 3. 资源管理
- 及时关闭页面
- 定期清理内存
- 监控资源使用

## 安全建议

1. **遵守平台规则**
   - 设置合理的投递上限
   - 使用随机延迟
   - 避免高频操作

2. **保护账号安全**
   - 定期更换 Cookie
   - 监控账号状态
   - 异常登录提醒

3. **数据安全**
   - 加密存储凭证
   - 日志脱敏处理
   - 定期清理缓存

## 测试验证

### 本地测试
```bash
npm run apply -- --demo
npm run apply -- --keyword "Java" --city "北京" --limit 10
```

### 监控验证
- 查看投递日志
- 检查成功率
- 验证职位匹配度

## 部署建议

### Docker 环境
- 使用 Puppeteer 官方镜像
- 配置 Chrome 参数
- 设置资源限制

### 生产环境
- 日志收集和分析
- 性能监控
- 异常告警
