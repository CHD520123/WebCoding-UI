# Webcoding Android App

这是 `webcoding` 的 Android app 子工程骨架，采用 `Capacitor + 静态 www` 方案，目标是先跑通：

- 连接页
- 多连接列表
- 二维码 / JSON 导入
- 移动精简工作区
- 双 Tab：`会话` / `设置`
- 默认 `cc-web` 主题

## 当前状态

- `npm install` 已可完成
- `npx cap add android` 已成功生成 `android/` 原生工程
- `npx cap sync android` 已可同步 Web 资源与插件
- 当前仓库已经具备继续接入 Android Studio / 真机调试的基础

## 连接导入 JSON

支持以下结构化 JSON：

```json
{
  "kind": "webcoding_connection",
  "version": 1,
  "name": "我的公网 Tunnel",
  "baseUrl": "https://example.trycloudflare.com",
  "password": "optional-password"
}
```

也支持批量：

```json
{
  "kind": "webcoding_connections",
  "version": 1,
  "connections": [
    {
      "name": "办公室主机",
      "baseUrl": "http://192.168.1.20:3000"
    },
    {
      "name": "公网 Tunnel",
      "baseUrl": "https://example.trycloudflare.com"
    }
  ]
}
```

单连接 JSON 也支持直接带认证信息，方便从 Web 端导出后给 app 扫码导入：

```json
{
  "kind": "webcoding_connection",
  "version": 1,
  "name": "当前 Tunnel",
  "baseUrl": "https://example.trycloudflare.com",
  "token": "current-auth-token"
}
```

## 当前实现范围

- 已接入服务端 `/health` 检测
- 已接入 WebSocket 登录、会话列表、会话加载、发送消息、停止、实时流同步
- 已接入控制权状态展示
- 已接入掉线自动重连，并尽量保留当前会话视图
- 已提供远程任务入口和本地草稿保存
- Web 端设置面板可导出 app 导入二维码 / 连接 JSON

## 本地开发命令

在仓库根目录：

```bash
npm run app:install
npm run app:check
npm run app:android:sync
npm run app:android:open
```

或在 `android-app/` 目录：

```bash
npm install
npm run check
npm run cap:sync
npm run cap:open
```

## Android 环境要求

要真正编译 / 运行 Android app，本机还需要：

- Java 17 或兼容版本
- `JAVA_HOME`
- Android Studio
- Android SDK
- `ANDROID_HOME` 或 `ANDROID_SDK_ROOT`

当前这台机器在尝试执行 `./android/gradlew -v` 时，返回的是：

```text
ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

所以现在已经完成“生成原生工程”，但还没有达到“本机可编译 APK”的状态。

## 下一步运行方式

1. 安装 Java 和 Android Studio。
2. 配置 `JAVA_HOME` 与 Android SDK 环境变量。
3. 在 `android-app/` 下执行 `npm run cap:open`。
4. 用 Android Studio 打开 `android/` 工程。
5. 连接真机或启动模拟器后运行。

## Android Emulator 连接说明

如果 app 跑在 Android Emulator 里，而 `webcoding` 服务跑在当前开发机本机：

- 不要在 app 里填写 `http://localhost:3000`
- 也不要填写 `http://127.0.0.1:3000`
- 优先填写：

```text
http://10.0.2.2:3000
```

因为在 Android Emulator 里，`localhost` 指向的是模拟器自己，不是宿主机服务。

如果你使用的是局域网 `http://` 地址，除了连接地址写对，还需要重新安装最新 app 包：

- Android WebView 对明文 HTTP 的限制比桌面浏览器更严格
- Capacitor Android 默认本地壳层通常跑在 `https://localhost`，访问 `http://10.0.2.2:8001` 会命中 mixed content 限制
- 仅改 Web 代码不够，涉及 Manifest / 网络安全配置时必须重新 `Run` 安装新包
- 当前项目已经开启 Android `allowMixedContent` 与原生 cleartext 放行；改完后必须重新安装新包才能生效
- 改完原生配置后，建议先卸载模拟器里的旧 app，再重新安装

如果你使用的是 Cloudflare Tunnel：

- Tunnel 地址是随机的，不要假设上一次的地址今天还有效
- 最好先在模拟器浏览器里直接打开 `https://你的-tunnel/health`
- 能打开后，再回 app 里连接

## 建议先验证的 5 个闭环

1. 从 Web 端 Tunnel 面板扫码，把连接导入 app。
2. app 成功连接到当前 PC 端服务。
3. 打开已有会话，确认能看到与 PC 同步的消息流。
4. 在 app 端发送消息，确认自动接管控制权。
5. 临时断网再恢复，确认自动重连后还能继续同步。

## 当前未完成

- 远程 SSH 任务还没有对应服务端执行接口，目前先保留入口与草稿结构
- 还没有在具备 Java / Android SDK 的机器上完成 APK 编译与真机验证
