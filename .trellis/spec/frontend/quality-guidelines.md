# Quality Guidelines

> 前端代码质量要求以“少引入新抽象，保持单一真相，保证跨端可用”为核心。

---

## Forbidden Patterns

### 1. 主题颜色写死在组件规则里

问题：

- 主题切换会漏改
- 视觉变体无法复用

正确做法：

- 先定义 token，再让组件消费 token

### 2. 改服务端 payload，却不改前端 handler

问题：

- WebSocket / HTTP 边界最容易出现静默错误

正确做法：

- 同步检查 `SERVER_MESSAGE_HANDLERS`、缓存更新、UI 渲染分支

### 3. 直接操作 DOM，绕过源状态

问题：

- 下次重渲染会把 UI 覆盖回旧值

### 4. 未经转义把外部字符串塞进 `innerHTML`

问题：

- XSS 风险
- UI 结构污染

---

## Required Patterns

- 修改常量前先搜索全仓库
- 新增本地存储 key 时使用 `webcoding-*`
- 主题改动同时检查登录页、主界面、移动端
- 大块 UI 变动优先沿用现有渲染批处理和状态更新路径
- 发现规则缺口时回写 `.trellis/spec/`

---

## Testing Requirements

### 纯视觉 / 主题 / 布局改动

- 手工检查桌面端
- 手工检查移动端
- 至少检查登录页、会话页、设置面板

### 交互改动

- 检查按钮、弹层、输入区、滚动、切换 agent / mode

### 涉及后端消息或存储的改动

- 联动阅读后端规范
- 必要时执行 `npm run regression`

### Android app / Capacitor 验证

如果改动涉及 `android-app/` 或移动端连接链路，手工验证不能只停留在“能启动”：

- 至少验证一次连接建立，而不是只看连接页
- 明确当前是 Emulator 还是真机
- Emulator 连宿主机服务时，优先验证 `http://10.0.2.2:3000`
- 如果使用 Tunnel，先在设备浏览器里打开 `/health`，确认地址仍然有效
- 请求失败时，不要只记录 `Failed to fetch`，要把连接地址类型也记录下来

---

## Code Review Checklist

- 是否沿用了 `public/app.js` 现有结构
- 是否引入了不必要的新文件或新抽象
- 是否存在重复状态或重复常量
- 是否所有外部文本都做了安全处理
- 是否检查了移动端和主题模式
