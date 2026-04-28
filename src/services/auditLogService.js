// Mover este arquivo para: src/services/auditLogService.js
const { ActivityLog } = require('../models');

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'authorization',
  'accessToken',
  'refreshToken',
]);

function sanitize(value) {
  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = '[OCULTO]';
      } else {
        out[key] = sanitize(val);
      }
    }
    return out;
  }

  return value;
}

async function createActivityLog(payload = {}) {
  try {
    return await ActivityLog.create({
      module: payload.module || 'GERAL',
      action: payload.action || 'ACAO',
      description: payload.description || null,
      entity: payload.entity || null,
      entityId: payload.entityId != null ? String(payload.entityId) : null,
      userId: payload.userId || null,
      userName: payload.userName || null,
      userEmail: payload.userEmail || null,
      method: payload.method || null,
      path: payload.path || null,
      statusCode: payload.statusCode || null,
      ip: payload.ip || null,
      userAgent: payload.userAgent || null,
      request: sanitize(payload.request || null),
      response: sanitize(payload.response || null),
      errorMessage: payload.errorMessage || null,
    });
  } catch (err) {
    console.error('[auditLog] Falha ao salvar log:', err.message);
    return null;
  }
}

module.exports = {
  createActivityLog,
  sanitize,
};
