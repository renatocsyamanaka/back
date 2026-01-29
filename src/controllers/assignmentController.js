// src/controllers/assignmentController.js
const { Assignment, User, Client, Location } = require('../models');
const { ok, created, bad } = require('../utils/responses');
const { weekRangeOf } = require('../utils/dates');
const { Op } = require('sequelize');

/**
 * Converte YYYY-MM-DD para Date em UTC (início/fim do dia)
 */
function dayStartUTC(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}
function dayEndUTC(ymd) {
  return new Date(`${ymd}T23:59:59.999Z`);
}

module.exports = {
  async create(req, res) {
    const { userId, clientId, locationId, start, end, description, type } = req.body;
    if (!userId || !start || !end) return bad(res, 'userId, start e end são obrigatórios');

    const a = await Assignment.create({
      userId,
      clientId: clientId ?? null,
      locationId: locationId ?? null,
      start,
      end,
      description: description || '',
      type: type || 'CLIENT'
    });

    return created(res, a);
  },

  /**
   * Agenda semanal de 1 colaborador.
   * Considera sobreposição: start <= fimDaSemana && end >= inicioDaSemana
   */
  async week(req, res) {
    const userId = Number(req.params.userId);
    const { date } = req.query; // YYYY-MM-DD (qualquer dia da semana)
    const { start: s, end: e } = weekRangeOf(date || new Date().toISOString().slice(0, 10));

    // garanta Date/ISO válidos
    const start = new Date(s);
    const end = new Date(e);

    const rows = await Assignment.findAll({
      where: {
        userId,
        [Op.and]: [
          { start: { [Op.lte]: end } }, // começa antes de terminar o filtro
          { end:   { [Op.gte]: start } }, // termina depois de começar o filtro
        ],
      },
      include: [
        { model: Client, as: 'client' },
        { model: Location, as: 'location' },
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['start', 'ASC']],
    });

    return ok(res, rows);
  },

  /**
   * Intervalo arbitrário (ex.: mês). Aceita múltiplos usuários:
   * GET /api/assignments/range?from=2025-08-01&to=2025-08-31&users=2,5,9
   * Se não mandar "users", retorna de todos.
   *
   * Critério de sobreposição:
   *   start <= toEnd && end >= fromStart
   */
  async range(req, res) {
    const { from, to, users } = req.query;

    if (!from || !to) return bad(res, 'Parâmetros "from" e "to" (YYYY-MM-DD) são obrigatórios');

    const fromStart = dayStartUTC(from);
    const toEnd = dayEndUTC(to);

    let userFilter = undefined;
    if (users) {
      const ids = String(users)
        .split(',')
        .map((x) => Number(x.trim()))
        .filter(Boolean);
      if (ids.length) userFilter = { [Op.in]: ids };
    }

    const where = {
      [Op.and]: [
        { start: { [Op.lte]: toEnd } },
        { end:   { [Op.gte]: fromStart } },
      ],
      ...(userFilter ? { userId: userFilter } : {}),
    };

    const rows = await Assignment.findAll({
      where,
      include: [
        { model: Client, as: 'client' },
        { model: Location, as: 'location' },
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['start', 'ASC']],
    });

    return ok(res, rows);
  },
};
