const Joi = require('joi');
const { Location } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

const createSchema = Joi.object({
  name: Joi.string().required(),
  area: Joi.string().allow('', null),
  city: Joi.string().allow('', null),
  state: Joi.string().allow('', null),
  uf: Joi.string().max(2).allow('', null),
  lat: Joi.number().optional().allow(null),
  lng: Joi.number().optional().allow(null),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  area: Joi.string().allow('', null),
  city: Joi.string().allow('', null),
  state: Joi.string().allow('', null),
  uf: Joi.string().max(2).allow('', null),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
}).min(1);

module.exports = {
  async create(req, res) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return bad(res, error.message);

    // normaliza strings vazias -> null
    ['area','city','state','uf'].forEach(k => {
      if (value[k] === '') value[k] = null;
    });

    const row = await Location.create(value);
    return created(res, row);
  },

  async list(_req, res) {
    const list = await Location.findAll({ order: [['name', 'ASC']] });
    return ok(res, list);
  },

  async update(req, res) {
    const { id } = req.params;
    const { error, value } = updateSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const loc = await Location.findByPk(id);
    if (!loc) return notFound(res, 'Local não encontrado');

    // normaliza strings vazias -> null
    ['area','city','state','uf'].forEach(k => {
      if (value[k] === '') value[k] = null;
    });

    Object.assign(loc, value);
    await loc.save();

    return ok(res, loc);
  },
};
