# Webcoding

Webcoding is a browser workspace for Claude Code and Codex. The current repository contains both the main web application and an Android app subproject, so you can use the same sessions from desktop browser, remote browser access, and mobile app.

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

[中文 README](./README.md) | [Changelog](./CHANGELOG.md)

## What is included

- A Node.js backend with HTTP, WebSocket, session storage, process recovery, notifications, Git helpers, and Cloudflare Tunnel support.
- A browser-based desktop UI in `public/`.
- An Android app shell in `android-app/`, built with Capacitor and a static `www` bundle.
- Runtime adapters for both Claude and Codex.

## Current feature set

- Claude / Codex dual-agent sessions
- Password-based login with first-login password reset
- Session create, load, rename, delete, and resume flows
- Claude local history import and Codex rollout import
- Streaming output and tool-call rendering
- Project grouping and working-directory selection
- Built-in Git panel in the web UI
- Notification settings
- Cloudflare Tunnel based remote access
- Android app connection import via QR code or JSON
- Session sync between web and Android app
- Android mobile workspace with grouped sessions, detail page, runtime status, and reconnect handling

## Requirements

- Node.js >= 18
- Claude Code CLI and/or Codex CLI installed

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @openai/codex
```

## Quick start

Clone the current repository:

```bash
git clone https://github.com/CHD520123/WebCoding-UI.git
cd WebCoding-UI
npm install
npm start
```

Then open:

```text
http://localhost:8001
```

On first startup, the server generates a password automatically if no password is configured yet.

## Root scripts

```bash
npm start
npm run regression
npm run app:install
npm run app:check
npm run app:android:sync
npm run app:android:open
```

## Android app

The Android app lives in `android-app/`.

Current implementation includes:

- saved connection list
- `/health` validation
- WebSocket login
- session list sync
- grouped session directories
- dedicated session detail page
- runtime status banner
- tool cards with collapsed summaries
- reconnect and passive re-sync
- `cc-web` and `webcoding` themes

Useful commands:

```bash
npm run app:install
npm run app:check
npm run app:android:sync
npm run app:android:open
```

Android-specific package scripts are also available inside `android-app/`:

```bash
npm install
npm run check
npm run cap:sync
npm run cap:open
```

## Project structure

```text
webcoding/
├── server.js
├── lib/
├── public/
├── android-app/
├── scripts/
├── deploy/
├── README.md
├── README.en.md
├── CHANGELOG.md
└── PROJECT.md
```

## Important source files

- `server.js`: backend entrypoint
- `lib/agent-runtime.js`: Claude / Codex runtime adapter
- `lib/local-api-bridge.js`: local bridge service
- `public/app.js`: desktop web UI logic
- `android-app/www/src/main.js`: Android mobile UI logic
- `scripts/regression.js`: regression coverage for the main web flow

## Runtime-generated directories

These directories are created or written at runtime:

- `config/`
- `sessions/`
- `logs/`
- `attachments/`
- `test-results/`

## Current repository scope

This repository now documents the current baseline only. If you are reading old screenshots, old tags, or old release notes elsewhere, they do not describe the current Git history anymore.
