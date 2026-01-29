const Joi = require('joi');
const { Op } = require('sequelize');
const { Need, TechType, User } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

/** ===== Schemas ===== */
const updateAddressSchema = Joi.object({
  requestedLocationText: Joi.string().min(5).max(255).required(),

  requestedLat: Joi.number().allow(null),
  requestedLng: Joi.number().allow(null),

  requestedCity: Joi.string().max(120).allow(null, ''),
  requestedState: Joi.string().max(2).allow(null, ''),
  requestedCep: Joi.string().max(12).allow(null, ''),
}).required();

const createSchema = Joi.object({
  requestedLocationText: Joi.string().min(3).max(255).required(),
  requestedCity: Joi.string().max(120).allow(null, ''),
  requestedState: Joi.string().max(2).allow(null, ''),
  requestedCep: Joi.string().max(12).allow(null, ''),

  // coords (opcional)
  requestedLat: Joi.number().allow(null),
  requestedLng: Joi.number().allow(null),

  requestedName: Joi.string().min(2).max(160).default('Técnico a definir'),
  techTypeId: Joi.number().integer().allow(null),
  notes: Joi.string().allow('', null),
}).required();

const providerSchema = Joi.object({
  providerName: Joi.string().min(2).max(160).required(),
  providerWhatsapp: Joi.string().max(30).allow(null, ''),
  negotiationTier: Joi.string().valid('OURO', 'PRATA', 'BRONZE').allow(null),
  homologationStatus: Joi.string()
    .valid('NAO_INICIADA', 'EM_ANDAMENTO', 'APROVADO', 'REPROVADO')
    .allow(null),
  negotiationNotes: Joi.string().allow('', null),
}).required();

const statusSchema = Joi.object({
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED').required(),
}).required();

/** ===== Helpers ===== */
async function includeForNeed() {
  return [
    { model: TechType, as: 'techType' },
    { model: User, as: 'requestedBy', attributes: ['id', 'name'] },
  ];
}

module.exports = {
  /** POST /needs */
  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    // valida techTypeId se vier
    if (value.techTypeId) {
      const tt = await TechType.findByPk(value.techTypeId);
      if (!tt) return bad(res, 'Tipo de técnico inválido');
    }

    const row = await Need.create({
      requestedLocationText: value.requestedLocationText,
      requestedCity: value.requestedCity || null,
      requestedState: value.requestedState || null,
      requestedCep: value.requestedCep || null,

      requestedLat: value.requestedLat ?? null,
      requestedLng: value.requestedLng ?? null,

      requestedName: value.requestedName,
      techTypeId: value.techTypeId || null,
      notes: value.notes ?? null,

      requestedByUserId: req.user?.id || null,
      status: 'OPEN',
    });

    const out = await Need.findByPk(row.id, {
      include: await includeForNeed(),
    });

    return created(res, out);
  },

  /** GET /needs */
  async list(req, res) {
    try {
      const { status, techTypeId, requesterId, q } = req.query;

      const where = {};
      if (status) where.status = status;
      if (techTypeId) where.techTypeId = techTypeId;
      if (requesterId) where.requestedByUserId = requesterId;

      if (q) {
        const s = String(q).trim();
        if (s) {
          where[Op.or] = [
            { requestedLocationText: { [Op.like]: `%${s}%` } },
            { requestedName: { [Op.like]: `%${s}%` } },
            { providerName: { [Op.like]: `%${s}%` } },
          ];
        }
      }

      const rows = await Need.findAll({
        where,
        order: [['createdAt', 'DESC']],
        include: await includeForNeed(),
      });

      return ok(res, rows);
    } catch (err) {
      console.error('GET /needs error:', err?.original?.sqlMessage || err?.message);
      return bad(res, 'Falha ao listar necessidades');
    }
  },

  /** PATCH /needs/:id/status */
  async updateStatus(req, res) {
    const { error, value } = statusSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const row = await Need.findByPk(req.params.id);
    if (!row) return notFound(res, 'Requisição não encontrada');

    await row.update({ status: value.status });
    return ok(res, row);
  },

  /** PATCH /needs/:id/provider */
  async updateProvider(req, res) {
    const { id } = req.params;

    const { error, value } = providerSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const row = await Need.findByPk(id);
    if (!row) return notFound(res, 'Requisição não encontrada');

    await row.update({
      providerName: value.providerName,
      providerWhatsapp: value.providerWhatsapp || null,
      negotiationTier: value.negotiationTier ?? null,
      homologationStatus: value.homologationStatus ?? null,
      negotiationNotes: value.negotiationNotes ?? null,

      status: row.status === 'OPEN' ? 'IN_PROGRESS' : row.status,
    });

    const out = await Need.findByPk(row.id, {
      include: await includeForNeed(),
    });

    return ok(res, out);
  },

  /** PATCH /needs/:id/address */
  async updateAddress(req, res) {
    const { error, value } = updateAddressSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const row = await Need.findByPk(req.params.id);
    if (!row) return notFound(res, 'Requisição não encontrada');

    await row.update({
      requestedLocationText: value.requestedLocationText,
      requestedLat: value.requestedLat ?? null,
      requestedLng: value.requestedLng ?? null,
      requestedCity: value.requestedCity || null,
      requestedState: value.requestedState || null,
      requestedCep: value.requestedCep || null,
    });

    const out = await Need.findByPk(row.id, {
      include: await includeForNeed(),
    });

    return ok(res, out);
  },

  /** GET /needs/requesters */
  async requesters(req, res) {
    const rows = await Need.findAll({
      attributes: ['requestedByUserId'],
      include: [{ model: User, as: 'requestedBy', attributes: ['id', 'name'] }],
    });

    const map = new Map();
    rows.forEach(r => {
      const u = r.requestedBy;
      if (u?.id) {
        const cur = map.get(u.id) || { id: u.id, name: u.name, count: 0 };
        cur.count++;
        map.set(u.id, cur);
      }
    });

    return ok(res, Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
  },
};
