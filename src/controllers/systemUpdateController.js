const Joi = require('joi');
const { Op } = require('sequelize');
const { SystemUpdate, User } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

const TYPES = ['NOVO', 'MELHORIA', 'CORRECAO', 'AVISO'];

const createSchema = Joi.object({
  title: Joi.string().min(3).max(180).required(),
  description: Joi.string().min(3).required(),
  type: Joi.string().valid(...TYPES).default('MELHORIA'),
  module: Joi.string().max(100).allow(null, ''),
  isActive: Joi.boolean().default(true),
  publishedAt: Joi.date().allow(null, ''),
}).required();

const updateSchema = Joi.object({
  title: Joi.string().min(3).max(180).allow(null, ''),
  description: Joi.string().min(3).allow(null, ''),
  type: Joi.string().valid(...TYPES).allow(null, ''),
  module: Joi.string().max(100).allow(null, ''),
  isActive: Joi.boolean().allow(null),
  publishedAt: Joi.date().allow(null, ''),
}).required();

function includeUsers() {
  return [
    {
      model: User,
      as: 'createdBy',
      attributes: ['id', 'name', 'email'],
      required: false,
    },
    {
      model: User,
      as: 'updatedBy',
      attributes: ['id', 'name', 'email'],
      required: false,
    },
    {
      model: User,
      as: 'deletedBy',
      attributes: ['id', 'name', 'email'],
      required: false,
    },
  ];
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports = {
  async list(req, res) {
    try {
      const onlyActive = req.query.onlyActive === 'true';
      const includeDeleted = req.query.includeDeleted === 'true';
      const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : null;
      const search = String(req.query.search || '').trim();
      const type = String(req.query.type || '').trim().toUpperCase();
      const moduleName = String(req.query.module || '').trim();

      const model = includeDeleted ? SystemUpdate.scope('withDeleted') : SystemUpdate;

      const where = {};

      if (onlyActive) where.isActive = true;
      if (type && TYPES.includes(type)) where.type = type;
      if (moduleName) where.module = moduleName;

      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { module: { [Op.like]: `%${search}%` } },
        ];
      }

      const rows = await model.findAll({
        where,
        include: includeUsers(),
        order: [
          ['publishedAt', 'DESC'],
          ['createdAt', 'DESC'],
        ],
        ...(limit ? { limit } : {}),
      });

      return ok(res, rows);
    } catch (e) {
      console.error('[systemUpdate.list]', e);
      return bad(res, 'Falha ao listar atualizações');
    }
  },

  async getById(req, res) {
    try {
      const row = await SystemUpdate.scope('withDeleted').findByPk(req.params.id, {
        include: includeUsers(),
      });

      if (!row) return notFound(res, 'Atualização não encontrada');
      return ok(res, row);
    } catch (e) {
      console.error('[systemUpdate.getById]', e);
      return bad(res, 'Falha ao buscar atualização');
    }
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await SystemUpdate.create({
        title: value.title,
        description: value.description,
        type: value.type || 'MELHORIA',
        module: value.module || null,
        isActive: value.isActive ?? true,
        publishedAt: normalizeDate(value.publishedAt) || new Date(),
        createdById: req.user?.id || null,
        updatedById: req.user?.id || null,
      });

      const fresh = await SystemUpdate.findByPk(row.id, { include: includeUsers() });
      return created(res, fresh || row);
    } catch (e) {
      console.error('[systemUpdate.create]', e);
      return bad(res, 'Falha ao criar atualização');
    }
  },

  async update(req, res) {
    const { error, value } = updateSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await SystemUpdate.scope('withDeleted').findByPk(req.params.id);
      if (!row) return notFound(res, 'Atualização não encontrada');

      await row.update({
        title: value.title !== undefined ? value.title || null : row.title,
        description: value.description !== undefined ? value.description || null : row.description,
        type: value.type !== undefined && value.type !== null && value.type !== '' ? value.type : row.type,
        module: value.module !== undefined ? value.module || null : row.module,
        isActive: value.isActive !== undefined && value.isActive !== null ? value.isActive : row.isActive,
        publishedAt:
          Object.prototype.hasOwnProperty.call(value, 'publishedAt')
            ? normalizeDate(value.publishedAt)
            : row.publishedAt,
        updatedById: req.user?.id || null,
      });

      const fresh = await SystemUpdate.scope('withDeleted').findByPk(row.id, {
        include: includeUsers(),
      });

      return ok(res, fresh || row);
    } catch (e) {
      console.error('[systemUpdate.update]', e);
      return bad(res, 'Falha ao atualizar atualização');
    }
  },

  async remove(req, res) {
    try {
      const row = await SystemUpdate.findByPk(req.params.id);
      if (!row) return notFound(res, 'Atualização não encontrada');

      await row.update({
        deletedAt: new Date(),
        deletedById: req.user?.id || null,
        updatedById: req.user?.id || null,
      });

      return ok(res, { message: 'Atualização removida com sucesso.' });
    } catch (e) {
      console.error('[systemUpdate.remove]', e);
      return bad(res, 'Falha ao remover atualização');
    }
  },

  async restore(req, res) {
    try {
      const row = await SystemUpdate.scope('withDeleted').findByPk(req.params.id);
      if (!row) return notFound(res, 'Atualização não encontrada');

      await row.update({
        deletedAt: null,
        deletedById: null,
        updatedById: req.user?.id || null,
      });

      const fresh = await SystemUpdate.scope('withDeleted').findByPk(row.id, {
        include: includeUsers(),
      });

      return ok(res, fresh || row);
    } catch (e) {
      console.error('[systemUpdate.restore]', e);
      return bad(res, 'Falha ao restaurar atualização');
    }
  },
};