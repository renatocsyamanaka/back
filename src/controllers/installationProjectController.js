const Joi = require('joi');
const { Op, fn, col } = require('sequelize');
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

function normalizeEmailList(input) {
  let arr = input;

  if (!arr) return [];

  if (typeof arr === 'string') {
    arr = arr.split(/[;,]/);
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  return [
    ...new Set(
      arr
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function normalizeIdList(input) {
  let arr = input;

  if (!arr) return [];

  if (typeof arr === 'string') {
    const trimmed = arr.trim();

    if (!trimmed) return [];

    try {
      arr = JSON.parse(trimmed);
    } catch {
      arr = [trimmed];
    }
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  return [
    ...new Set(
      arr
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0)
    ),
  ];
}

function calcDaysNeeded(trucksTotal, perDay) {
  if (!perDay || perDay <= 0) return null;
  return Math.ceil((trucksTotal || 0) / perDay);
}

function isValidDateOnly(value) {
  if (value == null || value === '') return true;
  return dayjs(value, 'YYYY-MM-DD', true).isValid();
}

function normalizeDateOnly(value) {
  if (value == null || value === '') return null;
  const str = String(value).slice(0, 10);

  if (!dayjs(str, 'YYYY-MM-DD', true).isValid()) {
    return null;
  }

  return str;
}

async function findCoordinatorIdFromSupervisor(supervisorId) {
  const supervisor = await User.findByPk(supervisorId, {
    attributes: ['id', 'name', 'managerId'],
    include: [{ model: Role, as: 'role', attributes: ['level', 'name'] }],
  });

  if (!supervisor) return { error: 'Supervisor não encontrado' };

  const lvl = supervisor.role?.level || 0;
  if (lvl !== 3) return { error: 'Usuário selecionado não é supervisor (level 3)' };

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

async function validateTechnicianIds(technicianIds = []) {
  if (!Array.isArray(technicianIds) || !technicianIds.length) {
    return { technicians: [] };
  }

  const uniqueIds = [...new Set(technicianIds.map(Number).filter(Boolean))];
  const technicians = [];

  for (const technicianId of uniqueIds) {
    const tech = await User.findByPk(technicianId, {
      attributes: ['id', 'name'],
      include: [{ model: Role, as: 'role', attributes: ['level', 'name'] }],
    });

    if (!tech) {
      return { error: `Técnico/Prestador ${technicianId} não encontrado` };
    }

    const lvl = tech.role?.level || 0;
    if (![1, 8].includes(lvl)) {
      return { error: `Usuário ${tech.name} não é técnico/prestador válido` };
    }

    technicians.push(tech);
  }

  return { technicians };
}

async function attachTechniciansToProject(project) {
  if (!project) return project;

  const data = project.toJSON ? project.toJSON() : project;

  const technicianIds = normalizeIdList(
    data.technicianIds?.length ? data.technicianIds : data.technicianId
  );

  if (!technicianIds.length) {
    data.techniciansList = [];
    data.technicianNames = data.technician ? [data.technician.name] : [];
    return data;
  }

  let techs = [];
  try {
    techs = await User.findAll({
      where: { id: { [Op.in]: technicianIds } },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
  } catch (err) {
    console.error('attachTechniciansToProject error:', {
      technicianIds,
      message: err?.message,
      sqlMessage: err?.original?.sqlMessage,
      sql: err?.sql,
    });
    techs = [];
  }

  data.techniciansList = techs.map((t) => ({
    id: t.id,
    name: t.name,
  }));

  data.technicianNames = data.techniciansList.map((t) => t.name);

  return data;
}

async function attachTechniciansToProjects(projects = []) {
  if (!Array.isArray(projects) || !projects.length) return [];

  const rows = projects.map((p) => (p.toJSON ? p.toJSON() : p));

  const allIds = [
    ...new Set(
      rows.flatMap((row) =>
        normalizeIdList(row.technicianIds?.length ? row.technicianIds : row.technicianId)
      )
    ),
  ].filter((id) => Number.isInteger(id) && id > 0);

  if (!allIds.length) {
    return rows.map((row) => ({
      ...row,
      techniciansList: [],
      technicianNames: row.technician ? [row.technician.name] : [],
    }));
  }

  let techs = [];
  try {
    techs = await User.findAll({
      where: { id: { [Op.in]: allIds } },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
  } catch (err) {
    console.error('attachTechniciansToProjects error:', {
      allIds,
      message: err?.message,
      sqlMessage: err?.original?.sqlMessage,
      sql: err?.sql,
    });

    return rows.map((row) => ({
      ...row,
      techniciansList: [],
      technicianNames: row.technician ? [row.technician.name] : [],
    }));
  }

  const techMap = new Map(techs.map((t) => [Number(t.id), { id: t.id, name: t.name }]));

  return rows.map((row) => {
    const technicianIds = normalizeIdList(
      row.technicianIds?.length ? row.technicianIds : row.technicianId
    );

    const techniciansList = technicianIds
      .map((id) => techMap.get(Number(id)))
      .filter(Boolean);

    return {
      ...row,
      techniciansList,
      technicianNames: techniciansList.map((t) => t.name),
    };
  });
}

async function loadProjectWithDetails(projectId) {
  const project = await InstallationProject.findByPk(projectId, {
    include: [
      { model: Client, as: 'client', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'name'] },
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
    order: [
      [{ model: InstallationProjectProgress, as: 'progress' }, 'date', 'ASC'],
      [{ model: InstallationProjectProgress, as: 'progress' }, 'id', 'ASC'],
    ],
  });

  return attachTechniciansToProject(project);
}

async function recalcProjectStats(projectId, transaction) {
  const rows = await InstallationProjectProgress.findAll({
    where: { projectId },
    transaction,
  });

  const trucksDone = rows.reduce((sum, item) => {
    const completed = Number(item.completedInstallations ?? item.trucksDoneToday ?? 0);
    return sum + completed;
  }, 0);

  await InstallationProject.update(
    { trucksDone },
    {
      where: { id: projectId },
      transaction,
    }
  );

  return { trucksDone };
}

// =========================================================
// Schemas
// =========================================================

const dateOnlyField = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .allow(null, '')
  .messages({
    'string.pattern.base': 'Use o formato YYYY-MM-DD',
  });

const startFinishSchema = Joi.object({
  sendEmail: Joi.boolean().default(true),
  emailTo: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email()).min(1)
  ).allow(null),
  emailCc: Joi.array().items(Joi.string().email()).allow(null),
  message: Joi.string().allow('', null),
}).options({ abortEarly: false, stripUnknown: true });

const createSchema = Joi.object({
  title: Joi.string().required(),
  clientId: Joi.number().allow(null),

  af: Joi.string().max(50).allow('', null),

  contactName: Joi.string().allow('', null),
  contactEmail: Joi.string().email().allow('', null),
  contactEmails: Joi.array().items(Joi.string().email()).min(1).required(),
  contactPhone: Joi.string().allow('', null),

  startPlannedAt: dateOnlyField,
  endPlannedAt: dateOnlyField,

  trucksTotal: Joi.number().integer().min(1).required(),
  equipmentsPerDay: Joi.number().integer().min(1).required(),

  dailyGoal: Joi.number().integer().min(0).allow(null),
  weeklyGoal: Joi.number().integer().min(0).allow(null),

  supervisorId: Joi.number().integer().required(),
  technicianId: Joi.number().integer().allow(null),
  technicianIds: Joi.array().items(Joi.number().integer()).optional(),

  notes: Joi.string().allow('', null),
  coordinatorId: Joi.number().integer().allow(null),

  requestedLocationText: Joi.string().allow('', null),
  requestedCity: Joi.string().allow('', null),
  requestedState: Joi.string().max(2).allow('', null),
  requestedCep: Joi.string().allow('', null),
  requestedLat: Joi.number().allow(null),
  requestedLng: Joi.number().allow(null),
}).options({ abortEarly: false, stripUnknown: true });

const listSchema = Joi.object({
  status: Joi.string().valid('A_INICIAR', 'INICIADO', 'FINALIZADO').allow(null),
  q: Joi.string().allow('', null),
  mine: Joi.boolean().default(false),
  delayed: Joi.boolean().allow(null),
}).options({ abortEarly: false, stripUnknown: true });

const emailSendSchema = Joi.object({
  emailTo: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email()).min(1)
  ).allow('', null),
  emailCc: Joi.array().items(Joi.string().email()).allow(null),
}).options({ abortEarly: false, stripUnknown: true });

const progressSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'date inválida. Use YYYY-MM-DD',
      'any.required': 'Informe a date (YYYY-MM-DD)',
    }),
  notes: Joi.string().allow('', null),

  plannedInstallations: Joi.number().integer().min(0).allow(null),
  completedInstallations: Joi.number().integer().min(0).allow(null),
  failedInstallations: Joi.number().integer().min(0).default(0),

  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),

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

    if (value.delayed === true) {
      where.status = { [Op.ne]: 'FINALIZADO' };
      where.endPlannedAt = { [Op.lt]: dayjs().format('YYYY-MM-DD') };
    }

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
        { model: User, as: 'supervisor', attributes: ['id', 'name'] },
        { model: User, as: 'coordinator', attributes: ['id', 'name'] },
        { model: User, as: 'technician', attributes: ['id', 'name'] },
      ],
    });

    const enriched = await attachTechniciansToProjects(rows);
    return ok(res, enriched);
  },

  async getById(req, res) {
    const project = await loadProjectWithDetails(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');
    return ok(res, project);
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const startPlannedAt = normalizeDateOnly(value.startPlannedAt);
    const endPlannedAtInput = normalizeDateOnly(value.endPlannedAt);

    if (!isValidDateOnly(value.startPlannedAt)) {
      return bad(res, 'Data prevista de início inválida. Use YYYY-MM-DD');
    }

    if (!isValidDateOnly(value.endPlannedAt)) {
      return bad(res, 'Data prevista de término inválida. Use YYYY-MM-DD');
    }

    const normalizedEmails = normalizeEmailList(value.contactEmails || value.contactEmail);
    if (!normalizedEmails.length) {
      return bad(res, 'Informe pelo menos um e-mail de contato');
    }

    const normalizedTechnicianIds = normalizeIdList(
      value.technicianIds || (value.technicianId ? [value.technicianId] : [])
    );

    const { error: techErr } = await validateTechnicianIds(normalizedTechnicianIds);
    if (techErr) return bad(res, techErr);

    const { coordinatorId, error: coordErr } =
      await findCoordinatorIdFromSupervisor(value.supervisorId);
    if (coordErr) return bad(res, coordErr);

    const daysNeeded = calcDaysNeeded(value.trucksTotal, value.equipmentsPerDay);

    const endPlannedAt =
      endPlannedAtInput != null
        ? endPlannedAtInput
        : startPlannedAt
          ? addBusinessDaysInclusive(startPlannedAt, daysNeeded)
          : null;

      const project = await InstallationProject.create({
        title: value.title,
        clientId: value.clientId ?? null,
        af: value.af ? String(value.af).trim() : null,

        contactName: value.contactName ?? null,
        contactEmail: normalizedEmails[0],
        contactEmails: normalizedEmails,
        contactPhone: value.contactPhone ?? null,

        startPlannedAt,
        endPlannedAt,

        trucksTotal: value.trucksTotal,
        equipmentsPerDay: value.equipmentsPerDay,
        dailyGoal: value.dailyGoal ?? null,
        weeklyGoal: value.weeklyGoal ?? null,
        notes: value.notes ?? null,

        supervisorId: value.supervisorId,
        coordinatorId: coordinatorId ?? null,

        technicianId: normalizedTechnicianIds[0] || null,
        technicianIds: normalizedTechnicianIds.length ? normalizedTechnicianIds : [],

        requestedLocationText: value.requestedLocationText ?? null,
        requestedCity: value.requestedCity ?? null,
        requestedState: value.requestedState ?? null,
        requestedCep: value.requestedCep ?? null,
        requestedLat: value.requestedLat ?? null,
        requestedLng: value.requestedLng ?? null,

        createdById: req.user.id,
        updatedById: req.user.id,

        status: 'A_INICIAR',
        trucksDone: 0,
        equipmentsTotal: 0,
        daysEstimated: daysNeeded,
      });

    const full = await loadProjectWithDetails(project.id);
    return created(res, full);
  },

  async update(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const schema = createSchema.fork(
      [
        'title',
        'contactEmails',
        'startPlannedAt',
        'endPlannedAt',
        'trucksTotal',
        'equipmentsPerDay',
        'dailyGoal',
        'weeklyGoal',
        'supervisorId',
        'technicianIds',
      ],
      (s) => s.optional()
    );

    const { error, value } = schema.validate(req.body);
    if (error) return bad(res, error.message);

    const { coordinatorId: _ignoreCoordinatorId, ...rest } = value;
    const next = {
      ...rest,
      updatedById: req.user.id,
    };
    if (Object.prototype.hasOwnProperty.call(rest, 'requestedState')) {
      next.requestedState = rest.requestedState ? String(rest.requestedState).trim().toUpperCase() : null;
    }

    if (rest.contactEmails !== undefined || rest.contactEmail !== undefined) {
      const normalizedEmails = normalizeEmailList(rest.contactEmails || rest.contactEmail);

      if (!normalizedEmails.length) {
        return bad(res, 'Informe pelo menos um e-mail de contato');
      }

      next.contactEmails = normalizedEmails;
      next.contactEmail = normalizedEmails[0];
    }

    if (rest.technicianIds !== undefined || rest.technicianId !== undefined) {
      const normalizedTechnicianIds = normalizeIdList(
        rest.technicianIds || (rest.technicianId ? [rest.technicianId] : [])
      );

      const { error: techErr } = await validateTechnicianIds(normalizedTechnicianIds);
      if (techErr) return bad(res, techErr);

      next.technicianIds = normalizedTechnicianIds.length ? normalizedTechnicianIds : [];
      next.technicianId = normalizedTechnicianIds[0] || null;
    }

    if (rest.supervisorId) {
      const { coordinatorId, error: coordErr } =
        await findCoordinatorIdFromSupervisor(rest.supervisorId);
      if (coordErr) return bad(res, coordErr);

      next.coordinatorId = coordinatorId ?? null;
    }

    const trucksTotal = rest.trucksTotal ?? project.trucksTotal;
    const perDay = rest.equipmentsPerDay ?? project.equipmentsPerDay;
    const daysNeeded = calcDaysNeeded(trucksTotal, perDay);
    next.daysEstimated = daysNeeded;

    if (Object.prototype.hasOwnProperty.call(rest, 'startPlannedAt')) {
      if (!isValidDateOnly(rest.startPlannedAt)) {
        return bad(res, 'Data prevista de início inválida. Use YYYY-MM-DD');
      }
      next.startPlannedAt = normalizeDateOnly(rest.startPlannedAt);
    }

    if (Object.prototype.hasOwnProperty.call(rest, 'endPlannedAt')) {
      if (!isValidDateOnly(rest.endPlannedAt)) {
        return bad(res, 'Data prevista de término inválida. Use YYYY-MM-DD');
      }
      next.endPlannedAt = normalizeDateOnly(rest.endPlannedAt);
    }

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
    const { error, value } = startFinishSchema.validate(req.body || {});
    if (error) return bad(res, error.message);

    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    if (!project.startPlannedAt) {
      return bad(res, 'Defina a data de início prevista antes de iniciar');
    }

    const emails = Array.isArray(project.contactEmails) ? project.contactEmails : [];
    if (!emails.length && !project.contactEmail) {
      return bad(res, 'Defina pelo menos um e-mail do cliente antes de iniciar');
    }

    if (project.trucksTotal <= 0) {
      return bad(res, 'Defina a quantidade total de caminhões');
    }

    if (!project.equipmentsPerDay || project.equipmentsPerDay <= 0) {
      return bad(res, 'Defina a previsão de instalação por dia');
    }

    if (!project.supervisorId) {
      return bad(res, 'Defina o supervisor do projeto antes de iniciar');
    }

    const technicianIds = normalizeIdList(
      project.technicianIds?.length ? project.technicianIds : project.technicianId
    );

    if (!technicianIds.length) {
      return bad(res, 'Defina pelo menos um técnico/prestador antes de iniciar');
    }

    await project.update({
      status: 'INICIADO',
      startAt: project.startAt || new Date(),
      updatedById: req.user.id,
    });

    const full = await loadProjectWithDetails(project.id);
    const p = full?.toJSON ? full.toJSON() : full;

    let emailResult = {
      attempted: false,
      sent: false,
      to: [],
      error: null,
    };

    if (value.sendEmail !== false) {
      try {
        const to = normalizeEmailList(value.emailTo || p.contactEmails || p.contactEmail);

        if (to.length) {
          const subject = `INÍCIO • ${p.title}${p.af ? ` • ${p.af}` : ''}`;
          const html = startEmailHtml(p, value.message);

          await sendMail({
            to,
            cc: value.emailCc?.length ? value.emailCc : undefined,
            subject,
            html,
            replyTo: process.env.MAIL_REPLY_TO || undefined,
          });

          emailResult = {
            attempted: true,
            sent: true,
            to,
            error: null,
          };
        } else {
          emailResult = {
            attempted: true,
            sent: false,
            to: [],
            error: 'Projeto sem e-mail de contato',
          };
        }
      } catch (err) {
        console.error('start project email error:', err);
        emailResult = {
          attempted: true,
          sent: false,
          to: [],
          error: err.message || 'Falha ao enviar e-mail de início',
        };
      }
    }

    return ok(res, {
      ...p,
      emailResult,
    });
  },

  async finish(req, res) {
    const { error, value } = startFinishSchema.validate(req.body || {});
    if (error) return bad(res, error.message);

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
    const p = full?.toJSON ? full.toJSON() : full;

    let emailResult = {
      attempted: false,
      sent: false,
      to: [],
      error: null,
    };

    if (value.sendEmail !== false) {
      try {
        const to = normalizeEmailList(value.emailTo || p.contactEmails || p.contactEmail);

        if (to.length) {
          const progressList = await InstallationProjectProgress.findAll({
            where: { projectId: project.id },
            order: [['date', 'ASC'], ['id', 'ASC']],
            include: [
              { model: User, as: 'author', attributes: ['id', 'name'] },
              { model: InstallationProjectProgressVehicle, as: 'vehicles' },
            ],
          });

          const html = finalEmailHtml(p, progressList, value.message);

          await sendMail({
            to,
            cc: value.emailCc?.length ? value.emailCc : undefined,
            subject: `ENCERRAMENTO • ${p.title}${p.af ? ` • ${p.af}` : ''}`,
            html,
            replyTo: process.env.MAIL_REPLY_TO || undefined,
          });

          emailResult = {
            attempted: true,
            sent: true,
            to,
            error: null,
          };
        } else {
          emailResult = {
            attempted: true,
            sent: false,
            to: [],
            error: 'Projeto sem e-mail de contato',
          };
        }
      } catch (err) {
        console.error('finish project email error:', err);
        emailResult = {
          attempted: true,
          sent: false,
          to: [],
          error: err.message || 'Falha ao enviar e-mail de encerramento',
        };
      }
    }

    return ok(res, {
      ...p,
      emailResult,
    });
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

    const items = await InstallationProjectItem.findAll({
      where: { projectId: project.id },
    });

    const equipmentsTotal = items.reduce((sum, it) => sum + (it.qty || 0), 0);

    await project.update({
      equipmentsTotal,
      updatedById: req.user.id,
    });

    return created(res, item);
  },

  async updateItem(req, res) {
    const schema = Joi.object({
      equipmentName: Joi.string().trim().required(),
      equipmentCode: Joi.string().allow('', null),
      qty: Joi.number().integer().min(1).required(),
    }).options({ abortEarly: false, stripUnknown: true });

    const { error, value } = schema.validate(req.body);
    if (error) return bad(res, error.message);

    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const item = await InstallationProjectItem.findOne({
      where: {
        id: req.params.itemId,
        projectId: project.id,
      },
    });

    if (!item) return notFound(res, 'Item não encontrado');

    await item.update({
      equipmentName: value.equipmentName,
      equipmentCode: value.equipmentCode || null,
      qty: value.qty,
    });

    const items = await InstallationProjectItem.findAll({
      where: { projectId: project.id },
    });

    const equipmentsTotal = items.reduce((sum, it) => sum + (it.qty || 0), 0);

    await project.update({
      equipmentsTotal,
      updatedById: req.user.id,
    });

    return ok(res, item);
  },

  async removeItem(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const item = await InstallationProjectItem.findOne({
      where: {
        id: req.params.itemId,
        projectId: project.id,
      },
    });

    if (!item) return notFound(res, 'Item não encontrado');

    await item.destroy();

    const items = await InstallationProjectItem.findAll({
      where: { projectId: project.id },
    });

    const equipmentsTotal = items.reduce((sum, it) => sum + (it.qty || 0), 0);

    await project.update({
      equipmentsTotal,
      updatedById: req.user.id,
    });

    return ok(res, { message: 'Item excluído com sucesso.' });
  },

  async addProgress(req, res) {
    const { error, value } = progressSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const t = await sequelize.transaction();

    try {
      const trucksDoneToday = value.vehicles.length;
      const completedInstallations = value.completedInstallations ?? trucksDoneToday;

      const progress = await InstallationProjectProgress.create(
        {
          projectId: project.id,
          date: value.date,
          trucksDoneToday,
          completedInstallations,
          failedInstallations: value.failedInstallations ?? 0,
          plannedInstallations: value.plannedInstallations ?? null,
          lat: value.lat ?? null,
          lng: value.lng ?? null,
          notes: value.notes ?? null,
          createdById: req.user.id,
        },
        { transaction: t }
      );

      await InstallationProjectProgressVehicle.bulkCreate(
        value.vehicles.map((v) => ({
          progressId: progress.id,
          plate: String(v.plate).trim().toUpperCase(),
          serial: String(v.serial).trim(),
        })),
        { transaction: t }
      );

      await recalcProjectStats(project.id, t);

      await project.update(
        {
          updatedById: req.user.id,
        },
        { transaction: t }
      );

      await t.commit();

      const full = await InstallationProjectProgress.findByPk(progress.id, {
        include: [{ model: InstallationProjectProgressVehicle, as: 'vehicles' }],
      });

      return created(res, full);
    } catch (err) {
      await t.rollback();
      console.error('addProgress error:', err);
      return bad(res, err.message || 'Erro ao lançar progresso');
    }
  },

  async updateProgress(req, res) {
    const { error, value } = progressSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const progress = await InstallationProjectProgress.findByPk(req.params.progressId);
    if (!progress) return notFound(res, 'Progresso não encontrado');

    const project = await InstallationProject.findByPk(progress.projectId);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const t = await sequelize.transaction();

    try {
      const trucksDoneToday = value.vehicles.length;
      const completedInstallations = value.completedInstallations ?? trucksDoneToday;

      await progress.update(
        {
          date: value.date,
          notes: value.notes ?? null,
          trucksDoneToday,
          completedInstallations,
          failedInstallations: value.failedInstallations ?? 0,
          plannedInstallations: value.plannedInstallations ?? null,
          lat: value.lat ?? null,
          lng: value.lng ?? null,
        },
        { transaction: t }
      );

      await InstallationProjectProgressVehicle.destroy({
        where: { progressId: progress.id },
        transaction: t,
      });

      await InstallationProjectProgressVehicle.bulkCreate(
        value.vehicles.map((v) => ({
          progressId: progress.id,
          plate: String(v.plate).trim().toUpperCase(),
          serial: String(v.serial).trim(),
        })),
        { transaction: t }
      );

      await recalcProjectStats(project.id, t);

      await project.update(
        {
          updatedById: req.user.id,
        },
        { transaction: t }
      );

      await t.commit();

      const full = await InstallationProjectProgress.findByPk(progress.id, {
        include: [{ model: InstallationProjectProgressVehicle, as: 'vehicles' }],
      });

      return ok(res, full);
    } catch (err) {
      await t.rollback();
      console.error('updateProgress error:', err);
      return bad(res, err.message || 'Erro ao atualizar progresso');
    }
  },

  async removeProgress(req, res) {
    const progress = await InstallationProjectProgress.findByPk(req.params.progressId);
    if (!progress) return notFound(res, 'Progresso não encontrado');

    const project = await InstallationProject.findByPk(progress.projectId);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const t = await sequelize.transaction();

    try {
      await InstallationProjectProgressVehicle.destroy({
        where: { progressId: progress.id },
        transaction: t,
      });

      await progress.destroy({ transaction: t });

      await recalcProjectStats(project.id, t);

      await project.update(
        {
          updatedById: req.user.id,
        },
        { transaction: t }
      );

      await t.commit();

      return ok(res, { message: 'Progresso excluído com sucesso.' });
    } catch (err) {
      await t.rollback();
      console.error('removeProgress error:', err);
      return bad(res, err.message || 'Erro ao excluir progresso');
    }
  },

  async getMetrics(req, res) {
    try {
      const project = await InstallationProject.findByPk(req.params.id);
      if (!project) return notFound(res, 'Projeto não encontrado');

      const today = dayjs().format('YYYY-MM-DD');
      const startWeek = dayjs().startOf('week').format('YYYY-MM-DD');
      const endWeek = dayjs().endOf('week').format('YYYY-MM-DD');

      const [todayProgress, weekProgress, totals, heatmap] = await Promise.all([
        InstallationProjectProgress.findAll({
          where: { projectId: project.id, date: today },
          order: [['date', 'ASC'], ['id', 'ASC']],
        }),

        InstallationProjectProgress.findAll({
          where: {
            projectId: project.id,
            date: { [Op.between]: [startWeek, endWeek] },
          },
          order: [['date', 'ASC'], ['id', 'ASC']],
        }),

        InstallationProjectProgress.findOne({
          where: { projectId: project.id },
          attributes: [
            [fn('COALESCE', fn('SUM', col('completedInstallations')), 0), 'completed'],
            [fn('COALESCE', fn('SUM', col('failedInstallations')), 0), 'failed'],
            [fn('COALESCE', fn('SUM', col('plannedInstallations')), 0), 'planned'],
          ],
          raw: true,
        }),

        InstallationProjectProgress.findAll({
          where: {
            projectId: project.id,
            lat: { [Op.ne]: null },
            lng: { [Op.ne]: null },
          },
          attributes: [
            'id',
            'date',
            'lat',
            'lng',
            'completedInstallations',
            'failedInstallations',
            'plannedInstallations',
          ],
          order: [['date', 'DESC'], ['id', 'DESC']],
        }),
      ]);

      const dailyCompleted = todayProgress.reduce(
        (acc, item) => acc + Number(item.completedInstallations ?? item.trucksDoneToday ?? 0),
        0
      );

      const dailyFailed = todayProgress.reduce(
        (acc, item) => acc + Number(item.failedInstallations ?? 0),
        0
      );

      const dailyPlanned = todayProgress.reduce(
        (acc, item) => acc + Number(item.plannedInstallations ?? 0),
        0
      );

      const weeklyCompleted = weekProgress.reduce(
        (acc, item) => acc + Number(item.completedInstallations ?? item.trucksDoneToday ?? 0),
        0
      );

      const weeklyFailed = weekProgress.reduce(
        (acc, item) => acc + Number(item.failedInstallations ?? 0),
        0
      );

      const totalCompleted = Number(totals?.completed || 0);
      const totalFailed = Number(totals?.failed || 0);
      const totalPlanned = Number(totals?.planned || 0);

      const totalAttempts = totalCompleted + totalFailed;
      const successRate =
        totalAttempts > 0
          ? Number(((totalCompleted / totalAttempts) * 100).toFixed(2))
          : 0;

      const dailyGoal = Number(project.dailyGoal || 0);
      const weeklyGoal = Number(project.weeklyGoal || 0);

      const delayed =
        project.status !== 'FINALIZADO' &&
        !!project.endPlannedAt &&
        dayjs(project.endPlannedAt).isBefore(dayjs(), 'day');

      return ok(res, {
        project: {
          id: project.id,
          title: project.title,
          status: project.status,
          dailyGoal,
          weeklyGoal,
          trucksTotal: project.trucksTotal,
          trucksDone: project.trucksDone,
          startPlannedAt: project.startPlannedAt,
          endPlannedAt: project.endPlannedAt,
          delayed,
        },
        daily: {
          completed: dailyCompleted,
          failed: dailyFailed,
          planned: dailyPlanned,
          goal: dailyGoal,
          achieved: dailyGoal > 0 ? dailyCompleted >= dailyGoal : false,
        },
        weekly: {
          completed: weeklyCompleted,
          failed: weeklyFailed,
          goal: weeklyGoal,
          achieved: weeklyGoal > 0 ? weeklyCompleted >= weeklyGoal : false,
        },
        totals: {
          completed: totalCompleted,
          failed: totalFailed,
          planned: totalPlanned,
          successRate,
        },
        heatmap,
        rules: {
          dailyGoal:
            'Meta diária atingida quando completedInstallations do dia for maior ou igual ao dailyGoal do projeto',
          weeklyGoal:
            'Meta semanal atingida quando a soma de completedInstallations da semana for maior ou igual ao weeklyGoal do projeto',
          successRate:
            'Taxa de sucesso = completedInstallations / (completedInstallations + failedInstallations) * 100',
          dataSource: 'installation_project_progress',
        },
      });
    } catch (err) {
      console.error('getMetrics error:', err);
      return bad(res, err.message || 'Erro ao calcular métricas do projeto');
    }
  },

  // =========================================================
  // E-mails
  // =========================================================

  async sendStartEmail(req, res) {
    const schema = emailSendSchema.keys({
      message: Joi.string().allow('', null),
    });

    const { error, value } = schema.validate(req.body || {});
    if (error) return bad(res, error.message);

    const project = await loadProjectWithDetails(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const p = project.toJSON ? project.toJSON() : project;

    const to = normalizeEmailList(value.emailTo || p.contactEmails || p.contactEmail);
    if (!to.length) {
      return bad(res, 'Projeto sem e-mail de contato');
    }

    const subject = `INÍCIO • ${p.title}${p.af ? ` • ${p.af}` : ''}`;
    const html = startEmailHtml(p, value.message);

    await sendMail({
      to,
      cc: value.emailCc?.length ? value.emailCc : undefined,
      subject,
      html,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });

    return ok(res, { sent: true, to });
  },

  async sendDailyEmail(req, res) {
    const schema = emailSendSchema.keys({
      date: Joi.string().allow('', null),
    });

    const { error, value } = schema.validate(req.body || {});
    if (error) return bad(res, error.message);

    try {
      const project = await InstallationProject.findByPk(req.params.id, {
        include: [{ model: Client, as: 'client', attributes: ['id', 'name'] }],
      });

      if (!project) return notFound(res, 'Projeto não encontrado');

      const to = normalizeEmailList(value.emailTo || project.contactEmails || project.contactEmail);
      if (!to.length) {
        return bad(res, 'Projeto sem e-mail de contato');
      }

      const targetDate = value.date
        ? String(value.date).slice(0, 10)
        : dayjs().format('YYYY-MM-DD');

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

      return ok(res, {
        sent: true,
        to,
        targetDate,
        count: progressList.length,
      });
    } catch (err) {
      console.error('sendDailyEmail error:', err);
      return bad(res, err.message || 'Erro ao enviar reporte diário');
    }
  },

  async sendFinalEmail(req, res) {
    const schema = emailSendSchema.keys({
      procedures: Joi.string().allow('', null),
    });

    const { error, value } = schema.validate(req.body || {});
    if (error) return bad(res, error.message);

    const project = await loadProjectWithDetails(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    const p = project.toJSON ? project.toJSON() : project;

    const to = normalizeEmailList(value.emailTo || p.contactEmails || p.contactEmail);
    if (!to.length) {
      return bad(res, 'Projeto sem e-mail de contato');
    }

    const progressList = Array.isArray(p.progress) ? p.progress : [];
    progressList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const subject = `ENCERRAMENTO • ${p.title}${p.af ? ` • ${p.af}` : ''}`;
    const html = finalEmailHtml(p, progressList, value.procedures);

    await sendMail({
      to,
      cc: value.emailCc?.length ? value.emailCc : undefined,
      subject,
      html,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });

    return ok(res, {
      sent: true,
      to,
      count: progressList.length,
    });
  },
};