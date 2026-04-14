const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { DashboardBanner, User } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

const createSchema = Joi.object({
  title: Joi.string().min(3).max(160).required(),
  subtitle: Joi.string().max(255).allow(null, ''),
  buttonLabel: Joi.string().max(60).allow(null, ''),
  buttonUrl: Joi.string().uri().allow(null, ''),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  startsAt: Joi.date().allow(null, ''),
  endsAt: Joi.date().allow(null, ''),
}).required();

const updateSchema = Joi.object({
  title: Joi.string().min(3).max(160).allow(null, ''),
  subtitle: Joi.string().max(255).allow(null, ''),
  buttonLabel: Joi.string().max(60).allow(null, ''),
  buttonUrl: Joi.string().uri().allow(null, ''),
  sortOrder: Joi.number().integer().min(0).allow(null),
  isActive: Joi.boolean().allow(null),
  startsAt: Joi.date().allow(null, ''),
  endsAt: Joi.date().allow(null, ''),
}).required();

function buildImageUrl(req, fileName) {
  const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const filePath = `uploads/dashboard-banners/${fileName}`.replace(/^\/+/, '');
  return `${baseUrl}/${filePath}`;
}

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
      const search = String(req.query.search || '').trim();

      const model = includeDeleted ? DashboardBanner.scope('withDeleted') : DashboardBanner;

      const where = {};

      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { subtitle: { [Op.like]: `%${search}%` } },
          { buttonLabel: { [Op.like]: `%${search}%` } },
        ];
      }

      if (onlyActive) {
        const now = new Date();
        where.isActive = true;
        where[Op.and] = [
          {
            [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }],
          },
          {
            [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }],
          },
        ];
      }

      const rows = await model.findAll({
        where,
        include: includeUsers(),
        order: [
          ['sortOrder', 'ASC'],
          ['createdAt', 'DESC'],
        ],
      });

      return ok(res, rows);
    } catch (e) {
      console.error('[dashboardBanner.list]', e);
      return bad(res, 'Falha ao listar banners');
    }
  },

  async getById(req, res) {
    try {
      const row = await DashboardBanner.scope('withDeleted').findByPk(req.params.id, {
        include: includeUsers(),
      });

      if (!row) return notFound(res, 'Banner não encontrado');
      return ok(res, row);
    } catch (e) {
      console.error('[dashboardBanner.getById]', e);
      return bad(res, 'Falha ao buscar banner');
    }
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const startsAt = normalizeDate(value.startsAt);
      const endsAt = normalizeDate(value.endsAt);

      if (startsAt && endsAt && startsAt > endsAt) {
        return bad(res, 'A data inicial não pode ser maior que a data final');
      }

      const row = await DashboardBanner.create({
        title: value.title,
        subtitle: value.subtitle || null,
        buttonLabel: value.buttonLabel || null,
        buttonUrl: value.buttonUrl || null,
        sortOrder: value.sortOrder ?? 0,
        isActive: value.isActive ?? true,
        startsAt,
        endsAt,
        createdById: req.user?.id || null,
        updatedById: req.user?.id || null,
      });

      const fresh = await DashboardBanner.findByPk(row.id, { include: includeUsers() });
      return created(res, fresh || row);
    } catch (e) {
      console.error('[dashboardBanner.create]', e);
      return bad(res, 'Falha ao criar banner');
    }
  },

  async update(req, res) {
    const { error, value } = updateSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await DashboardBanner.scope('withDeleted').findByPk(req.params.id);
      if (!row) return notFound(res, 'Banner não encontrado');

      const startsAt =
        Object.prototype.hasOwnProperty.call(value, 'startsAt') ? normalizeDate(value.startsAt) : row.startsAt;
      const endsAt =
        Object.prototype.hasOwnProperty.call(value, 'endsAt') ? normalizeDate(value.endsAt) : row.endsAt;

      if (startsAt && endsAt && startsAt > endsAt) {
        return bad(res, 'A data inicial não pode ser maior que a data final');
      }

      await row.update({
        title: value.title !== undefined ? value.title || null : row.title,
        subtitle: value.subtitle !== undefined ? value.subtitle || null : row.subtitle,
        buttonLabel: value.buttonLabel !== undefined ? value.buttonLabel || null : row.buttonLabel,
        buttonUrl: value.buttonUrl !== undefined ? value.buttonUrl || null : row.buttonUrl,
        sortOrder: value.sortOrder !== undefined && value.sortOrder !== null ? value.sortOrder : row.sortOrder,
        isActive: value.isActive !== undefined && value.isActive !== null ? value.isActive : row.isActive,
        startsAt,
        endsAt,
        updatedById: req.user?.id || null,
      });

      const fresh = await DashboardBanner.scope('withDeleted').findByPk(row.id, {
        include: includeUsers(),
      });

      return ok(res, fresh || row);
    } catch (e) {
      console.error('[dashboardBanner.update]', e);
      return bad(res, 'Falha ao atualizar banner');
    }
  },

  async remove(req, res) {
    try {
      const row = await DashboardBanner.findByPk(req.params.id);
      if (!row) return notFound(res, 'Banner não encontrado');

      if (row.imageUrl) {
        try {
          const u = new URL(row.imageUrl);
          const rel = u.pathname.replace(/^\/+/, '');
          const filePath = path.resolve(process.cwd(), rel);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('[dashboardBanner.remove] Falha ao apagar imagem antiga:', e.message);
        }
      }

      await row.update({
        imageUrl: null,
        deletedAt: new Date(),
        deletedById: req.user?.id || null,
        updatedById: req.user?.id || null,
      });

      return ok(res, { message: 'Banner removido com sucesso.' });
    } catch (e) {
      console.error('[dashboardBanner.remove]', e);
      return bad(res, 'Falha ao remover banner');
    }
  },

  async restore(req, res) {
    try {
      const row = await DashboardBanner.scope('withDeleted').findByPk(req.params.id);
      if (!row) return notFound(res, 'Banner não encontrado');

      await row.update({
        deletedAt: null,
        deletedById: null,
        updatedById: req.user?.id || null,
      });

      const fresh = await DashboardBanner.scope('withDeleted').findByPk(row.id, {
        include: includeUsers(),
      });

      return ok(res, fresh || row);
    } catch (e) {
      console.error('[dashboardBanner.restore]', e);
      return bad(res, 'Falha ao restaurar banner');
    }
  },

  async uploadImage(req, res) {
    try {
      const row = await DashboardBanner.scope('withDeleted').findByPk(req.params.id);
      if (!row) return notFound(res, 'Banner não encontrado');

      if (!req.file) return bad(res, 'Arquivo de imagem não enviado');

      if (row.imageUrl) {
        try {
          const u = new URL(row.imageUrl);
          const rel = u.pathname.replace(/^\/+/, '');
          const filePath = path.resolve(process.cwd(), rel);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      const imageUrl = buildImageUrl(req, req.file.filename);

      await row.update({
        imageUrl,
        updatedById: req.user?.id || null,
      });

      const fresh = await DashboardBanner.scope('withDeleted').findByPk(row.id, {
        include: includeUsers(),
      });

      return ok(res, fresh || row);
    } catch (e) {
      console.error('[dashboardBanner.uploadImage]', e);
      return bad(res, 'Falha ao enviar imagem do banner');
    }
  },
};