// controllers/teamController.js
const Joi = require('joi');
const { TeamMember, Location, User } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

const createSchema = Joi.object({
  role: Joi.string().valid('COORD', 'SUP', 'TEC', 'PSO').required(),
  name: Joi.string().min(2).required(),
  email: Joi.string().email().allow(null, ''),

  region: Joi.string().allow(null, ''),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
  active: Joi.boolean().default(true),

  userId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),
  coordinatorId: Joi.number().allow(null),
  supervisorId: Joi.number().allow(null),
});

const updateSchema = createSchema.fork(
  ['role', 'name'], // não obrigatórios no update
  (s) => s.optional()
);

module.exports = {
  // POST /api/team
  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    // validações básicas de FK (opcional acelerar omitindo)
    if (value.locationId) {
      const loc = await Location.findByPk(value.locationId);
      if (!loc) return bad(res, 'Localidade inválida');
    }
    if (value.userId) {
      const u = await User.findByPk(value.userId);
      if (!u) return bad(res, 'Usuário inválido');
    }
    if (value.coordinatorId) {
      const c = await TeamMember.findByPk(value.coordinatorId);
      if (!c || c.role !== 'COORD') return bad(res, 'Coordenador inválido');
    }
    if (value.supervisorId) {
      const s = await TeamMember.findByPk(value.supervisorId);
      if (!s || s.role !== 'SUP') return bad(res, 'Supervisor inválido');
    }

    const row = await TeamMember.create(value);

    const out = await TeamMember.findByPk(row.id, {
      include: [
        { model: Location, as: 'location' },
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: TeamMember, as: 'coordinator', attributes: ['id', 'name'] },
        { model: TeamMember, as: 'supervisor', attributes: ['id', 'name'] },
      ],
    });

    return created(res, out);
  },

  // GET /api/team
  async list(req, res) {
    const { role, active, coordinatorId, supervisorId, locationId, q } = req.query;
    const where = {};
    if (role) where.role = role;
    if (active !== undefined) where.active = String(active) === 'true';
    if (coordinatorId) where.coordinatorId = coordinatorId;
    if (supervisorId) where.supervisorId = supervisorId;
    if (locationId) where.locationId = locationId;
    if (q) where.name = { $like: `%${q}%` }; // se usa Sequelize v6+, troque por { [Op.like]: `%${q}%` }

    const rows = await TeamMember.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Location, as: 'location' },
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: TeamMember, as: 'coordinator', attributes: ['id', 'name'] },
        { model: TeamMember, as: 'supervisor', attributes: ['id', 'name'] },
      ],
    });

    return ok(res, rows);
  },

  // GET /api/team/:id
  async getById(req, res) {
    const row = await TeamMember.findByPk(req.params.id, {
      include: [
        { model: Location, as: 'location' },
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: TeamMember, as: 'coordinator', attributes: ['id', 'name'] },
        { model: TeamMember, as: 'supervisor', attributes: ['id', 'name'] },
      ],
    });
    if (!row) return notFound(res, 'Membro não encontrado');
    return ok(res, row);
  },

  // PATCH /api/team/:id
  async update(req, res) {
    const { error, value } = updateSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    const row = await TeamMember.findByPk(req.params.id);
    if (!row) return notFound(res, 'Membro não encontrado');

    // valida FK quando presentes
    if (value.locationId) {
      const loc = await Location.findByPk(value.locationId);
      if (!loc) return bad(res, 'Localidade inválida');
    }
    if (value.userId) {
      const u = await User.findByPk(value.userId);
      if (!u) return bad(res, 'Usuário inválido');
    }
    if (value.coordinatorId) {
      const c = await TeamMember.findByPk(value.coordinatorId);
      if (!c || c.role !== 'COORD') return bad(res, 'Coordenador inválido');
    }
    if (value.supervisorId) {
      const s = await TeamMember.findByPk(value.supervisorId);
      if (!s || s.role !== 'SUP') return bad(res, 'Supervisor inválido');
    }

    await row.update(value);
    return ok(res, row);
  },

  // DELETE /api/team/:id
  async remove(req, res) {
    const row = await TeamMember.findByPk(req.params.id);
    if (!row) return notFound(res, 'Membro não encontrado');
    await row.destroy();
    return ok(res, { success: true });
  },

  // GET /api/team/map — retorna “flat” para o front do mapa
  async map(req, res) {
    const { coordinatorId, supervisorId, onlyActive } = req.query;

    const where = {};
    if (onlyActive === 'true') where.active = true;
    if (coordinatorId) where.coordinatorId = coordinatorId;
    if (supervisorId) where.supervisorId = supervisorId;

    // Sempre traga todos os papéis; o front liga/desliga camadas
    const rows = await TeamMember.findAll({
      where,
      attributes: ['id', 'role', 'name', 'email', 'region', 'lat', 'lng', 'coordinatorId', 'supervisorId'],
      order: [['role', 'ASC'], ['name', 'ASC']],
    });

    // saída já no formato esperado pelo seu MapaEquipe.jsx
    const out = rows.map(r => ({
      id: r.id,
      role: r.role,                // 'COORD' | 'SUP' | 'TEC' | 'PSO'
      name: r.name,
      email: r.email,
      region: r.region,
      lat: r.lat,
      lng: r.lng,
      coordinatorId: r.coordinatorId || null,
      supervisorId: r.supervisorId || null,
    }));

    return ok(res, out);
  },
};
