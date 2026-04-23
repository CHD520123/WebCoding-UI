# Webcoding 项目索引

## 项目概述

Webcoding 是一个面向 Claude Code / Codex CLI 的浏览器工作台。当前仓库同时包含：

- 桌面 / 浏览器端主应用
- Node.js 后端与运行时适配层
- Android app 子工程（`Capacitor + 静态 www`）

当前文档基于仓库现状整理，不引用旧仓库历史描述。

## 当前状态

- 当前版本：`1.4.2`
- 最后整理：`2026-04-23`
- 当前主分支：`main`
- 当前定位：继续迭代中的 Web + Android 双端远程工作台

## 常用命令

```bash
npm install
npm start
npm run regression
npm run app:install
npm run app:check
npm run app:android:sync
npm run app:android:open
```

## 关键目录

```text
webcoding/
├── server.js                    # 后端主入口：HTTP、WebSocket、会话、进程、Tunnel、配置
├── lib/
│   ├── agent-runtime.js         # Claude / Codex 运行时适配
│   ├── codex-rollouts.js        # Codex 本地 rollout 导入解析
│   ├── local-api-bridge.js      # 本地 bridge 服务
│   └── cf-tunnel.js             # Cloudflare Tunnel 辅助逻辑
├── public/
│   ├── index.html               # Web 主界面骨架
│   ├── app.js                   # Web 前端主逻辑
│   ├── style.css                # Web 前端样式
│   ├── sw.js                    # Service Worker
│   └── assets/                  # Web 展示素材
├── android-app/
│   ├── package.json             # Android 子工程脚本
│   ├── www/                     # 移动端 Web 壳与逻辑
│   └── android/                 # 原生 Android 工程
├── scripts/
│   ├── regression.js            # 回归脚本
│   ├── mock-claude.js           # Claude mock CLI
│   └── mock-codex.js            # Codex mock CLI
├── deploy/                      # 部署模板
├── README.md                    # 中文说明
├── README.en.md                 # 英文说明
└── CHANGELOG.md                 # 当前版本记录
```

## 当前代码规模

```text
server.js                    7199 行
public/app.js                7728 行
public/style.css             7996 行
scripts/regression.js        3728 行
android-app/www/src/main.js  1325 行
android-app/www/styles.css    874 行
```

## Web 主应用

### 入口文件

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/style.css`

### 当前真实能力

- Claude / Codex 双 Agent 会话
- 密码认证与首次改密
- 会话创建、切换、重命名、删除
- Claude / Codex 本地历史导入
- 工具调用与流式消息展示
- Git 面板
- 项目分组与目录选择
- 通知配置
- Cloudflare Tunnel 远程访问
- 本地 bridge 与 runtime 适配

### 关键联动文件

- `server.js`：协议、会话、进程、配置、Tunnel
- `lib/agent-runtime.js`：不同 Agent 的启动与事件解析
- `lib/local-api-bridge.js`：bridge 与统一 API 兼容
- `public/app.js`：Web UI 状态、渲染、Socket 消息消费
- `scripts/regression.js`：核心回归验证

## Android app

### 入口文件

- `android-app/www/index.html`
- `android-app/www/src/main.js`
- `android-app/www/styles.css`
- `android-app/android/app/src/main/AndroidManifest.xml`

### 当前真实能力

- 多连接保存与切换
- 二维码 / JSON 导入连接
- `/health` 检测
- WebSocket 登录与会话同步
- 目录分组会话列表
- 会话详情页工作区
- 顶部运行态与控制态提示
- 工具卡摘要收敛
- 自动重连与低频重同步
- `cc-web` / `webcoding` 主题切换

### 当前限制

- 远程 SSH 任务目前只保留入口与草稿结构，未接入执行接口
- Android 端仍以当前仓库内置 UI 与同步链路为主，后续还会继续打磨交互和视觉细节

## 运行期目录

以下目录主要在运行时生成或写入：

- `config/`
- `sessions/`
- `logs/`
- `attachments/`
- `test-results/`

## 阅读顺序建议

如果你要继续开发，建议按这个顺序读：

1. `README.md`
2. `server.js`
3. `public/app.js`
4. `lib/agent-runtime.js`
5. `android-app/README.md`
6. `android-app/www/src/main.js`
