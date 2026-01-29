// controllers/overtimeController.js
const Joi = require('joi');
const { Op } = require('sequelize');
const { OvertimeEntry, User, Role } = require('../models');
const { ok, created, bad, notFound, forbidden } = require('../utils/responses');

function monthRange(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

const listSchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
});

const adjustSchema = Joi.object({
  userId: Joi.number().required(),
  minutes: Joi.number().integer().required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  note: Joi.string().allow('', null),
});

const editSchema = Joi.object({
  minutes: Joi.number().integer(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  note: Joi.string().allow('', null),
}).min(1);

// ✅ regra: quem TEM banco? (técnico/analista e supervisor)
function roleHasBank(roleLevel) {
  return (roleLevel ?? 0) <= 2;
}

async function getUserWithRole(userId) {
  return User.findByPk(userId, {
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
  });
}

// ✅ verifica se target está na árvore do "me" via managerId chain
async function isInMyTree(meId, targetUserId) {
  if (Number(meId) === Number(targetUserId)) return true;

  let cur = await User.findByPk(targetUserId, { attributes: ['id', 'managerId'] });
  let guard = 0;

  while (cur?.managerId && guard < 50) {
    if (Number(cur.managerId) === Number(meId)) return true;
    cur = await User.findByPk(cur.managerId, { attributes: ['id', 'managerId'] });
    guard++;
  }
  return false;
}

/**
 * ✅ PERMISSÃO DE VISUALIZAÇÃO
 * - Se o alvo não tem banco: bloqueia
 * - Coordenador+ pode ver quem está na árvore dele
 * - Supervisor pode ver o próprio banco e o time direto (opcional)
 *   -> aqui vou manter sua ideia: supervisor pode ver o time dele (somente nível direto)
 */
async function canView(me, targetUserId) {
  const target = await getUserWithRole(targetUserId);
  if (!target) return { ok: false, code: 404, reason: 'Usuário não encontrado' };

  // alvo precisa ter banco
  if (!roleHasBank(target.role?.level)) {
    return { ok: false, code: 403, reason: 'Este cargo não possui banco de horas' };
  }

  // próprio
  if (me.id === Number(targetUserId)) return { ok: true };

  const myLevel = me.role?.level ?? 0;

  // Coordenador+ vê na árvore
  if (myLevel >= 3) {
    const inTree = await isInMyTree(me.id, targetUserId);
    return inTree ? { ok: true } : { ok: false, code: 403, reason: 'Fora da sua hierarquia' };
  }

  // Supervisor NÃO ajusta, mas pode ver seu time direto (se quiser)
  if (myLevel === 2) {
    const u = await User.findByPk(targetUserId, { attributes: ['id', 'managerId'] });
    if (u && Number(u.managerId) === Number(me.id)) return { ok: true };
  }

  return { ok: false, code: 403, reason: 'Sem permissão para ver o banco deste usuário' };
}

/**
 * ✅ PERMISSÃO DE AJUSTE (O QUE VOCÊ PEDIU)
 * - SOMENTE Coordenador+ (level >= 3)
 * - Alvo precisa ter banco (roleHasBank)
 * - Alvo precisa estar na árvore do coordenador (hierarquia)
 */
async function canAdjust(me, targetUserId) {
  const myLevel = me.role?.level ?? 0;

  // 🔒 supervisor não ajusta
  if (myLevel < 3) {
    return { ok: false, code: 403, reason: 'Somente Coordenador+ pode cadastrar/ajustar horários' };
  }

  const target = await getUserWithRole(targetUserId);
  if (!target) return { ok: false, code: 404, reason: 'Usuário não encontrado' };

  if (!roleHasBank(target.role?.level)) {
    return { ok: false, code: 403, reason: 'Este cargo não possui banco de horas' };
  }

  // dentro da árvore
  const inTree = await isInMyTree(me.id, targetUserId);
  if (!inTree) {
    return { ok: false, code: 403, reason: 'Fora da sua hierarquia' };
  }

  return { ok: true };
}

async function list(req, res) {
  const { userId } = req.params;
  const { error, value } = listSchema.validate(req.query);
  if (error) return bad(res, error.message);

  const perm = await canView(req.user, userId);
  if (!perm.ok) {
    if (perm.code === 404) return notFound(res, perm.reason);
    return forbidden(res, perm.reason);
  }

  const { start, end } = monthRange(value.month);

  const entries = await OvertimeEntry.findAll({
    where: { userId, date: { [Op.between]: [start, end] } },
    include: [{ model: User, as: 'approvedBy', attributes: ['id', 'name'] }],
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
  });

  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  return ok(res, { month: value.month, totalMinutes, entries });
}

async function adjust(req, res) {
  const { error, value } = adjustSchema.validate(req.body);
  if (error) return bad(res, error.message);

  const perm = await canAdjust(req.user, value.userId);
  if (!perm.ok) {
    if (perm.code === 404) return notFound(res, perm.reason);
    return forbidden(res, perm.reason);
  }

  const entry = await OvertimeEntry.create({
    userId: value.userId,
    date: value.date,
    minutes: value.minutes,
    note: value.note || null,
    approvedById: req.user.id,
    createdById: req.user.id,
  });

  return created(res, entry);
}

async function updateEntry(req, res) {
  const entry = await OvertimeEntry.findByPk(req.params.id);
  if (!entry) return notFound(res, 'Lançamento não encontrado');

  const perm = await canAdjust(req.user, entry.userId);
  if (!perm.ok) {
    if (perm.code === 404) return notFound(res, perm.reason);
    return forbidden(res, perm.reason);
  }

  const { error, value } = editSchema.validate(req.body);
  if (error) return bad(res, error.message);

  Object.assign(entry, value);

  // quem editou aprovou
  entry.approvedById = req.user.id;
  await entry.save();

  return ok(res, entry);
}

async function deleteEntry(req, res) {
  const entry = await OvertimeEntry.findByPk(req.params.id);
  if (!entry) return notFound(res, 'Lançamento não encontrado');

  const perm = await canAdjust(req.user, entry.userId);
  if (!perm.ok) {
    if (perm.code === 404) return notFound(res, perm.reason);
    return forbidden(res, perm.reason);
  }

  await entry.destroy();
  return ok(res, { ok: true });
}

module.exports = { list, adjust, updateEntry, deleteEntry };
