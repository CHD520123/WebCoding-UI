const hasLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function readJson(key, fallback) {
  if (!hasLocalStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readText(key, fallback = '') {
  if (!hasLocalStorage()) return fallback;
  return window.localStorage.getItem(key) || fallback;
}

export function writeText(key, value) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(key, String(value));
}

export function removeKey(key) {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(key);
}

export function createLocalId(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
