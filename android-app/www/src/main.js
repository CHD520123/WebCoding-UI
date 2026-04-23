import {
  listConnections,
  upsertConnection,
  removeConnection,
  getActiveConnectionId,
  setActiveConnectionId,
  findConnection,
  updateConnectionUsage,
} from './connections/connection-store.js';
import { parseConnectionImport } from './connections/qr-import.js';
import { createBridgeClient } from './runtime/ws-client.js';
import { readJson, writeJson } from './shared/storage.js';
import { applyTheme, getStoredTheme } from './themes/themes.js';

const REMOTE_TASK_DRAFT_KEY = 'webcoding-mobile-remote-task-draft';
const LAST_AGENT_KEY = 'webcoding-mobile-last-agent';
const LAST_MODE_KEY = 'webcoding-mobile-last-mode';
const COLLAPSED_GROUPS_KEY = 'webcoding-mobile-collapsed-groups';
const WORKSPACE_RESYNC_INTERVAL_MS = 4000;
const WORKSPACE_RESYNC_THROTTLE_MS = 1200;

const state = {
  theme: getStoredTheme(),
  tab: 'sessions',
  sessionView: 'list',
  connections: listConnections(),
  activeConnectionId: getActiveConnectionId(),
  activeConnection: null,
  connectionStatus: 'idle',
  connectionStatusDetail: {},
  health: null,
  sessions: [],
  currentSessionId: '',
  currentSession: null,
  notices: [],
  stream: {
    active: false,
    text: '',
    toolCalls: new Map(),
  },
  expandedToolCallIds: new Set(),
  collapsedGroupIds: new Set((() => {
    const stored = readJson(COLLAPSED_GROUPS_KEY, []);
    return Array.isArray(stored) ? stored : [];
  })()),
  runtimeStatus: {
    phase: 'idle',
    resetTimer: null,
  },
  lastAgent: window.localStorage.getItem(LAST_AGENT_KEY) || 'claude',
  lastMode: window.localStorage.getItem(LAST_MODE_KEY) || 'yolo',
  scanner: {
    stream: null,
    timer: null,
  },
  remoteTaskDraft: readJson(REMOTE_TASK_DRAFT_KEY, {
    host: '',
    remoteCwd: '',
    prompt: '',
  }),
};

const client = createBridgeClient();
let lastWorkspaceResyncAt = 0;

const refs = {
  connectionsScreen: document.querySelector('#connections-screen'),
  workspaceScreen: document.querySelector('#workspace-screen'),
  connectionList: document.querySelector('#connection-list'),
  connectionCount: document.querySelector('#connection-count'),
  addConnectionBtn: document.querySelector('#add-connection-btn'),
  importJsonBtn: document.querySelector('#import-json-btn'),
  scanQrBtn: document.querySelector('#scan-qr-btn'),
  workspaceConnectionName: document.querySelector('#workspace-connection-name'),
  workspaceStatusLine: document.querySelector('#workspace-status-line'),
  disconnectBtn: document.querySelector('#disconnect-btn'),
  reconnectBtn: document.querySelector('#reconnect-btn'),
  clearTokenBtn: document.querySelector('#clear-token-btn'),
  remoteTaskBtn: document.querySelector('#remote-task-btn'),
  remoteTaskInlineBtn: document.querySelector('#remote-task-inline-btn'),
  sessionListView: document.querySelector('#session-list-view'),
  sessionDetailView: document.querySelector('#session-detail-view'),
  sessionBackBtn: document.querySelector('#session-back-btn'),
  newSessionBtn: document.querySelector('#new-session-btn'),
  sessionRuntimeSummary: document.querySelector('#session-runtime-summary'),
  sessionCount: document.querySelector('#session-count'),
  sessionList: document.querySelector('#session-list'),
  currentSessionTitle: document.querySelector('#current-session-title'),
  currentSessionMeta: document.querySelector('#current-session-meta'),
  sessionStateBanner: document.querySelector('#session-state-banner'),
  noticeList: document.querySelector('#notice-list'),
  messageList: document.querySelector('#message-list'),
  composerForm: document.querySelector('#composer-form'),
  composerInput: document.querySelector('#composer-input'),
  sendBtn: document.querySelector('#send-btn'),
  abortBtn: document.querySelector('#abort-btn'),
  agentSelect: document.querySelector('#agent-select'),
  modeSelect: document.querySelector('#mode-select'),
  tabSessionsBtn: document.querySelector('#tab-sessions-btn'),
  tabSettingsBtn: document.querySelector('#tab-settings-btn'),
  sessionsTab: document.querySelector('#sessions-tab'),
  settingsTab: document.querySelector('#settings-tab'),
  themeSelect: document.querySelector('#theme-select'),
  connectionDetailCard: document.querySelector('#connection-detail-card'),
  healthCard: document.querySelector('#health-card'),
  modalBackdrop: document.querySelector('#modal-backdrop'),
  connectionModal: document.querySelector('#connection-modal'),
  connectionForm: document.querySelector('#connection-form'),
  connectionModalTitle: document.querySelector('#connection-modal-title'),
  connectionIdInput: document.querySelector('#connection-id-input'),
  connectionNameInput: document.querySelector('#connection-name-input'),
  connectionUrlInput: document.querySelector('#connection-url-input'),
  connectionPasswordInput: document.querySelector('#connection-password-input'),
  closeConnectionModalBtn: document.querySelector('#close-connection-modal-btn'),
  importModal: document.querySelector('#import-modal'),
  importJsonInput: document.querySelector('#import-json-input'),
  importJsonConfirmBtn: document.querySelector('#import-json-confirm-btn'),
  closeImportModalBtn: document.querySelector('#close-import-modal-btn'),
  scannerModal: document.querySelector('#scanner-modal'),
  scannerVideo: document.querySelector('#scanner-video'),
  scannerStatus: document.querySelector('#scanner-status'),
  scannerFallbackInput: document.querySelector('#scanner-fallback-input'),
  scannerImportFallbackBtn: document.querySelector('#scanner-import-fallback-btn'),
  closeScannerModalBtn: document.querySelector('#close-scanner-modal-btn'),
  remoteTaskModal: document.querySelector('#remote-task-modal'),
  remoteTaskForm: document.querySelector('#remote-task-form'),
  remoteHostInput: document.querySelector('#remote-host-input'),
  remoteCwdInput: document.querySelector('#remote-cwd-input'),
  remotePromptInput: document.querySelector('#remote-prompt-input'),
  closeRemoteTaskModalBtn: document.querySelector('#close-remote-task-modal-btn'),
  toast: document.querySelector('#toast'),
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(value) {
  if (!value) return '刚刚';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function pushNotice(text, kind = 'system') {
  state.notices = [{ id: `${Date.now()}-${Math.random()}`, text, kind }, ...state.notices].slice(0, 8);
  renderNotices();
}

function showToast(text) {
  refs.toast.textContent = text;
  refs.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    refs.toast.hidden = true;
  }, 2200);
}

function getSessionMeta(sessionId) {
  return state.sessions.find((item) => item.id === sessionId) || null;
}

function sortSessions(items) {
  return [...items].sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0));
}

function clearStream() {
  state.stream.active = false;
  state.stream.text = '';
  state.stream.toolCalls = new Map();
}

function saveCollapsedGroups() {
  writeJson(COLLAPSED_GROUPS_KEY, [...state.collapsedGroupIds]);
}

function resetToolCardExpansion() {
  state.expandedToolCallIds = new Set();
}

function clearRuntimeResetTimer() {
  if (!state.runtimeStatus.resetTimer) return;
  window.clearTimeout(state.runtimeStatus.resetTimer);
  state.runtimeStatus.resetTimer = null;
}

function setRuntimePhase(phase, options = {}) {
  state.runtimeStatus.phase = phase || 'idle';
  clearRuntimeResetTimer();
  if (options.autoResetMs) {
    state.runtimeStatus.resetTimer = window.setTimeout(() => {
      state.runtimeStatus.resetTimer = null;
      state.runtimeStatus.phase = state.currentSessionId || state.currentSession ? 'ready' : 'idle';
      renderMessages();
    }, options.autoResetMs);
  }
}

function setSessionView(nextView) {
  state.sessionView = nextView === 'detail' ? 'detail' : 'list';
}

function setConnectionStatus(nextStatus, detail = {}) {
  state.connectionStatus = nextStatus;
  state.connectionStatusDetail = detail;
  if (detail.health) state.health = detail.health;
  if (Object.prototype.hasOwnProperty.call(detail, 'health') && !detail.health) state.health = null;
  renderWorkspaceHeader();
  renderSettings();
}

function getCurrentControlLabel() {
  const controlState = state.currentSession?.controlState || null;
  if (controlState === 'controller') return '当前端控制';
  if (controlState === 'viewer') return '观察模式';
  if (['sending', 'thinking', 'tools'].includes(state.runtimeStatus.phase)) return '接管中';
  if (state.currentSessionId && !state.currentSession) return '同步中';
  return '未进入会话';
}

function getCurrentViewerLabel() {
  if (['sending', 'thinking', 'tools'].includes(state.runtimeStatus.phase) && !state.currentSession) return '同步中';
  if (state.currentSessionId && !state.currentSession) return '同步中';
  const count = Number(state.currentSession?.viewerCount || 0);
  return count > 1 ? `${count} 端同步` : '单端';
}

function countRunningToolCalls(toolCalls = []) {
  return (Array.isArray(toolCalls) ? toolCalls : []).filter((toolCall) => toolCall?.done === false).length;
}

function normalizeInlineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateInlineText(value, maxLength = 120) {
  const normalized = normalizeInlineText(value);
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function formatToolPayload(value) {
  let text = '';
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  const maxLength = 1200;
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength - 1)}…\n\n[内容已截断，仅保留前半部分]`;
  }
  return text;
}

function summarizeToolInput(input) {
  if (input === undefined || input === null || input === '') return '';
  return '输入已收起';
}

function summarizeToolResult(result) {
  if (result === undefined || result === null || result === '') return '';
  return '结果已收起';
}

function summarizeToolCall(toolCall) {
  if (toolCall?.done && toolCall?.result !== undefined) {
    return summarizeToolResult(toolCall.result);
  }
  if (!toolCall?.done) return '运行参数已收起';
  if (toolCall?.input !== undefined) return summarizeToolInput(toolCall.input);
  return '等待结果返回';
}

function normalizeComparablePath(pathValue) {
  if (!pathValue) return '';
  const normalized = String(pathValue).trim().replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

function getPathLeaf(pathValue) {
  const normalized = normalizeComparablePath(pathValue);
  if (!normalized || normalized === '/') return pathValue || '/';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

function getParentPath(pathValue) {
  const normalized = normalizeComparablePath(pathValue);
  if (!normalized || normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}

function decodeClaudeProjectDir(projectDir) {
  const raw = String(projectDir || '').trim();
  if (!raw) return null;
  if (raw.startsWith('-') && !raw.includes('/') && !raw.includes('\\')) {
    const parts = raw.split('-').filter(Boolean);
    if (parts.length > 0) return `/${parts.join('/')}`;
  }
  return raw;
}

function getSessionPath(session) {
  return session?.cwd || decodeClaudeProjectDir(session?.importedFrom) || '';
}

function buildSessionGroups() {
  const groups = [];
  const groupMap = new Map();
  const historySessions = [];
  const sortedSessions = sortSessions(state.sessions);

  for (const session of sortedSessions) {
    const sessionPath = getSessionPath(session);
    if (!sessionPath) {
      historySessions.push(session);
      continue;
    }
    const normalizedPath = normalizeComparablePath(sessionPath);
    const groupId = normalizedPath ? `path:${normalizedPath}` : `project:${session.projectId || session.id}`;
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, {
        id: groupId,
        name: getPathLeaf(normalizedPath || sessionPath) || '当前目录',
        path: sessionPath,
        parentPath: getParentPath(normalizedPath || sessionPath),
        latestTimestamp: 0,
        sessions: [],
        isHistory: false,
      });
    }
    const group = groupMap.get(groupId);
    group.sessions.push(session);
    group.latestTimestamp = Math.max(group.latestTimestamp, new Date(session.updated || 0).getTime() || 0);
  }

  groups.push(...Array.from(groupMap.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp));
  if (historySessions.length > 0) {
    groups.push({
      id: 'history',
      name: '历史会话',
      path: '',
      parentPath: '没有目录信息的旧会话会放在这里',
      latestTimestamp: historySessions.reduce((latest, session) => Math.max(latest, new Date(session.updated || 0).getTime() || 0), 0),
      sessions: historySessions,
      isHistory: true,
    });
  }

  return groups;
}

function buildSessionStateDescriptor() {
  const toolCalls = Array.from(state.stream.toolCalls.values());
  const runningToolCalls = countRunningToolCalls(toolCalls);
  if (state.connectionStatus === 'reconnecting') {
    return {
      kind: 'warning',
      title: '重连中',
      detail: '网络恢复后会自动继续同步当前会话。',
    };
  }
  if (state.runtimeStatus.phase === 'sending') {
    return {
      kind: 'running',
      title: '发送中',
      detail: '消息已经提交，正在等待服务端开始处理。',
    };
  }
  if (state.runtimeStatus.phase === 'syncing') {
    return {
      kind: 'idle',
      title: '正在同步会话',
      detail: '正在从 PC 端加载完整会话记录，请稍候。',
    };
  }
  if (state.currentSessionId && !state.currentSession && !state.stream.active) {
    return {
      kind: 'idle',
      title: '正在打开会话',
      detail: '正在向服务端请求完整消息记录，请稍候。',
    };
  }
  if (state.runtimeStatus.phase === 'thinking') {
    return {
      kind: 'running',
      title: '思考中',
      detail: '消息已送达，assistant 正在组织答案。',
    };
  }
  if (runningToolCalls > 0) {
    return {
      kind: 'running',
      title: '工具运行中',
      detail: `${runningToolCalls} 个工具正在执行，结果会继续追加到当前工作区。`,
    };
  }
  if (state.stream.active) {
    return {
      kind: 'running',
      title: '正在生成',
      detail: '消息已发送，当前正在等待 assistant 持续返回内容。',
    };
  }
  if (state.runtimeStatus.phase === 'completed') {
    return {
      kind: 'ready',
      title: '已完成',
      detail: '本轮消息已经结束，你可以继续追问或切回会话列表。',
    };
  }
  if (!state.currentSessionId && !state.currentSession) {
    return {
      kind: 'idle',
      title: '未进入会话',
      detail: '从会话列表选择一个工作区，或直接发送第一条消息创建新会话。',
    };
  }
  if (state.currentSession?.isRunning) {
    return {
      kind: 'running',
      title: '后台运行中',
      detail: '当前会话仍在执行，可以继续观察输出或切回列表。',
    };
  }
  return {
    kind: 'ready',
    title: '已同步',
    detail: '已加载 PC 端会话记录，现在可以继续接管和发送消息。',
  };
}

function buildMessagesForDisplay() {
  const base = Array.isArray(state.currentSession?.messages) ? [...state.currentSession.messages] : [];
  if (!state.stream.active) return base;
  base.push({
    role: 'assistant',
    content: state.stream.text,
    toolCalls: Array.from(state.stream.toolCalls.values()),
    streaming: true,
  });
  return base;
}

function renderConnectionList() {
  refs.connectionCount.textContent = String(state.connections.length);
  if (state.connections.length === 0) {
    refs.connectionList.innerHTML = `
      <div class="connection-card">
        <div class="muted">还没有连接。你可以手动新增，或扫一个包含结构化 JSON 的二维码。</div>
      </div>
    `;
    return;
  }

  refs.connectionList.innerHTML = state.connections.map((connection) => {
    const isActive = state.activeConnectionId === connection.id;
    return `
      <article class="connection-card" data-connection-id="${escapeHtml(connection.id)}">
        <div class="connection-card-head">
          <div>
            <h3>${escapeHtml(connection.name)}</h3>
            <code>${escapeHtml(connection.baseUrl)}</code>
          </div>
          ${isActive ? '<span class="badge">最近使用</span>' : ''}
        </div>
        <div class="muted">上次使用：${escapeHtml(connection.lastUsedAt ? timeAgo(connection.lastUsedAt) : '尚未使用')}</div>
        <div class="connection-card-actions">
          <button class="btn btn-primary" type="button" data-action="connect">连接</button>
          <button class="btn" type="button" data-action="edit">编辑</button>
          <button class="btn" type="button" data-action="delete">删除</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderWorkspaceHeader() {
  const connection = state.activeConnection || findConnection(state.activeConnectionId);
  refs.workspaceConnectionName.textContent = connection?.name || '未连接';
  const statusMap = {
    idle: '尚未连接',
    connecting: '连接服务器中…',
    authorizing: '认证中…',
    reconnecting: '连接中断，正在重连…',
    connected: '已连接，可同步 PC 端会话',
    disconnected: '连接已断开',
    error: '连接失败',
  };
  const healthBits = [];
  if (state.connectionStatus === 'reconnecting' && state.connectionStatusDetail?.reconnectAttempt) {
    healthBits.push(`第 ${state.connectionStatusDetail.reconnectAttempt}/${state.connectionStatusDetail.reconnectMaxAttempts || 8} 次`);
  }
  if (state.health?.version) healthBits.push(`v${state.health.version}`);
  if (state.health?.tunnel?.url) healthBits.push('Tunnel 可用');
  refs.workspaceStatusLine.textContent = [statusMap[state.connectionStatus] || state.connectionStatus, ...healthBits].join(' · ');
}

function renderSessionList() {
  const groups = buildSessionGroups();
  refs.sessionCount.textContent = String(state.sessions.length);
  if (state.sessions.length === 0) {
    refs.sessionList.innerHTML = '<div class="detail-card muted">暂无会话。可以直接发送消息创建一个新会话。</div>';
    return;
  }

  refs.sessionList.innerHTML = groups.map((group) => {
    const isCollapsed = state.collapsedGroupIds.has(group.id);
    const sessionCards = group.sessions.map((session) => {
      const active = session.id === state.currentSessionId ? ' active' : '';
      const viewerCount = Number(session.viewerCount || 0);
      return `
        <button class="session-card${active}" type="button" data-session-id="${escapeHtml(session.id)}">
          <div class="session-card-head">
            <div>
              <h3>${escapeHtml(session.title || 'Untitled')}</h3>
              <div class="muted">${escapeHtml(session.agent || 'claude')} · ${escapeHtml(timeAgo(session.updated))}</div>
            </div>
            <span class="session-card-arrow">进入</span>
          </div>
          <div class="session-meta-row">
            ${session.isRunning ? '<span class="session-chip">运行中</span>' : ''}
            ${session.hasUnread ? '<span class="session-chip">未读</span>' : ''}
            ${viewerCount > 1 ? `<span class="session-chip">${viewerCount} 端</span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    return `
      <section class="session-group${group.isHistory ? ' history' : ''}" data-group-id="${escapeHtml(group.id)}">
        <button class="session-group-header" type="button" data-action="toggle-group" data-group-id="${escapeHtml(group.id)}">
          <div>
            <div class="session-group-title-row">
              <span class="session-group-name">${escapeHtml(group.name)}</span>
              <span class="session-group-count">${group.sessions.length}</span>
            </div>
            <div class="session-group-path">${escapeHtml(group.parentPath || group.path || '历史会话')}</div>
          </div>
          <span class="session-group-chevron">${isCollapsed ? '展开' : '收起'}</span>
        </button>
        <div class="session-group-body"${isCollapsed ? ' hidden' : ''}>
          ${sessionCards}
        </div>
      </section>
    `;
  }).join('');
}

function renderSessionViews() {
  const isDetail = state.sessionView === 'detail';
  refs.sessionListView.hidden = isDetail;
  refs.sessionDetailView.hidden = !isDetail;
}

function renderSessionStateBanner() {
  const descriptor = buildSessionStateDescriptor();
  const chips = [
    getCurrentControlLabel(),
    getCurrentViewerLabel(),
    state.currentSession?.agent || state.lastAgent,
    state.currentSession?.mode || state.lastMode,
  ].filter(Boolean);
  refs.sessionStateBanner.innerHTML = `
    <div class="session-state-banner-copy">
      <div class="session-state-banner-title-row">
        <div class="session-state-banner-title">${escapeHtml(descriptor.title)}</div>
        <span class="session-state-phase-pill" data-kind="${escapeHtml(descriptor.kind)}">${escapeHtml(descriptor.title)}</span>
      </div>
      <div class="session-state-banner-detail">${escapeHtml(descriptor.detail)}</div>
    </div>
    <div class="session-state-chip-row">
      ${chips.map((chip) => `<span class="session-state-chip">${escapeHtml(chip)}</span>`).join('')}
    </div>
  `;
  refs.sessionStateBanner.dataset.kind = descriptor.kind;
}

function renderNotices() {
  refs.noticeList.innerHTML = state.notices.map((notice) => (
    `<div class="notice" data-kind="${escapeHtml(notice.kind)}">${escapeHtml(notice.text)}</div>`
  )).join('');
}

function renderMessages() {
  const messages = buildMessagesForDisplay();
  const isConnected = state.connectionStatus === 'connected';
  const descriptor = buildSessionStateDescriptor();
  refs.currentSessionTitle.textContent = state.currentSession?.title || '尚未选择会话';
  refs.currentSessionMeta.textContent = state.currentSession
    ? `${getCurrentControlLabel()} · ${getCurrentViewerLabel()} · ${state.currentSession.agent || state.lastAgent} · ${state.currentSession.mode || state.lastMode}`
    : '连接后可浏览 PC 端会话并继续。';
  refs.sessionRuntimeSummary.textContent = `${descriptor.title} · ${getCurrentControlLabel()}`;
  refs.abortBtn.disabled = !state.stream.active;
  refs.sendBtn.disabled = !isConnected;
  refs.composerInput.disabled = !isConnected;
  refs.composerInput.placeholder = isConnected
    ? '输入消息，发送后自动接管控制权'
    : '连接恢复后才可继续发送';
  renderSessionStateBanner();

  if (messages.length === 0) {
    refs.messageList.innerHTML = '<div class="detail-card muted">这里会显示当前会话消息流、工具调用和控制状态。</div>';
    return;
  }

  refs.messageList.innerHTML = messages.map((message) => {
    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
    return `
      <article class="message-card" data-role="${escapeHtml(message.role || 'assistant')}">
        <div class="message-role">
          <span>${escapeHtml(message.role || 'assistant')}</span>
          ${message.streaming ? '<span>持续同步中</span>' : ''}
        </div>
        ${toolCalls.length > 0 ? `
          <div class="tool-call-list">
            ${toolCalls.map((toolCall) => `
              <details
                class="tool-call-card"
                data-tool-call-id="${escapeHtml(toolCall.id || toolCall.name || 'tool-call')}"
                ${state.expandedToolCallIds.has(toolCall.id || toolCall.name || 'tool-call') ? 'open' : ''}
              >
                <summary class="tool-call-summary">
                  <div class="tool-call-summary-main">
                    <div class="tool-call-title-row">
                      <span class="tool-call-name">${escapeHtml(toolCall.name || toolCall.id || 'Tool')}</span>
                      <span class="tool-call-status" data-state="${toolCall.done ? 'done' : 'running'}">${toolCall.done ? 'done' : 'running'}</span>
                    </div>
                    <div class="tool-call-snippet">${escapeHtml(summarizeToolCall(toolCall))}</div>
                  </div>
                  <span class="tool-call-toggle">详情</span>
                </summary>
                <div class="tool-call-payload">
                  ${toolCall.input !== undefined ? `
                    <div class="tool-call-payload-block">
                      <strong>input</strong>
                      <pre>${escapeHtml(formatToolPayload(toolCall.input))}</pre>
                    </div>
                  ` : ''}
                  ${toolCall.result !== undefined && toolCall.result !== '' ? `
                    <div class="tool-call-payload-block">
                      <strong>result</strong>
                      <pre>${escapeHtml(formatToolPayload(toolCall.result))}</pre>
                    </div>
                  ` : ''}
                </div>
              </details>
            `).join('')}
          </div>
        ` : ''}
        ${message.content ? `<div class="message-body">${escapeHtml(message.content || '')}</div>` : ''}
      </article>
    `;
  }).join('');

  refs.messageList.scrollTop = refs.messageList.scrollHeight;
}

function renderSettings() {
  refs.themeSelect.value = state.theme;
  const connection = state.activeConnection || findConnection(state.activeConnectionId);
  if (!connection) {
    refs.connectionDetailCard.innerHTML = '<div class="muted">尚未连接。</div>';
    refs.healthCard.innerHTML = '<div class="muted">暂无健康检查结果。</div>';
    return;
  }

  refs.connectionDetailCard.innerHTML = `
    <div class="detail-pair">
      <strong>名称</strong>
      <div>${escapeHtml(connection.name)}</div>
    </div>
    <div class="detail-pair">
      <strong>Base URL</strong>
      <code>${escapeHtml(connection.baseUrl)}</code>
    </div>
    <div class="detail-pair">
      <strong>连接状态</strong>
      <div>${escapeHtml(state.connectionStatus)}</div>
    </div>
  `;

  refs.healthCard.innerHTML = state.health ? `
    <div class="detail-pair">
      <strong>服务</strong>
      <div>${escapeHtml(state.health.service || 'webcoding')}</div>
    </div>
    <div class="detail-pair">
      <strong>版本</strong>
      <div>${escapeHtml(state.health.version || 'unknown')}</div>
    </div>
    <div class="detail-pair">
      <strong>Tunnel</strong>
      <code>${escapeHtml(state.health.tunnel?.url || '未开启')}</code>
    </div>
  ` : '<div class="muted">暂无健康检查结果。</div>';
}

function renderTabs() {
  const sessionsActive = state.tab === 'sessions';
  refs.sessionsTab.hidden = !sessionsActive;
  refs.settingsTab.hidden = sessionsActive;
  refs.tabSessionsBtn.classList.toggle('active', sessionsActive);
  refs.tabSettingsBtn.classList.toggle('active', !sessionsActive);
}

function renderApp() {
  const hasWorkspace = !!state.activeConnection;
  refs.connectionsScreen.hidden = hasWorkspace;
  refs.workspaceScreen.hidden = !hasWorkspace;
  renderConnectionList();
  renderWorkspaceHeader();
  renderSessionList();
  renderSessionViews();
  renderNotices();
  renderMessages();
  renderSettings();
  renderTabs();
}

function openModal(modalEl) {
  refs.modalBackdrop.hidden = false;
  for (const modal of document.querySelectorAll('.modal-sheet')) {
    modal.hidden = modal !== modalEl;
  }
}

function closeModals() {
  refs.modalBackdrop.hidden = true;
  for (const modal of document.querySelectorAll('.modal-sheet')) {
    modal.hidden = true;
  }
  stopScanner();
}

function openConnectionModal(connection = null) {
  refs.connectionModalTitle.textContent = connection ? '编辑连接' : '新增连接';
  refs.connectionIdInput.value = connection?.id || '';
  refs.connectionNameInput.value = connection?.name || '';
  refs.connectionUrlInput.value = connection?.baseUrl || '';
  refs.connectionPasswordInput.value = connection?.password || '';
  openModal(refs.connectionModal);
}

function openImportModal() {
  refs.importJsonInput.value = '';
  openModal(refs.importModal);
}

async function startScanner() {
  refs.scannerStatus.textContent = '正在请求摄像头…';
  refs.scannerFallbackInput.value = '';
  openModal(refs.scannerModal);

  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  if (!canScan) {
    refs.scannerStatus.textContent = '当前设备不支持原生扫码，请改用下方 JSON 输入。';
    return;
  }

  try {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    });
    state.scanner.stream = stream;
    refs.scannerVideo.srcObject = stream;
    await refs.scannerVideo.play();
    refs.scannerStatus.textContent = '请把包含连接 JSON 的二维码放到取景框内。';

    state.scanner.timer = window.setInterval(async () => {
      try {
        const barcodes = await detector.detect(refs.scannerVideo);
        const rawValue = barcodes?.[0]?.rawValue || '';
        if (!rawValue) return;
        importConnectionsFromText(rawValue);
        showToast('扫码导入成功');
        closeModals();
      } catch {}
    }, 700);
  } catch (error) {
    refs.scannerStatus.textContent = `无法打开摄像头：${error.message || '未知错误'}`;
  }
}

function stopScanner() {
  if (state.scanner.timer) {
    window.clearInterval(state.scanner.timer);
    state.scanner.timer = null;
  }
  if (state.scanner.stream) {
    for (const track of state.scanner.stream.getTracks()) {
      track.stop();
    }
    state.scanner.stream = null;
  }
  if (refs.scannerVideo) refs.scannerVideo.srcObject = null;
}

function importConnectionsFromText(text) {
  const imported = parseConnectionImport(text);
  imported.forEach((item) => upsertConnection(item));
  state.connections = listConnections();
  renderConnectionList();
  return imported.length;
}

async function connectToConnection(connectionId) {
  const connection = findConnection(connectionId);
  if (!connection) {
    showToast('未找到连接');
    return;
  }
  setSessionView('list');
  state.activeConnection = connection;
  state.activeConnectionId = connection.id;
  state.currentSessionId = '';
  state.currentSession = null;
  state.sessions = [];
  state.notices = [];
  clearStream();
  resetToolCardExpansion();
  setRuntimePhase('idle');
  setActiveConnectionId(connection.id);
  setConnectionStatus('connecting');
  renderApp();

  try {
    const result = await client.connect(connection);
    state.activeConnection = findConnection(connection.id) || connection;
    if (result.token) {
      updateConnectionUsage(connection.id, {
        token: result.token,
        lastUsedAt: new Date().toISOString(),
      });
    } else {
      updateConnectionUsage(connection.id, {
        lastUsedAt: new Date().toISOString(),
      });
    }
    state.connections = listConnections();
    setConnectionStatus('connected', { health: result.health });
    setRuntimePhase('idle');
    showToast(`已连接 ${connection.name}`);
    renderApp();
  } catch (error) {
    setConnectionStatus('error', { health: state.health });
    state.activeConnection = null;
    setRuntimePhase('idle');
    showToast(error.message || '连接失败');
    renderApp();
  }
}

function ensureCurrentSessionLoaded() {
  if (state.currentSessionId) return;
  const activeSession = state.sessions[0];
  if (!activeSession) return;
  state.currentSessionId = activeSession.id;
  client.send({ type: 'load_session', sessionId: activeSession.id });
}

function syncCurrentSelectors(snapshot) {
  if (snapshot?.agent) {
    state.lastAgent = snapshot.agent;
    refs.agentSelect.value = snapshot.agent;
    window.localStorage.setItem(LAST_AGENT_KEY, snapshot.agent);
  }
  if (snapshot?.mode) {
    state.lastMode = snapshot.mode;
    refs.modeSelect.value = snapshot.mode;
    window.localStorage.setItem(LAST_MODE_KEY, snapshot.mode);
  }
}

function mergeSessionMeta(sessionId, updates = {}) {
  state.sessions = sortSessions(state.sessions.map((item) => (
    item.id === sessionId ? { ...item, ...updates } : item
  )));
}

function canResyncWorkspace() {
  return state.connectionStatus === 'connected' && typeof document !== 'undefined' && document.visibilityState !== 'hidden';
}

function resyncWorkspace(options = {}) {
  const { force = false } = options;
  if (!force && !canResyncWorkspace()) return;
  const now = Date.now();
  if (!force && now - lastWorkspaceResyncAt < WORKSPACE_RESYNC_THROTTLE_MS) return;
  lastWorkspaceResyncAt = now;
  try {
    client.send({ type: 'list_sessions' });
    if (state.currentSessionId) {
      client.send({ type: 'load_session', sessionId: state.currentSessionId });
    }
  } catch {}
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'session_list':
      state.sessions = sortSessions(Array.isArray(msg.sessions) ? msg.sessions : []);
      if (state.connectionStatus === 'connected' && !state.currentSessionId) {
        ensureCurrentSessionLoaded();
      }
      renderSessionList();
      renderMessages();
      break;
    case 'session_info':
      clearStream();
      state.currentSessionId = msg.sessionId;
      state.currentSession = {
        ...msg,
      };
      setRuntimePhase(msg.isRunning ? 'thinking' : 'ready');
      syncCurrentSelectors(msg);
      mergeSessionMeta(msg.sessionId, {
        title: msg.title,
        updated: msg.updated,
        isRunning: msg.isRunning,
        viewerCount: msg.viewerCount,
      });
      renderApp();
      break;
    case 'resume_generating':
      state.stream.active = true;
      state.stream.text = msg.text || '';
      state.stream.toolCalls = new Map((msg.toolCalls || []).map((toolCall) => [toolCall.id, toolCall]));
      setRuntimePhase(countRunningToolCalls(Array.from(state.stream.toolCalls.values())) > 0 ? 'tools' : 'thinking');
      renderMessages();
      break;
    case 'text_delta':
      state.stream.active = true;
      state.stream.text += msg.text || '';
      if (countRunningToolCalls(Array.from(state.stream.toolCalls.values())) === 0) {
        setRuntimePhase('thinking');
      }
      renderMessages();
      break;
    case 'tool_start':
      state.stream.active = true;
      state.stream.toolCalls.set(msg.toolUseId, {
        id: msg.toolUseId,
        name: msg.name,
        input: msg.input,
        done: false,
      });
      setRuntimePhase('tools');
      renderMessages();
      break;
    case 'tool_end': {
      const prev = state.stream.toolCalls.get(msg.toolUseId) || { id: msg.toolUseId, name: msg.toolUseId };
      state.stream.toolCalls.set(msg.toolUseId, {
        ...prev,
        done: true,
        result: msg.result,
      });
      setRuntimePhase(countRunningToolCalls(Array.from(state.stream.toolCalls.values())) > 0 ? 'tools' : 'thinking');
      renderMessages();
      break;
    }
    case 'control_changed':
      if (msg.sessionId === state.currentSessionId && state.currentSession) {
        state.currentSession = {
          ...state.currentSession,
          controlState: msg.controlState || null,
          viewerCount: msg.viewerCount || 0,
          controllerClientId: msg.controllerClientId || null,
        };
      }
      mergeSessionMeta(msg.sessionId, {
        viewerCount: msg.viewerCount || 0,
        controllerClientId: msg.controllerClientId || null,
      });
      renderApp();
      break;
    case 'system_message':
      pushNotice(msg.message || '系统消息', 'system');
      break;
    case 'error':
      pushNotice(msg.message || '发生错误', 'error');
      state.stream.active = false;
      setRuntimePhase(state.currentSessionId || state.currentSession ? 'ready' : 'idle');
      renderMessages();
      break;
    case 'done':
      state.stream.active = false;
      setRuntimePhase('completed', { autoResetMs: 1800 });
      renderMessages();
      if (msg.sessionId) {
        window.setTimeout(() => {
          try {
            client.send({ type: 'load_session', sessionId: msg.sessionId });
          } catch {}
        }, 120);
      }
      break;
    case 'background_done':
      pushNotice(`会话「${msg.title || msg.sessionId}」已完成`, 'system');
      try {
        client.send({ type: 'list_sessions' });
      } catch {}
      break;
    case 'mode_changed':
      state.lastMode = msg.mode || state.lastMode;
      refs.modeSelect.value = state.lastMode;
      window.localStorage.setItem(LAST_MODE_KEY, state.lastMode);
      break;
    case 'session_renamed':
      mergeSessionMeta(msg.sessionId, { title: msg.title });
      if (msg.sessionId === state.currentSessionId && state.currentSession) {
        state.currentSession = { ...state.currentSession, title: msg.title };
      }
      renderApp();
      break;
    default:
      break;
  }
}

client.on('status', (event) => {
  const previousStatus = state.connectionStatus;
  setConnectionStatus(event.detail.status, event.detail);
  if (event.detail.status === 'connected') {
    resyncWorkspace({ force: true });
    if (event.detail.reconnected) {
      pushNotice('连接已恢复，继续同步当前会话', 'system');
    } else if (previousStatus === 'reconnecting') {
      pushNotice('重连成功', 'system');
    }
  }
});

client.on('message', (event) => {
  handleServerMessage(event.detail);
});

client.on('close', (event) => {
  if (event.detail?.manual) return;
  if (event.detail?.exhausted) {
    pushNotice('自动重连失败，请手动重新连接', 'error');
  } else if (event.detail?.authFailed) {
    pushNotice('连接认证失败，请重新连接', 'error');
  } else if (state.connectionStatus === 'disconnected') {
    pushNotice('连接已关闭', 'error');
  }
  clearStream();
  setRuntimePhase(state.connectionStatus === 'reconnecting' ? 'syncing' : 'idle');
  renderApp();
});

refs.addConnectionBtn.addEventListener('click', () => openConnectionModal());
refs.importJsonBtn.addEventListener('click', () => openImportModal());
refs.scanQrBtn.addEventListener('click', () => startScanner());
refs.closeConnectionModalBtn.addEventListener('click', closeModals);
refs.closeImportModalBtn.addEventListener('click', closeModals);
refs.closeScannerModalBtn.addEventListener('click', closeModals);
refs.closeRemoteTaskModalBtn.addEventListener('click', closeModals);
refs.modalBackdrop.addEventListener('click', closeModals);

refs.connectionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const next = {
    id: refs.connectionIdInput.value || undefined,
    name: refs.connectionNameInput.value,
    baseUrl: refs.connectionUrlInput.value,
    password: refs.connectionPasswordInput.value,
  };
  if (!String(next.baseUrl || '').trim()) {
    showToast('Base URL 不能为空');
    return;
  }
  upsertConnection(next);
  state.connections = listConnections();
  closeModals();
  renderConnectionList();
  showToast('连接已保存');
});

refs.importJsonConfirmBtn.addEventListener('click', () => {
  try {
    const count = importConnectionsFromText(refs.importJsonInput.value);
    closeModals();
    showToast(`已导入 ${count} 个连接`);
  } catch (error) {
    showToast(error.message || '导入失败');
  }
});

refs.scannerImportFallbackBtn.addEventListener('click', () => {
  try {
    const count = importConnectionsFromText(refs.scannerFallbackInput.value);
    closeModals();
    showToast(`已导入 ${count} 个连接`);
  } catch (error) {
    showToast(error.message || '导入失败');
  }
});

refs.connectionList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const card = event.target.closest('[data-connection-id]');
  if (!button || !card) return;
  const connectionId = card.dataset.connectionId;
  if (button.dataset.action === 'connect') {
    connectToConnection(connectionId);
    return;
  }
  if (button.dataset.action === 'edit') {
    openConnectionModal(findConnection(connectionId));
    return;
  }
  if (button.dataset.action === 'delete') {
    removeConnection(connectionId);
    state.connections = listConnections();
    renderConnectionList();
    showToast('连接已删除');
  }
});

refs.disconnectBtn.addEventListener('click', () => {
  client.disconnect();
  state.activeConnection = null;
  state.health = null;
  state.connectionStatusDetail = {};
  state.connectionStatus = 'idle';
  setSessionView('list');
  state.currentSession = null;
  state.currentSessionId = '';
  state.sessions = [];
  clearStream();
  resetToolCardExpansion();
  setRuntimePhase('idle');
  renderApp();
});

refs.reconnectBtn.addEventListener('click', () => {
  if (!state.activeConnectionId) return;
  connectToConnection(state.activeConnectionId);
});

refs.clearTokenBtn.addEventListener('click', () => {
  if (!state.activeConnectionId) return;
  updateConnectionUsage(state.activeConnectionId, { token: '' });
  state.connections = listConnections();
  state.activeConnection = findConnection(state.activeConnectionId);
  renderSettings();
  showToast('已清除当前连接 Token');
});

refs.sessionList.addEventListener('click', (event) => {
  const toggleButton = event.target.closest('[data-action="toggle-group"]');
  if (toggleButton) {
    const groupId = toggleButton.dataset.groupId;
    if (!groupId) return;
    if (state.collapsedGroupIds.has(groupId)) state.collapsedGroupIds.delete(groupId);
    else state.collapsedGroupIds.add(groupId);
    saveCollapsedGroups();
    renderSessionList();
    return;
  }
  const button = event.target.closest('[data-session-id]');
  if (!button) return;
  state.currentSessionId = button.dataset.sessionId || '';
  state.currentSession = null;
  setSessionView('detail');
  clearStream();
  resetToolCardExpansion();
  setRuntimePhase('syncing');
  renderMessages();
  client.send({ type: 'load_session', sessionId: state.currentSessionId });
  renderSessionViews();
});

refs.newSessionBtn.addEventListener('click', () => {
  setSessionView('detail');
  state.currentSessionId = '';
  state.currentSession = null;
  clearStream();
  resetToolCardExpansion();
  setRuntimePhase('idle');
  renderMessages();
  renderSessionViews();
  refs.composerInput.focus();
});

refs.sessionBackBtn.addEventListener('click', () => {
  setSessionView('list');
  renderSessionViews();
});

refs.agentSelect.addEventListener('change', () => {
  state.lastAgent = refs.agentSelect.value;
  window.localStorage.setItem(LAST_AGENT_KEY, state.lastAgent);
});

refs.modeSelect.addEventListener('change', () => {
  state.lastMode = refs.modeSelect.value;
  window.localStorage.setItem(LAST_MODE_KEY, state.lastMode);
  if (state.currentSessionId) {
    try {
      client.send({ type: 'set_mode', sessionId: state.currentSessionId, mode: state.lastMode });
    } catch {}
  }
});

refs.composerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = refs.composerInput.value.trim();
  if (!text) return;
  try {
    setRuntimePhase('sending');
    renderMessages();
    client.send({
      type: 'message',
      text,
      ...(state.currentSessionId ? { sessionId: state.currentSessionId } : {}),
      mode: state.lastMode,
      agent: state.lastAgent,
    });
    refs.composerInput.value = '';
    showToast('已发送，当前端将接管控制权');
  } catch (error) {
    showToast(error.message || '发送失败');
  }
});

refs.abortBtn.addEventListener('click', () => {
  try {
    client.send({ type: 'abort' });
  } catch (error) {
    showToast(error.message || '停止失败');
  }
});

refs.messageList.addEventListener('toggle', (event) => {
  const card = event.target.closest('.tool-call-card');
  if (!card) return;
  const toolCallId = card.dataset.toolCallId;
  if (!toolCallId) return;
  if (card.open) state.expandedToolCallIds.add(toolCallId);
  else state.expandedToolCallIds.delete(toolCallId);
}, true);

refs.tabSessionsBtn.addEventListener('click', () => {
  state.tab = 'sessions';
  renderTabs();
});

refs.tabSettingsBtn.addEventListener('click', () => {
  state.tab = 'settings';
  renderTabs();
});

refs.themeSelect.addEventListener('change', () => {
  state.theme = applyTheme(refs.themeSelect.value);
  showToast(`主题已切换为 ${state.theme}`);
});

refs.remoteTaskBtn.addEventListener('click', () => {
  refs.remoteHostInput.value = state.remoteTaskDraft.host || '';
  refs.remoteCwdInput.value = state.remoteTaskDraft.remoteCwd || '';
  refs.remotePromptInput.value = state.remoteTaskDraft.prompt || '';
  openModal(refs.remoteTaskModal);
});

refs.remoteTaskInlineBtn.addEventListener('click', () => {
  refs.remoteTaskBtn.click();
});

refs.remoteTaskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.remoteTaskDraft = {
    host: refs.remoteHostInput.value.trim(),
    remoteCwd: refs.remoteCwdInput.value.trim(),
    prompt: refs.remotePromptInput.value.trim(),
  };
  writeJson(REMOTE_TASK_DRAFT_KEY, state.remoteTaskDraft);
  closeModals();
  showToast('远程任务草稿已保存');
});

function bootstrap() {
  state.theme = applyTheme(state.theme);
  refs.themeSelect.value = state.theme;
  refs.agentSelect.value = state.lastAgent;
  refs.modeSelect.value = state.lastMode;
  if (state.activeConnectionId) {
    state.activeConnection = findConnection(state.activeConnectionId);
  }
  renderApp();
  window.setInterval(() => {
    resyncWorkspace();
  }, WORKSPACE_RESYNC_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    resyncWorkspace({ force: true });
  });
  window.addEventListener('focus', () => {
    resyncWorkspace({ force: true });
  });
}

bootstrap();
