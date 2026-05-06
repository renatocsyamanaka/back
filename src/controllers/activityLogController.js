const { Op } = require('sequelize');
const { ActivityLog, User } = require('../models');
const { ok, bad, notFound } = require('../utils/responses');
const { createActivityLog } = require('../services/auditLogService');
const XLSX = require('xlsx');

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function startOfDay(value) {
  const d = value ? new Date(`${value}T00:00:00`) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = value ? new Date(`${value}T23:59:59`) : new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function diffDaysInclusive(dateFrom, dateTo) {
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function safeStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function buildLogWhere(query = {}) {
  const where = {};

  if (query.module) {
    where.module = String(query.module).trim().toUpperCase();
  }

  if (query.action) {
    where.action = { [Op.like]: `%${String(query.action).trim()}%` };
  }

  if (query.entity) {
    where.entity = String(query.entity).trim();
  }

  if (query.entityId) {
    where.entityId = String(query.entityId).trim();
  }

  if (query.userId) {
    where.userId = Number(query.userId);
  }

  if (query.statusCode) {
    where.statusCode = Number(query.statusCode);
  }

  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);

  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultFromDate.getDate() - 6);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

  const dateFrom = startOfDay(query.dateFrom || defaultFrom);
  const dateTo = endOfDay(query.dateTo || defaultTo);

  where.createdAt = {
    [Op.between]: [dateFrom, dateTo],
  };

  if (query.q) {
    const q = String(query.q).trim();

    where[Op.or] = [
      { action: { [Op.like]: `%${q}%` } },
      { module: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { userName: { [Op.like]: `%${q}%` } },
      { userEmail: { [Op.like]: `%${q}%` } },
      { path: { [Op.like]: `%${q}%` } },
      { entityId: { [Op.like]: `%${q}%` } },
    ];
  }

  return {
    where,
    dateFrom,
    dateTo,
  };
}

module.exports = {
  async list(req, res) {
    try {
      const page = toInt(req.query.page, 1);
      const pageSize = Math.min(toInt(req.query.pageSize, 20), 100);
      const offset = (page - 1) * pageSize;

      const { where } = buildLogWhere(req.query);

      const result = await ActivityLog.findAndCountAll({
        where,
        limit: pageSize,
        offset,
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
            required: false,
          },
        ],
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
    try {
      const log = await ActivityLog.findByPk(req.params.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
            required: false,
          },
        ],
      });

      if (!log) return notFound(res, 'Log não encontrado');

      return ok(res, log);
    } catch (err) {
      console.error('[activityLog.getById]', err);
      return bad(res, err.message || 'Erro ao consultar log');
    }
  },

  async exportExcel(req, res) {
    try {
      const { where, dateFrom, dateTo } = buildLogWhere(req.query);
      const days = diffDaysInclusive(dateFrom, dateTo);

      if (days > 30) {
        return bad(res, 'O download em Excel permite no máximo 30 dias por vez.');
      }

      const rows = await ActivityLog.findAll({
        where,
        limit: 50000,
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
            required: false,
          },
        ],
      });

      const excelRows = rows.map((log) => {
        const item = log.toJSON ? log.toJSON() : log;

        return {
          ID: item.id,
          Data: formatDateTime(item.createdAt),
          Modulo: item.module || '',
          Acao: item.action || '',
          Descricao: item.description || '',
          Usuario: item.user?.name || item.userName || 'Sistema',
          Email: item.user?.email || item.userEmail || '',
          Metodo: item.method || '',
          Rota: item.path || item.route || '',
          Status: item.statusCode || item.status || '',
          Entidade: item.entity || '',
          EntidadeID: item.entityId || '',
          Requisicao: safeStringify(item.request),
          Resposta: safeStringify(item.response),
          Antes: safeStringify(item.before),
          Depois: safeStringify(item.after),
          IP: item.ip || '',
          UserAgent: item.userAgent || '',
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 22 },
        { wch: 25 },
        { wch: 30 },
        { wch: 45 },
        { wch: 28 },
        { wch: 35 },
        { wch: 12 },
        { wch: 45 },
        { wch: 10 },
        { wch: 20 },
        { wch: 15 },
        { wch: 60 },
        { wch: 60 },
        { wch: 60 },
        { wch: 60 },
        { wch: 20 },
        { wch: 60 },
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Logs');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      const fileName = `logs_${dateFrom.toISOString().slice(0, 10)}_${dateTo
        .toISOString()
        .slice(0, 10)}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.send(buffer);
    } catch (err) {
      console.error('[activityLog.exportExcel]', err);
      return bad(res, err.message || 'Erro ao exportar logs');
    }
  },

  async createManual(req, res) {
    try {
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
    } catch (err) {
      console.error('[activityLog.createManual]', err);
      return bad(res, err.message || 'Erro ao criar log manual');
    }
  },
};