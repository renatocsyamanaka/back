const { Op } = require('sequelize');
const { ActivityLog, User } = require('../models');
const { ok, bad, notFound } = require('../utils/responses');
const { createActivityLog } = require('../services/auditLogService');

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

module.exports = {
  async list(req, res) {
    try {
      const page = toInt(req.query.page, 1);
      const pageSize = Math.min(toInt(req.query.pageSize, 20), 100);
      const offset = (page - 1) * pageSize;

      const where = {};

      if (req.query.module) where.module = String(req.query.module).trim().toUpperCase();
      if (req.query.action) where.action = { [Op.like]: `%${String(req.query.action).trim()}%` };
      if (req.query.entity) where.entity = String(req.query.entity).trim();
      if (req.query.entityId) where.entityId = String(req.query.entityId).trim();
      if (req.query.userId) where.userId = Number(req.query.userId);
      if (req.query.statusCode) where.statusCode = Number(req.query.statusCode);

      if (req.query.q) {
        const q = String(req.query.q).trim();
        where[Op.or] = [
          { action: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
          { userName: { [Op.like]: `%${q}%` } },
          { userEmail: { [Op.like]: `%${q}%` } },
          { path: { [Op.like]: `%${q}%` } },
          { entityId: { [Op.like]: `%${q}%` } },
        ];
      }

      if (req.query.dateFrom || req.query.dateTo) {
        where.createdAt = {};
        if (req.query.dateFrom) where.createdAt[Op.gte] = new Date(`${req.query.dateFrom}T00:00:00`);
        if (req.query.dateTo) where.createdAt[Op.lte] = new Date(`${req.query.dateTo}T23:59:59`);
      }

      const result = await ActivityLog.findAndCountAll({
        where,
        limit: pageSize,
        offset,
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'], required: false }],
      });

      return ok(res, {
        rows: result.rows,
        count: result.count,
        page,
        pageSize,
      });
    } catch (err) {
      console.error('[activityLog.list]', err);
      return bad(res, err.message || 'Erro ao listar logs');
    }
  },

  async getById(req, res) {
    const log = await ActivityLog.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'], required: false }],
    });

    if (!log) return notFound(res, 'Log não encontrado');
    return ok(res, log);
  },

  async createManual(req, res) {
    const log = await createActivityLog({
      module: req.body?.module || 'GERAL',
      action: req.body?.action || 'LOG_MANUAL',
      description: req.body?.description || null,
      entity: req.body?.entity || null,
      entityId: req.body?.entityId || null,
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userEmail: req.user?.email || null,
      method: req.method,
      path: req.originalUrl,
      statusCode: 201,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
      request: req.body || null,
    });

    return ok(res, log);
  },
};
