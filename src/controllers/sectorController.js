const Joi = require('joi');
const { Sector } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

const createSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  isActive: Joi.boolean().default(true),
}).required();

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(100).allow(null, ''),
  isActive: Joi.boolean().allow(null),
}).required();

module.exports = {
  async list(req, res) {
    try {
      const onlyActive = req.query.onlyActive === 'true';

      const where = {};
      if (onlyActive) where.isActive = true;

      const rows = await Sector.findAll({
        where,
        order: [['name', 'ASC']],
      });

      return ok(res, rows);
    } catch (e) {
      console.error('[sector.list]', e);
      return bad(res, 'Falha ao listar setores');
    }
  },

  async getById(req, res) {
    try {
      const row = await Sector.findByPk(req.params.id);
      if (!row) return notFound(res, 'Setor não encontrado');
      return ok(res, row);
    } catch (e) {
      console.error('[sector.getById]', e);
      return bad(res, 'Falha ao buscar setor');
    }
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const exists = await Sector.findOne({
        where: { name: value.name.trim() },
      });

      if (exists) return bad(res, 'Já existe um setor com esse nome');

      const row = await Sector.create({
        name: value.name.trim(),
        isActive: value.isActive ?? true,
      });

      return created(res, row);
    } catch (e) {
      console.error('[sector.create]', e);
      return bad(res, 'Falha ao criar setor');
    }
  },

  async update(req, res) {
    const { error, value } = updateSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await Sector.findByPk(req.params.id);
      if (!row) return notFound(res, 'Setor não encontrado');

      if (value.name != null && value.name !== '') {
        const exists = await Sector.findOne({
          where: { name: value.name.trim() },
        });

        if (exists && Number(exists.id) !== Number(row.id)) {
          return bad(res, 'Já existe um setor com esse nome');
        }
      }

      await row.update({
        name: value.name != null && value.name !== '' ? value.name.trim() : row.name,
        isActive: value.isActive != null ? value.isActive : row.isActive,
      });

      return ok(res, row);
    } catch (e) {
      console.error('[sector.update]', e);
      return bad(res, 'Falha ao atualizar setor');
    }
  },

  async remove(req, res) {
    try {
      const row = await Sector.findByPk(req.params.id);
      if (!row) return notFound(res, 'Setor não encontrado');

      await row.destroy();
      return ok(res, { ok: true });
    } catch (e) {
      console.error('[sector.remove]', e);
      return bad(res, 'Falha ao remover setor');
    }
  },
};