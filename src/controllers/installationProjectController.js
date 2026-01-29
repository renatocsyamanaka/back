// src/controllers/installationProjectController.js
const Joi = require('joi');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const sequelize = require('../db');

const {
  InstallationProject,
  InstallationProjectItem,
  InstallationProjectProgress,
  InstallationProjectProgressVehicle,
  Client,
  User,
  Role,
} = require('../models');

const { ok, created, bad, notFound } = require('../utils/responses');
const { addBusinessDaysInclusive } = require('../utils/businessDays');

const { sendMail } = require('../services/mailer');
const {
  startEmailHtml,
  dailyEmailHtml,
  finalEmailHtml,
} = require('../services/installationProjectEmailTemplates');

// =========================================================
// Helpers
// =========================================================

// dias necessários = caminhões total / previsão por dia
function calcDaysNeeded(trucksTotal, perDay) {
  if (!perDay || perDay <= 0) return null;
  return Math.ceil((trucksTotal || 0) / perDay);
}

// ✅ supervisor = level 3, coordenador = level 4 (conforme sua tabela)
async function findCoordinatorIdFromSupervisor(supervisorId) {
  const supervisor = await User.findByPk(supervisorId, {
    attributes: ['id', 'name', 'managerId'],
    include: [{ model: Role, as: 'role', attributes: ['level', 'name'] }],
  });
  if (!supervisor) return { error: 'Supervisor não encontrado' };

  const lvl = supervisor.role?.level || 0;

  // supervisor precisa ser level 3
  if (lvl !== 3) return { error: 'Usuário selecionado não é supervisor (level 3)' };

  // sobe até achar coordenador (level >= 4)
  let cursor = supervisor;
  let hops = 0;

  while (cursor?.managerId && hops < 20) {
    hops += 1;

    const mgr = await User.findByPk(cursor.managerId, {
      attributes: ['id', 'name', 'managerId'],
      include: [{ model: Role, as: 'role', attributes: ['level', 'name'] }],
    });
    if (!mgr) break;

    const mgrLevel = mgr.role?.level || 0;
    if (mgrLevel >= 4) return { coordinatorId: mgr.id };

    cursor = mgr;
  }

  return { coordinatorId: null };
}

// ✅ valida se é técnico/prestador (level 1)
async function validateTechnicianId(technicianId) {
  if (!technicianId) return { technician: null };

  const tech = await User.findByPk(technicianId, {
    attributes: ['id', 'name'],
    include: [{ model: Role, as: 'role', attributes: ['level', 'name'] }],
  });

  if (!tech) return { error: 'Técnico/Prestador não encontrado' };

  const lvl = tech.role?.level || 0;
  if (lvl !== 1) return { error: 'Usuário selecionado não é técnico/prestador (level 1)' };

  return { technician: tech };
}

// ✅ carregar tudo para e-mail/Detalhe
async function loadProjectWithDetails(projectId) {
  return InstallationProject.findByPk(projectId, {
    include: [
      { model: Client, as: 'client', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'name'] },

      // ✅ supervisor/coordinator/technician
      { model: User, as: 'supervisor', attributes: ['id', 'name'] },
      { model: User, as: 'coordinator', attributes: ['id', 'name'] },
      { model: User, as: 'technician', attributes: ['id', 'name'] },

      { model: InstallationProjectItem, as: 'items' },
      {
        model: InstallationProjectProgress,
        as: 'progress',
        include: [
          { model: User, as: 'author', attributes: ['id', 'name'] },
          { model: InstallationProjectProgressVehicle, as: 'vehicles' },
        ],
      },
    ],
  });
}

// =========================================================
// Schemas
// =========================================================

const createSchema = Joi.object({
  title: Joi.string().required(),
  clientId: Joi.number().allow(null),

  af: Joi.string().max(50).allow('', null),

  contactName: Joi.string().allow('', null),

  // obrigatório (vai disparar emails)
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().allow('', null),

  // obrigatório
  startPlannedAt: Joi.date().required(),

  // obrigatório
  trucksTotal: Joi.number().integer().min(1).required(),

  // obrigatório
  equipmentsPerDay: Joi.number().integer().min(1).required(),

  // ✅ supervisor obrigatório (front envia)
  supervisorId: Joi.number().integer().required(),

  // ✅ NOVO: técnico/prestador que vai atender
  // (deixe optional aqui se você quiser cadastrar projeto sem definir na hora)
  technicianId: Joi.number().integer().allow(null),

  notes: Joi.string().allow('', null),

  // ⚠️ às vezes o front manda isso por engano — aceitamos para não quebrar,
  // mas NÃO usamos (recalcula via supervisor)
  coordinatorId: Joi.number().integer().allow(null),
}).options({ abortEarly: false, stripUnknown: true });

const listSchema = Joi.object({
  status: Joi.string().valid('A_INICIAR', 'INICIADO', 'FINALIZADO').allow(null),
  q: Joi.string().allow('', null),
  mine: Joi.boolean().default(false),
}).options({ abortEarly: false, stripUnknown: true });

// =========================================================
// Controller
// =========================================================

module.exports = {
  async list(req, res) {
    const { error, value } = listSchema.validate(req.query);
    if (error) return bad(res, error.message);

    const where = {};
    if (value.status) where.status = value.status;
    if (value.mine) where.createdById = req.user.id;

    if (value.q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${value.q}%` } },
        { contactName: { [Op.like]: `%${value.q}%` } },
        { contactEmail: { [Op.like]: `%${value.q}%` } },
        { af: { [Op.like]: `%${value.q}%` } },
      ];
    }

    const rows = await InstallationProject.findAll({
      where,
      order: [['id', 'DESC']],
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },

        // ✅ supervisor/coordinator/technician no list
        { model: User, as: 'supervisor', attributes: ['id', 'name'] },
        { model: User, as: 'coordinator', attributes: ['id', 'name'] },
        { model: User, as: 'technician', attributes: ['id', 'name'] },
      ],
    });

    return ok(res, rows);
  },

  async getById(req, res) {
    const project = await loadProjectWithDetails(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');
    return ok(res, project);
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return bad(res, error.message);

    // ✅ valida técnico (se vier)
    if (value.technicianId) {
      const { error: techErr } = await validateTechnicianId(value.technicianId);
      if (techErr) return bad(res, techErr);
    }

    // ✅ calcula coordenador pelo supervisor
    const { coordinatorId, error: coordErr } = await findCoordinatorIdFromSupervisor(value.supervisorId);
    if (coordErr) return bad(res, coordErr);

    const daysNeeded = calcDaysNeeded(value.trucksTotal, value.equipmentsPerDay);
    const endPlannedAt = addBusinessDaysInclusive(value.startPlannedAt, daysNeeded);

    const project = await InstallationProject.create({
      title: value.title,
      clientId: value.clientId ?? null,

      af: value.af ? String(value.af).trim() : null,

      contactName: value.contactName ?? null,
      contactEmail: value.contactEmail,
      contactPhone: value.contactPhone ?? null,

      startPlannedAt: value.startPlannedAt,

      trucksTotal: value.trucksTotal,
      equipmentsPerDay: value.equipmentsPerDay,

      notes: value.notes ?? null,

      supervisorId: value.supervisorId,
      coordinatorId: coordinatorId ?? null,

      // ✅ NOVO
      technicianId: value.technicianId ?? null,

      createdById: req.user.id,
      updatedById: req.user.id,

      status: 'A_INICIAR',
      trucksDone: 0,
      equipmentsTotal: 0,

      daysEstimated: daysNeeded,
      endPlannedAt,
    });

    const full = await loadProjectWithDetails(project.id);
    return created(res, full);
  },

  async update(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    // update: torna campos opcionais
    const schema = createSchema.fork(
      ['title', 'contactEmail', 'startPlannedAt', 'trucksTotal', 'equipmentsPerDay', 'supervisorId'],
      (s) => s.optional()
    );

    const { error, value } = schema.validate(req.body);
    if (error) return bad(res, error.message);

    // ⚠️ IMPORTANTE: ignore coordinatorId vindo do front (se vier)
    // sempre recalculamos via supervisor quando supervisorId vier.
    const { coordinatorId: _ignoreCoordinatorId, ...rest } = value;

    // ✅ valida técnico (se vier no update)
    if (rest.technicianId !== undefined && rest.technicianId !== null) {
      const { error: techErr } = await validateTechnicianId(rest.technicianId);
      if (techErr) return bad(res, techErr);
    }

    const next = {
      ...rest,
      af: rest.af === '' ? null : rest.af ?? project.af,
      updatedById: req.user.id,
    };

    // ✅ se supervisor mudar, recalcula coordinatorId
    if (rest.supervisorId) {
      const { coordinatorId, error: coordErr } = await findCoordinatorIdFromSupervisor(rest.supervisorId);
      if (coordErr) return bad(res, coordErr);
      next.coordinatorId = coordinatorId ?? null;
    }

    // ✅ Recalcular previsão final se mudar data/perDay/trucksTotal
    const trucksTotal = rest.trucksTotal ?? project.trucksTotal;
    const perDay = rest.equipmentsPerDay ?? project.equipmentsPerDay;
    const startPlannedAt = rest.startPlannedAt ?? project.startPlannedAt;

    const daysNeeded = calcDaysNeeded(trucksTotal, perDay);
    next.daysEstimated = daysNeeded;
    next.endPlannedAt = addBusinessDaysInclusive(startPlannedAt, daysNeeded);

    await project.update(next);

    const full = await loadProjectWithDetails(project.id);
    return ok(res, full);
  },

  async setWhatsApp(req, res) {
    const schema = Joi.object({
      whatsappGroupName: Joi.string().allow('', null),
      whatsappGroupLink: Joi.string().uri().allow('', null),
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body);
    if (error) return bad(res, error.message);

    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    await project.update({ ...value, updatedById: req.user.id });
    const full = await loadProjectWithDetails(project.id);
    return ok(res, full);
  },

  async start(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    if (!project.startPlannedAt) return bad(res, 'Defina a data de início prevista antes de iniciar');
    if (!project.contactEmail) return bad(res, 'Defina o e-mail do cliente antes de iniciar');
    if (project.trucksTotal <= 0) return bad(res, 'Defina a quantidade total de caminhões');
    if (!project.equipmentsPerDay || project.equipmentsPerDay <= 0)
      return bad(res, 'Defina a previsão de instalação por dia');

    if (!project.supervisorId) return bad(res, 'Defina o supervisor do projeto antes de iniciar');

    // ✅ NOVO: exigir técnico antes de iniciar (se você quiser)
    if (!project.technicianId) return bad(res, 'Defina o técnico/prestador do projeto antes de iniciar');

    await project.update({
      status: 'INICIADO',
      startAt: project.startAt || new Date(),
      updatedById: req.user.id,
    });

    const full = await loadProjectWithDetails(project.id);
    return ok(res, full);
  },

  async finish(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    if (project.trucksDone < project.trucksTotal) {
      return bad(res, 'Ainda existem caminhões pendentes para finalizar');
    }

    await project.update({
      status: 'FINALIZADO',
      endAt: new Date(),
      updatedById: req.user.id,
    });

    const full = await loadProjectWithDetails(project.id);
    return ok(res, full);
  },

  async addItem(req, res) {
    const schema = Joi.object({
      equipmentName: Joi.string().required(),
      equipmentCode: Joi.string().allow('', null),
      qty: Joi.number().integer().min(1).default(1),
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body);
    if (error) return bad(res, error.message);

    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const item = await InstallationProjectItem.create({
      projectId: project.id,
      ...value,
    });

    const items = await InstallationProjectItem.findAll({ where: { projectId: project.id } });
    const equipmentsTotal = items.reduce((sum, it) => sum + (it.qty || 0), 0);

    await project.update({
      equipmentsTotal,
      updatedById: req.user.id,
    });

    return created(res, item);
  },

  async addProgress(req, res) {
    const schema = Joi.object({
      date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
          'string.pattern.base': 'date inválida. Use YYYY-MM-DD',
          'any.required': 'Informe a date (YYYY-MM-DD)',
        }),
      notes: Joi.string().allow('', null),
      vehicles: Joi.array()
        .items(
          Joi.object({
            plate: Joi.string().trim().min(5).max(10).required(),
            serial: Joi.string().trim().min(3).max(60).required(),
          })
        )
        .min(1)
        .required(),
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body);
    if (error) return bad(res, error.message);

    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const t = await sequelize.transaction();
    try {
      const trucksDoneToday = value.vehicles.length;

      const progress = await InstallationProjectProgress.create(
        {
          projectId: project.id,
          date: value.date,
          trucksDoneToday,
          notes: value.notes,
          createdById: req.user.id,
        },
        { transaction: t }
      );

      await InstallationProjectProgressVehicle.bulkCreate(
        value.vehicles.map((v) => ({
          progressId: progress.id,
          plate: String(v.plate).toUpperCase(),
          serial: String(v.serial),
        })),
        { transaction: t }
      );

      const all = await InstallationProjectProgress.findAll({
        where: { projectId: project.id },
        transaction: t,
      });

      const trucksDone = all.reduce((sum, p) => sum + (p.trucksDoneToday || 0), 0);

      await project.update({ trucksDone, updatedById: req.user.id }, { transaction: t });

      await t.commit();

      const full = await InstallationProjectProgress.findByPk(progress.id, {
        include: [{ model: InstallationProjectProgressVehicle, as: 'vehicles' }],
      });

      return created(res, full);
    } catch (err) {
      await t.rollback();
      return bad(res, err.message || 'Erro ao lançar progresso');
    }
  },

  // =========================================================
  // E-mails
  // =========================================================

  async sendStartEmail(req, res) {
    const schema = Joi.object({
      emailTo: Joi.string().email().allow('', null),
      emailCc: Joi.array().items(Joi.string().email()).allow(null),
      message: Joi.string().allow('', null),
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body || {});
    if (error) return bad(res, error.message);

    const project = await loadProjectWithDetails(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const p = project.toJSON();
    const to = (value.emailTo || p.contactEmail || '').trim();
    if (!to) return bad(res, 'Projeto sem e-mail de contato (contactEmail) e emailTo não informado');

    const subject = `INÍCIO • ${p.title}${p.af ? ` • ${p.af}` : ''}`;
    const html = startEmailHtml(p, value.message);

    await sendMail({
      to,
      cc: value.emailCc || undefined,
      subject,
      html,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });

    return ok(res, { sent: true });
  },

  async sendDailyEmail(req, res) {
    const schema = Joi.object({
      emailTo: Joi.string().email().allow('', null),
      emailCc: Joi.array().items(Joi.string().email()).allow(null),
      date: Joi.string().allow('', null), // YYYY-MM-DD ou ISO
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body || {});
    if (error) return bad(res, error.message);

    try {
      const project = await InstallationProject.findByPk(req.params.id, {
        include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
      });
      if (!project) return notFound(res, 'Projeto não encontrado');

      const to = String(value.emailTo || project.contactEmail || '').trim();
      if (!to) return bad(res, 'Projeto sem e-mail de contato (contactEmail) e emailTo não informado');

      const targetDate = value.date ? String(value.date).slice(0, 10) : dayjs().format('YYYY-MM-DD');

      if (!dayjs(targetDate, 'YYYY-MM-DD', true).isValid()) {
        return bad(res, 'date inválido. Use YYYY-MM-DD');
      }

      const progressList = await InstallationProjectProgress.findAll({
        where: {
          projectId: project.id,
          date: targetDate,
        },
        order: [['date', 'ASC'], ['id', 'ASC']],
        include: [
          { model: User, as: 'author', attributes: ['id', 'name'] },
          { model: InstallationProjectProgressVehicle, as: 'vehicles' },
        ],
      });

      const p = project.toJSON ? project.toJSON() : project;
      const html = dailyEmailHtml(p, progressList, targetDate);

      await sendMail({
        to,
        cc: value.emailCc?.length ? value.emailCc : undefined,
        subject: `Reporte Diário • ${project.title}${project.af ? ` • ${project.af}` : ''} • ${targetDate}`,
        html,
        replyTo: process.env.MAIL_REPLY_TO || undefined,
      });

      return ok(res, { sent: true, to, targetDate, count: progressList.length });
    } catch (err) {
      console.error('sendDailyEmail error:', err);
      return bad(res?.message || 'Erro ao enviar reporte diário');
    }
  },

  async sendFinalEmail(req, res) {
    const schema = Joi.object({
      emailTo: Joi.string().email().allow('', null),
      emailCc: Joi.array().items(Joi.string().email()).allow(null),
      procedures: Joi.string().allow('', null),
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body || {});
    if (error) return bad(res, error.message);

    const project = await loadProjectWithDetails(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const p = project.toJSON();
    const to = (value.emailTo || p.contactEmail || '').trim();
    if (!to) return bad(res, 'Projeto sem e-mail de contato (contactEmail) e emailTo não informado');

    const progressList = Array.isArray(p.progress) ? p.progress : [];
    progressList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const subject = `ENCERRAMENTO • ${p.title}${p.af ? ` • ${p.af}` : ''}`;
    const html = finalEmailHtml(p, progressList, value.procedures);

    await sendMail({
      to,
      cc: value.emailCc || undefined,
      subject,
      html,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });

    return ok(res, { sent: true, count: progressList.length });
  },
};
