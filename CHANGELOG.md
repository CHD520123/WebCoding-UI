# 更新日志

当前仓库已经按当前代码基线重建 Git 历史。以下内容只描述当前版本实际包含的能力，不再沿用旧项目版本记录。

## v1.4.2（2026-04-23）

### Web 工作台

- 支持 Claude 与 Codex 双 Agent 会话，保持同一套浏览器工作台与后台任务模型。
- 支持本地 Web 访问、局域网访问，以及通过 Cloudflare Tunnel 暴露随机公网 HTTPS 地址。
- 支持密码认证、首次登录改密、通知配置、模型与模式切换。
- 支持会话列表、项目分组、历史导入、运行态同步、工具调用展示与 Git 面板。
- 支持本地 bridge 与 runtime 适配层，统一处理 Claude / Codex 的会话恢复和事件流。

### Android app

- 新增 `android-app/` 子工程，采用 `Capacitor + 静态 www` 方案。
- 支持多连接管理、二维码 / JSON 导入、`/health` 检测与 WebSocket 登录。
- 支持按目录分组的会话列表，以及“会话列表页 / 会话详情页”分离的移动工作区。
- 支持顶部运行态提示、工具卡前置、工具摘要收敛、控制权状态展示与自动重连。
- 支持 `cc-web` 与 `webcoding` 两套移动端主题。

### 同步与远程体验

- Web 与 Android app 之间支持会话记录同步、控制态同步和低频自动重同步兜底。
- Web 设置面板可导出 app 导入二维码与连接 JSON，便于从桌面端把 Tunnel 连接交给手机端使用。
- Android Emulator 访问宿主机服务时，支持 `http://10.0.2.2:8001` 这类本地开发地址。

### 开发工具

- 根目录新增 Android 相关脚本：
  - `npm run app:install`
  - `npm run app:check`
  - `npm run app:android:sync`
  - `npm run app:android:open`
- 保留 `npm run regression` 作为当前 Web 主路径回归入口。
