const Joi = require('joi');
const { Op } = require('sequelize');
const { User, Role, UserRegistrationRequest } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');

const ALLOWED_EMAIL_DOMAINS = [
  'omnilink.com.br',
  'showtecnologia.com.br',
  'noriomomoi.com.br',
];

function isAllowedCorporateEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const parts = normalized.split('@');
  const domain = parts[1];
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain);
}

const createSchema = Joi.object({
  fullName: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  sex: Joi.string().valid('M', 'F', 'O').allow(null, ''),
  phone: Joi.string().allow('', null),
});

const approveSchema = Joi.object({
  fullName: Joi.string().required(),
  email: Joi.string().email().required(),
  sex: Joi.string().valid('M', 'F', 'O').allow(null, ''),
  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null),
  phone: Joi.string().allow('', null),
  reviewNotes: Joi.string().allow('', null),
});

async function createRequest(req, res) {
  try {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false });
    if (error) return bad(res, error.details.map((x) => x.message).join(', '));

    if (!isAllowedCorporateEmail(value.email)) {
      return bad(
        res,
        'Somente e-mails corporativos são permitidos: @omnilink.com.br, @showtecnologia.com.br ou @noriomomoi.com.br'
      );
    }

    const emailExistsUser = await User.findOne({
      where: { email: value.email.toLowerCase() },
    });
    if (emailExistsUser) return bad(res, 'Já existe um usuário com esse e-mail');

    const emailExistsRequest = await UserRegistrationRequest.findOne({
      where: {
        email: value.email.toLowerCase(),
        status: { [Op.in]: ['PENDING', 'APPROVED'] },
      },
    });
    if (emailExistsRequest) return bad(res, 'Já existe solicitação para esse e-mail');

    const row = await UserRegistrationRequest.create({
      fullName: value.fullName,
      email: value.email.toLowerCase(),
      password_hash: value.password,
      sex: value.sex || null,
      phone: value.phone || null,
      avatarUrl: req.file ? `/uploads/avatars/${req.file.filename}` : null,
      status: 'PENDING',
    });

    return created(res, {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
    });
  } catch (e) {
    return bad(res, e.message || 'Erro ao criar solicitação');
  }
}

async function listRequests(req, res) {
  try {
    const rows = await UserRegistrationRequest.findAll({
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name', 'level'] },
        { model: User, as: 'manager', attributes: ['id', 'name'] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
        { model: User, as: 'rejectedBy', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return ok(res, rows);
  } catch (e) {
    return bad(res, e.message || 'Erro ao listar solicitações');
  }
}

async function approveRequest(req, res) {
  try {
    const id = Number(req.params.id);

    const { error, value } = approveSchema.validate(req.body, { abortEarly: false });
    if (error) return bad(res, error.details.map((x) => x.message).join(', '));

    if (!isAllowedCorporateEmail(value.email)) {
      return bad(
        res,
        'Somente e-mails corporativos são permitidos: @omnilink.com.br, @showtecnologia.com.br ou @noriomomoi.com.br'
      );
    }

    const row = await UserRegistrationRequest.findByPk(id);
    if (!row) return notFound(res, 'Solicitação não encontrada');
    if (row.status !== 'PENDING') return bad(res, 'Solicitação já analisada');

    const existingUser = await User.findOne({
      where: { email: value.email.toLowerCase() },
    });
    if (existingUser) return bad(res, 'Já existe usuário com esse e-mail');

    if (value.managerId) {
      const manager = await User.findByPk(value.managerId);
      if (!manager) return bad(res, 'Gestor informado não encontrado');
    }

    const user = await User.create({
      name: value.fullName,
      email: value.email.toLowerCase(),
      password_hash: row.password_hash,
      sex: value.sex || null,
      roleId: value.roleId,
      managerId: value.managerId ?? null,
      phone: value.phone || null,
      avatarUrl: row.avatarUrl || null,
      loginEnabled: true,
      isActive: true,
    });

    await row.update({
      fullName: value.fullName,
      email: value.email.toLowerCase(),
      sex: value.sex || null,
      roleId: value.roleId,
      managerId: value.managerId ?? null,
      phone: value.phone || null,
      status: 'APPROVED',
      reviewNotes: value.reviewNotes || null,
      approvedById: req.user.id,
      approvedAt: new Date(),
    });

    return ok(res, {
      message: 'Solicitação aprovada com sucesso',
      user,
    });
  } catch (e) {
    return bad(res, e.message || 'Erro ao aprovar solicitação');
  }
}

async function rejectRequest(req, res) {
  try {
    const id = Number(req.params.id);
    const row = await UserRegistrationRequest.findByPk(id);
    if (!row) return notFound(res, 'Solicitação não encontrada');
    if (row.status !== 'PENDING') return bad(res, 'Solicitação já analisada');

    await row.update({
      status: 'REJECTED',
      reviewNotes: req.body?.reviewNotes || null,
      rejectedById: req.user.id,
      rejectedAt: new Date(),
    });

    return ok(res, { message: 'Solicitação reprovada com sucesso' });
  } catch (e) {
    return bad(res, e.message || 'Erro ao reprovar solicitação');
  }
}

module.exports = {
  createRequest,
  listRequests,
  approveRequest,
  rejectRequest,
};