const { createActivityLog, sanitize } = require('../services/auditLogService');

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

module.exports = function auditAction(options = {}) {
  return (req, res, next) => {
    const startedAt = Date.now();
    const oldJson = res.json.bind(res);
    let responseBody = null;

    res.json = (body) => {
      responseBody = body;
      return oldJson(body);
    };

    res.on('finish', async () => {
      const statusCode = res.statusCode;
      const isError = statusCode >= 400;
      const user = req.user || {};

      const entityId =
        options.entityId ||
        req.params?.id ||
        req.params?.projectId ||
        req.params?.progressId ||
        req.params?.itemId ||
        null;

      await createActivityLog({
        module: options.module || 'GERAL',
        action: options.action || `${req.method} ${req.path}`,
        description: options.description || null,
        entity: options.entity || null,
        entityId,
        userId: user.id || null,
        userName: user.name || user.nome || null,
        userEmail: user.email || null,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        ip: getIp(req),
        userAgent: req.headers['user-agent'] || null,
        request: {
          params: sanitize(req.params || {}),
          query: sanitize(req.query || {}),
          body: sanitize(req.body || {}),
          durationMs: Date.now() - startedAt,
        },
        response: responseBody
          ? {
              ok: responseBody.ok,
              message: responseBody.message || responseBody.error || null,
            }
          : null,
        errorMessage: isError
          ? responseBody?.message || responseBody?.error || 'Requisição finalizada com erro'
          : null,
      });
    });

    next();
  };
};
