function toHttpUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

function toWsUrl(baseUrl) {
  const normalized = toHttpUrl(baseUrl);
  if (!normalized) return '';
  if (normalized.startsWith('https://')) return `${normalized.replace(/^https:/, 'wss:')}/ws`;
  if (normalized.startsWith('http://')) return `${normalized.replace(/^http:/, 'ws:')}/ws`;
  return `${normalized}/ws`;
}

function buildHealthError(baseUrl, error) {
  const normalized = toHttpUrl(baseUrl);
  const target = normalized ? `${normalized}/health` : '/health';
  const rawMessage = String(error?.message || '').trim();
  const hints = [];

  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) {
    hints.push('Android 模拟器访问宿主机服务时，不要使用 localhost 或 127.0.0.1，请改用 http://10.0.2.2:3000');
  }
  if (/^http:\/\//i.test(normalized)) {
    hints.push('如果你连的是局域网 HTTP 地址，请确认 Android 原生层已允许 cleartext traffic');
  }
  if (/trycloudflare\.com/i.test(normalized)) {
    hints.push('如果你连的是 Cloudflare Tunnel，请先确认这个随机公网地址当前仍然有效，并且能在模拟器浏览器中直接打开');
  }

  if (!rawMessage || rawMessage === 'Failed to fetch') {
    const suffix = hints.length ? `：${hints.join('；')}` : '';
    return new Error(`无法访问 ${target}${suffix}`);
  }

  return new Error(`${rawMessage}${hints.length ? `：${hints.join('；')}` : ''}`);
}

function createEmitter() {
  const target = new EventTarget();
  return {
    on(type, handler) {
      target.addEventListener(type, handler);
      return () => target.removeEventListener(type, handler);
    },
    emit(type, detail) {
      target.dispatchEvent(new CustomEvent(type, { detail }));
    },
  };
}

export function createBridgeClient() {
  const RECONNECT_MAX_ATTEMPTS = 8;
  const emitter = createEmitter();
  let ws = null;
  let status = 'idle';
  let health = null;
  let activeConnection = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let manualClose = false;
  let lastHealthCheckAt = 0;

  function setStatus(nextStatus, detail = {}) {
    status = nextStatus;
    emitter.emit('status', { status: nextStatus, ...detail });
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  async function checkHealth(baseUrl) {
    let response;
    try {
      response = await fetch(`${toHttpUrl(baseUrl)}/health`, {
        method: 'GET',
        cache: 'no-store',
      });
    } catch (error) {
      throw buildHealthError(baseUrl, error);
    }
    if (!response.ok) {
      throw new Error(`健康检查失败：HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (!payload?.ok) {
      throw new Error(payload?.message || '健康检查失败');
    }
    health = payload;
    return payload;
  }

  function disconnect(options = {}) {
    const { silent = false, preserveConnection = false } = options;
    manualClose = true;
    clearReconnectTimer();
    if (ws) {
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      } catch {}
    }
    ws = null;
    reconnectAttempts = 0;
    if (!preserveConnection) activeConnection = null;
    if (!silent) setStatus('disconnected');
    emitter.emit('close', { manual: true, health });
  }

  async function getHealthForConnection(connection, force = false) {
    const shouldRefresh = force || !health || (Date.now() - lastHealthCheckAt > 30_000);
    if (!shouldRefresh) return health;
    const nextHealth = await checkHealth(connection.baseUrl);
    lastHealthCheckAt = Date.now();
    return nextHealth;
  }

  function scheduleReconnect(connection, nextHealth) {
    if (manualClose || !connection) {
      emitter.emit('close', { manual: true, health: nextHealth || health });
      return;
    }
    if (reconnectTimer) return;
    if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      ws = null;
      setStatus('disconnected', {
        health: nextHealth || health,
        reconnectAttempt: reconnectAttempts,
        reconnectMaxAttempts: RECONNECT_MAX_ATTEMPTS,
      });
      emitter.emit('close', {
        manual: false,
        exhausted: true,
        health: nextHealth || health,
      });
      return;
    }

    reconnectAttempts += 1;
    const attempt = reconnectAttempts;
    const delay = Math.min(1000 * (2 ** (attempt - 1)), 30000);
    setStatus('reconnecting', {
      health: nextHealth || health,
      reconnectAttempt: attempt,
      reconnectMaxAttempts: RECONNECT_MAX_ATTEMPTS,
      reconnectDelayMs: delay,
    });

    reconnectTimer = window.setTimeout(async () => {
      reconnectTimer = null;
      try {
        const refreshedHealth = await getHealthForConnection(connection, true);
        openSocket(connection, {
          healthSnapshot: refreshedHealth,
          isReconnect: true,
        });
      } catch (error) {
        setStatus('reconnecting', {
          health: nextHealth || health,
          error,
          reconnectAttempt: attempt,
          reconnectMaxAttempts: RECONNECT_MAX_ATTEMPTS,
        });
        scheduleReconnect(connection, nextHealth || health);
      }
    }, delay);
  }

  function openSocket(connection, options = {}) {
    const {
      healthSnapshot = health,
      isReconnect = false,
      resolve = null,
      reject = null,
    } = options;
    let authResolved = false;
    let authenticated = false;
    const socket = new WebSocket(toWsUrl(connection.baseUrl));
    ws = socket;

    socket.onopen = () => {
      setStatus('authorizing', {
        health: healthSnapshot,
        reconnectAttempt: reconnectAttempts,
        reconnectMaxAttempts: RECONNECT_MAX_ATTEMPTS,
      });
      socket.send(JSON.stringify({
        type: 'auth',
        ...(connection.token ? { token: connection.token } : {}),
        ...(connection.password ? { password: connection.password } : {}),
      }));
    };

    socket.onmessage = (event) => {
      let msg = null;
      try {
        msg = JSON.parse(String(event.data || '{}'));
      } catch {
        return;
      }

      if (msg.type === 'auth_result') {
        if (!msg.success) {
          const error = new Error(msg.error || '认证失败');
          setStatus('error', { error, health: healthSnapshot });
          authResolved = true;
          ws = null;
          if (reject) reject(error);
          emitter.emit('close', { manual: false, authFailed: true, health: healthSnapshot });
          try {
            socket.close();
          } catch {}
          return;
        }

        authResolved = true;
        authenticated = true;
        reconnectAttempts = 0;
        setStatus('connected', {
          health: healthSnapshot,
          token: msg.token || '',
          reconnected: isReconnect,
        });
        if (resolve) resolve({ token: msg.token || '', health: healthSnapshot });
        return;
      }

      emitter.emit('message', msg);
    };

    socket.onerror = () => {
      if (!authResolved && reject) {
        authResolved = true;
        reject(new Error('WebSocket 连接失败'));
      }
    };

    socket.onclose = () => {
      if (ws === socket) ws = null;
      if (manualClose) return;
      if (authenticated) scheduleReconnect(connection, healthSnapshot);
    };
  }

  async function connect(connection) {
    disconnect({ silent: true });
    manualClose = false;
    activeConnection = { ...connection };
    const nextHealth = await getHealthForConnection(connection, true);
    setStatus('connecting', { health: nextHealth });

    return new Promise((resolve, reject) => {
      openSocket(connection, {
        healthSnapshot: nextHealth,
        resolve,
        reject,
      });
    });
  }

  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('当前未连接到服务器');
    }
    ws.send(JSON.stringify(payload));
  }

  return {
    on: emitter.on,
    connect,
    disconnect,
    send,
    checkHealth,
    getStatus: () => status,
    getHealth: () => health,
    getActiveConnection: () => activeConnection,
  };
}
