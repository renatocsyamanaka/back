// src/controllers/taskController.js
const Joi = require('joi');
const { Op, fn, col, literal } = require('sequelize');

const { Task, User } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

// ===============================
// VALIDATION
// ===============================

const createSchema = Joi.object({
  title: Joi.string().min(2).max(255).required(),
  description: Joi.string().allow('', null),

  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
  status: Joi.string().valid('NEW', 'ACK', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED').default('NEW'),

  dueDate: Joi.date().allow(null),

  // ✅ bater com o banco
  assignedToId: Joi.number().integer().allow(null),
  locationId: Joi.number().integer().allow(null),
  clientId: Joi.number().integer().allow(null),
});

const listSchema = Joi.object({
  q: Joi.string().allow('', null),
  status: Joi.string().valid('NEW', 'ACK', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED').allow(null),

  // ✅ mine=true => tarefas atribuídas ao usuário logado (assignedToId)
  mine: Joi.boolean().default(false),

  assignedToId: Joi.number().integer().allow(null),
  createdById: Joi.number().integer().allow(null),

  clientId: Joi.number().integer().allow(null),
  locationId: Joi.number().integer().allow(null),

  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').allow(null),

  // opcionais
  dueFrom: Joi.date().allow(null),
  dueTo: Joi.date().allow(null),
});

const setStatusSchema = Joi.object({
  status: Joi.string().valid('NEW', 'ACK', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED').required(),
});

const mapSchema = Joi.object({
  requesterId: Joi.number().integer().allow(null), // createdById
  status: Joi.string().valid('NEW', 'ACK', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED').allow(null),
  mine: Joi.boolean().default(false),
});

// ===============================
// HELPERS
// ===============================

function includeUsers() {
  // Ajuste os aliases conforme suas associações no model Task
  // Exemplo esperado:
  // Task.belongsTo(User, { as: 'assignee', foreignKey: 'assignedToId' })
  // Task.belongsTo(User, { as: 'creator', foreignKey: 'createdById' })
  return [
    { model: User, as: 'assignee', attributes: ['id', 'name'] },
    { model: User, as: 'creator', attributes: ['id', 'name'] },
  ];
}

async function findTaskOr404(id) {
  const task = await Task.findByPk(id);
  return task;
}

// ===============================
// CONTROLLER
// ===============================

module.exports = {
  // POST /api/tasks
  async create(req, res) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const payload = {
      title: value.title,
      description: value.description ?? null,
      priority: value.priority || 'MEDIUM',
      status: value.status || 'NEW',

      dueDate: value.dueDate ?? null,

      // ✅ colunas reais
      assignedToId: value.assignedToId ?? null,
      locationId: value.locationId ?? null,
      clientId: value.clientId ?? null,

      createdById: req.user.id,
    };

    try {
      const row = await Task.create(payload);
      return created(res, row);
    } catch (err) {
      console.error('Task.create error:', err?.original?.sqlMessage || err?.message, err?.sql);
      return bad(res, err?.original?.sqlMessage || err?.message || 'Falha ao criar task');
    }
  },

  // GET /api/tasks?mine=true&status=NEW
  async list(req, res) {
    const { error, value } = listSchema.validate(req.query);
    if (error) return bad(res, error.message);

    const where = {};

    if (value.status) where.status = value.status;
    if (value.priority) where.priority = value.priority;

    if (value.clientId) where.clientId = value.clientId;
    if (value.locationId) where.locationId = value.locationId;

    // ✅ mine=true => assignedToId = usuário logado
    if (value.mine) {
      where.assignedToId = req.user.id; // ✅ coluna real
    } else {
      if (value.assignedToId) where.assignedToId = value.assignedToId;
      if (value.createdById) where.createdById = value.createdById;
    }

    if (value.q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${value.q}%` } },
        { description: { [Op.like]: `%${value.q}%` } },
      ];
    }

    if (value.dueFrom || value.dueTo) {
      where.dueDate = {};
      if (value.dueFrom) where.dueDate[Op.gte] = value.dueFrom;
      if (value.dueTo) where.dueDate[Op.lte] = value.dueTo;
    }

    try {
      const rows = await Task.findAll({
        where,
        order: [['id', 'DESC']],
        include: includeUsers(),
      });

      return ok(res, rows);
    } catch (err) {
      console.error('Task.list error:', {
        message: err?.message,
        sqlMessage: err?.original?.sqlMessage,
        sql: err?.sql,
      });
      return bad(res, err?.original?.sqlMessage || err?.message || 'Falha ao listar tasks');
    }
  },

  // PATCH /api/tasks/:id/ack
  async ack(req, res) {
    const task = await findTaskOr404(req.params.id);
    if (!task) return notFound(res, 'Task não encontrada');

    try {
      // marca ackAt e muda status para ACK (se ainda NEW)
      const nextStatus = task.status === 'NEW' ? 'ACK' : task.status;

      await task.update({
        ackAt: task.ackAt || new Date(),
        status: nextStatus,
      });

      return ok(res, task);
    } catch (err) {
      console.error('Task.ack error:', err?.original?.sqlMessage || err?.message);
      return bad(res, err?.original?.sqlMessage || err?.message || 'Falha ao confirmar recebimento');
    }
  },

  // PATCH /api/tasks/:id/status
  async setStatus(req, res) {
    const { error, value } = setStatusSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const task = await findTaskOr404(req.params.id);
    if (!task) return notFound(res, 'Task não encontrada');

    const patch = { status: value.status };

    // ✅ completedAt automatizado quando DONE
    if (value.status === 'DONE') {
      patch.completedAt = new Date();
    } else {
      // se voltar de DONE, zera completedAt
      patch.completedAt = null;
    }

    // ✅ se virar ACK e não tem ackAt, seta
    if (value.status === 'ACK' && !task.ackAt) {
      patch.ackAt = new Date();
    }

    try {
      await task.update(patch);
      return ok(res, task);
    } catch (err) {
      console.error('Task.setStatus error:', err?.original?.sqlMessage || err?.message);
      return bad(res, err?.original?.sqlMessage || err?.message || 'Falha ao atualizar status');
    }
  },

  // GET /api/tasks/requesters
  // Lista "solicitantes" (createdById) com contagem de tasks
  async listRequesters(req, res) {
    try {
      const rows = await Task.findAll({
        attributes: [
          'createdById',
          [fn('COUNT', col('Task.id')), 'count'],
        ],
        group: ['createdById'],
        order: [[literal('count'), 'DESC']],
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name'] },
        ],
      });

      // normaliza saída
      const out = rows.map((r) => ({
        createdById: r.createdById,
        count: Number(r.get('count') || 0),
        creator: r.creator || null,
      }));

      return ok(res, out);
    } catch (err) {
      console.error('Task.listRequesters error:', err?.original?.sqlMessage || err?.message, err?.sql);
      return bad(res, err?.original?.sqlMessage || err?.message || 'Falha ao listar solicitantes');
    }
  },

  // GET /api/tasks/map
  // (por enquanto devolve tasks com campos básicos + users)
  async listForMap(req, res) {
    const { error, value } = mapSchema.validate(req.query);
    if (error) return bad(res, error.message);

    const where = {};

    if (value.status) where.status = value.status;

    if (value.mine) {
      where.assignedToId = req.user.id;
    }

    if (value.requesterId) {
      where.createdById = value.requesterId;
    }

    try {
      const rows = await Task.findAll({
        where,
        attributes: [
          'id',
          'title',
          'status',
          'priority',
          'dueDate',
          'locationId',
          'clientId',
          'assignedToId',
          'createdById',
        ],
        order: [['id', 'DESC']],
        include: includeUsers(),
      });

      return ok(res, rows);
    } catch (err) {
      console.error('Task.listForMap error:', err?.original?.sqlMessage || err?.message, err?.sql);
      return bad(res, err?.original?.sqlMessage || err?.message || 'Falha ao listar tasks do mapa');
    }
  },
};
