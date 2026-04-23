import { createLocalId, readJson, writeJson, writeText, readText } from '../shared/storage.js';

const CONNECTIONS_KEY = 'webcoding-mobile-connections';
const ACTIVE_CONNECTION_KEY = 'webcoding-mobile-active-connection';

function withScheme(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(localhost|127\.0\.0\.1|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(raw)) {
    return `http://${raw}`;
  }
  return `https://${raw}`;
}

export function normalizeConnection(input = {}) {
  const baseUrl = withScheme(input.baseUrl || input.url || '').replace(/\/+$/, '');
  return {
    id: input.id || createLocalId('conn'),
    name: String(input.name || input.label || '未命名连接').trim() || '未命名连接',
    baseUrl,
    password: String(input.password || '').trim(),
    token: String(input.token || '').trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUsedAt: input.lastUsedAt || null,
  };
}

export function listConnections() {
  const items = readJson(CONNECTIONS_KEY, []);
  return Array.isArray(items)
    ? items.map((item) => normalizeConnection(item)).filter((item) => item.baseUrl)
      .sort((a, b) => new Date(b.lastUsedAt || b.updatedAt || 0) - new Date(a.lastUsedAt || a.updatedAt || 0))
    : [];
}

export function saveConnections(items) {
  writeJson(CONNECTIONS_KEY, items.map((item) => normalizeConnection(item)));
  return listConnections();
}

export function upsertConnection(input) {
  const current = listConnections();
  const nextItem = normalizeConnection(input);
  const next = current.some((item) => item.id === nextItem.id)
    ? current.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item))
    : [nextItem, ...current];
  return saveConnections(next);
}

export function removeConnection(connectionId) {
  const next = listConnections().filter((item) => item.id !== connectionId);
  writeJson(CONNECTIONS_KEY, next);
  if (getActiveConnectionId() === connectionId) {
    writeText(ACTIVE_CONNECTION_KEY, '');
  }
  return next;
}

export function getActiveConnectionId() {
  return readText(ACTIVE_CONNECTION_KEY, '');
}

export function setActiveConnectionId(connectionId) {
  writeText(ACTIVE_CONNECTION_KEY, connectionId || '');
}

export function updateConnectionUsage(connectionId, updates = {}) {
  const next = listConnections().map((item) => (
    item.id === connectionId
      ? {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString(),
          lastUsedAt: updates.lastUsedAt || item.lastUsedAt,
        }
      : item
  ));
  return saveConnections(next);
}

export function findConnection(connectionId) {
  return listConnections().find((item) => item.id === connectionId) || null;
}
