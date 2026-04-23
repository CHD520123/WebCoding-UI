function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeImportedConnection(item = {}) {
  const connection = ensureObject(item);
  if (!connection) return null;
  const baseUrl = String(connection.baseUrl || connection.url || '').trim();
  if (!baseUrl) return null;
  return {
    name: String(connection.name || connection.label || connection.title || '导入连接').trim() || '导入连接',
    baseUrl,
    password: String(connection.password || '').trim(),
    token: String(connection.token || '').trim(),
  };
}

export function parseConnectionImport(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('导入内容为空');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('导入内容不是合法 JSON');
  }

  if (Array.isArray(payload)) {
    const items = payload.map((item) => normalizeImportedConnection(item)).filter(Boolean);
    if (items.length === 0) throw new Error('JSON 中没有有效连接');
    return items;
  }

  const single = normalizeImportedConnection(payload);
  if (single) return [single];

  const wrapper = ensureObject(payload);
  if (wrapper?.kind === 'webcoding_connections' && Array.isArray(wrapper.connections)) {
    const items = wrapper.connections.map((item) => normalizeImportedConnection(item)).filter(Boolean);
    if (items.length === 0) throw new Error('连接列表为空');
    return items;
  }

  if (wrapper?.kind === 'webcoding_connection') {
    const item = normalizeImportedConnection(wrapper);
    if (!item) throw new Error('连接缺少 baseUrl');
    return [item];
  }

  throw new Error('暂不支持该导入格式');
}
