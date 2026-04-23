# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Cross-Platform Runtime Assumptions

**Bad**: Assuming browser, Android WebView, Emulator, Tunnel, and desktop localhost all behave the same

Typical failure pattern:

- Web 端 `fetch("http://localhost:3000/health")` 正常
- Android Emulator 中同样地址失败，因为 `localhost` 指向模拟器自己
- 临时 Tunnel 地址昨天可用，今天已经失效
- 桌面浏览器能访问，Android WebView 因 cleartext 或网络策略失败

**Good**: Treat runtime environment as part of the contract

For Android / Capacitor validation, explicitly check:

- app 运行在浏览器、Android Studio 模拟器，还是手机真机
- 服务端运行在宿主机、局域网另一台机器，还是公网 Tunnel
- 连接地址是 `10.0.2.2`、局域网 IP，还是 `trycloudflare.com`
- 请求失败是 DNS、cleartext、CORS、鉴权，还是服务端不在线

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens
- [ ] If mobile / emulator involved, mapped runtime network path as well

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] Verified environment-specific addresses (`localhost` vs `10.0.2.2` vs LAN IP vs Tunnel)

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
