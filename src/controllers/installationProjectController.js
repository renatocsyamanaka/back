const Joi = require('joi');
const { Op, fn, col } = require('sequelize');
const dayjs = require('dayjs');
const XLSX = require('xlsx');
const sequelize = require('../db');
const { sendDailyReport } = require('../services/installationProjectDailyReportService');
const { generateCharts } = require('../services/installationProjectChartsService');

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

function normalizeUpperText(value) {
  if (value == null) return '';
  return String(value).trim().toUpperCase();
}

function parseExcelDate(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return dayjs(new Date(d.y, d.m - 1, d.d)).format('YYYY-MM-DD');
  }

  const str = String(value).trim();

  const formats = [
    'YYYY-MM-DD',
    'DD/MM/YYYY',
    'D/M/YYYY',
    'MM/DD/YYYY',
    'M/D/YYYY',
  ];

  for (const fmt of formats) {
    const parsed = dayjs(str, fmt, true);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }

  const parsed = dayjs(str);
  if (parsed.isValid()) return parsed.format('YYYY-MM-DD');

  return null;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function buildImportBatch() {
  return `BASE-${dayjs().format('YYYYMMDD-HHmmss')}`;
}

function normalizeExcelRowKeys(row = {}) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[normalizeUpperText(key)] = value;
  }
  return out;
}
  async function sendDailyIfHasMovement(projectId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const progressToday = await InstallationProjectProgress.findAll({
      where: {
        projectId,
        date: {
          [Op.between]: [todayStart, todayEnd],
        },
      },
      include: [
        {
          model: InstallationProjectProgressVehicle,
          as: 'vehicles',
        },
      ],
    });

    // 🔴 REGRA PRINCIPAL
    const hasMovement = progressToday.some(p => p.vehicles?.length > 0);

    if (!hasMovement) {
      return;
    }

    // ✅ Se tiver movimentação, envia
    await sendDailyEmail(projectId, progressToday);
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
    include: [
      { model: InstallationProjectProgressVehicle, as: 'vehicles' }
    ],
    transaction,
  });

  const trucksDone = rows.reduce((sum, item) => {
    let value = 0;

    if (item.completedInstallations && item.completedInstallations > 0) {
      value = item.completedInstallations;
    } else if (item.trucksDoneToday && item.trucksDoneToday > 0) {
      value = item.trucksDoneToday;
    } else if (item.vehicles && item.vehicles.length > 0) {
      value = item.vehicles.length;
    }

    return sum + value;
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
  contactEmails: Joi.array().items(Joi.string().email()).min(1).allow(null),
  contactPhone: Joi.string().allow('', null),

  startPlannedAt: dateOnlyField,
  endPlannedAt: dateOnlyField,
  saleDate: dateOnlyField,

  trucksTotal: Joi.number().integer().min(1).required(),
  equipmentsPerDay: Joi.number().integer().min(1).required(),

  dailyGoal: Joi.number().integer().min(0).allow(null),
  weeklyGoal: Joi.number().integer().min(0).allow(null),

  supervisorId: Joi.number().integer().allow(null),
  technicianId: Joi.number().integer().allow(null),
  technicianIds: Joi.array().items(Joi.number().integer()).optional(),

  notes: Joi.string().allow('', null),
  coordinatorId: Joi.number().integer().allow(null),

  recordType: Joi.string().valid('BASE', 'PROJECT').default('PROJECT'),
  importBatch: Joi.string().allow('', null),

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
  recordType: Joi.string().valid('BASE', 'PROJECT').allow(null),
  saleDateFrom: dateOnlyField,
  saleDateTo: dateOnlyField,
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

function buildCompleteDailyEmailHtml(project, progressList, targetDate) {
  const p = project.toJSON ? project.toJSON() : project;

  const total = Number(p.trucksTotal || p.equipmentsTotal || 0);
  const done = Number(p.trucksDone || 0);
  const pending = Math.max(total - done, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const headerColor = p.dailyReportHeaderColor || '#2f7dbd';
  const clientLogo = p.dailyReportClientLogoUrl || '';
  const omnilinkLogo =
  p.dailyReportOmnilinkLogoUrl || 'https://app.projetos-rc.online/logo_branca.png';

  const allVehicles = progressList.flatMap((progress) => {
    const date = progress.date;
    const vehicles = Array.isArray(progress.vehicles) ? progress.vehicles : [];

    return vehicles.map((v) => ({
      date,
      plate: v.plate || '-',
      serial: v.serial || '-',
      product: p.items?.[0]?.equipmentName || '-',
      procedure: 'Instalação',
      status: 'Concluído',
      unit: p.requestedCity || p.requestedLocationText || '-',
      company: p.client?.name || p.title || '-',
    }));
  });

  const rows = allVehicles.map((v) => `
    <tr>
      <td>${dayjs(v.date).format('DD/MM/YYYY')}</td>
      <td>${v.plate}</td>
      <td>${v.serial}</td>
      <td>${v.product}</td>
      <td>${v.procedure}</td>
      <td>${v.status}</td>
      <td>${v.unit}</td>
      <td>${v.company}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#eaf4ff;padding:20px;color:#111;">
      <div style="max-width:1100px;margin:auto;background:#eaf4ff;border:1px solid #9fb3c8;border-radius:10px;overflow:hidden;">

        <table width="100%" cellpadding="0" cellspacing="0" style="background:${headerColor};border-collapse:collapse;">
          <tr>
            <td style="padding:14px 22px;text-align:left;width:33%;">
              ${
                clientLogo
                  ? `<img src="${clientLogo}" style="max-height:58px;max-width:190px;object-fit:contain;" />`
                  : `<strong style="font-size:22px;color:#fff;">${p.client?.name || p.title || ''}</strong>`
              }
            </td>

            <td style="padding:14px 22px;text-align:center;width:34%;color:#fff;">
              <h2 style="margin:0;font-size:22px;">Relatório Completo de Instalação</h2>
              <p style="margin:6px 0 0;font-size:14px;">
                ${p.title || '-'} ${p.af ? `• AF ${p.af}` : ''}
              </p>
            </td>

            <td style="padding:14px 22px;text-align:right;width:33%;">
              ${
                omnilinkLogo
                  ? `<img src="${omnilinkLogo}" style="max-height:58px;max-width:190px;object-fit:contain;" />`
                  : `<strong style="font-size:22px;color:#fff;">Omnilink</strong>`
              }
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:center;background:#eaf4ff;">
          <tr>
            <td style="padding:15px;border-bottom:1px solid #9fb3c8;">
              <strong style="font-size:20px;">${dayjs(p.startAt || p.startPlannedAt || targetDate).format('DD/MM/YYYY')}</strong><br/>
              <span style="font-size:13px;">Primeira Instalação</span>
            </td>

            <td style="padding:15px;border-bottom:1px solid #9fb3c8;">
              <strong style="font-size:24px;">📦 ${total}</strong><br/>
              <span style="font-size:13px;">Total de Equipamentos</span>
            </td>

            <td style="padding:15px;border-bottom:1px solid #9fb3c8;">
              <strong style="font-size:24px;color:#16a34a;">✅ ${done}</strong><br/>
              <span style="font-size:13px;">Concluído</span>
            </td>

            <td style="padding:15px;border-bottom:1px solid #9fb3c8;">
              <strong style="font-size:24px;color:#f97316;">🕘 ${pending}</strong><br/>
              <span style="font-size:13px;">Aguardando Instalação</span>
            </td>

            <td style="padding:15px;border-bottom:1px solid #9fb3c8;">
              <strong style="font-size:20px;">${dayjs(targetDate).format('DD/MM/YYYY')}</strong><br/>
              <span style="font-size:13px;">Última Instalação</span>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eaf4ff;">
          <tr>
            <td width="50%" style="padding:18px;border-right:1px solid #9fb3c8;text-align:center;">
              <img src="cid:chart-pie" style="max-width:100%;height:auto;display:block;margin:auto;" />
            </td>
            <td width="50%" style="padding:18px;text-align:center;">
              <img src="cid:chart-bar" style="max-width:100%;height:auto;display:block;margin:auto;" />
            </td>
          </tr>
        </table>

        <div style="padding:20px;background:#eaf4ff;">
          <p style="font-size:14px;margin:0 0 16px;">
            <b>${done}</b> concluídos de <b>${total}</b> equipamentos.
            Percentual de conclusão: <b>${percent}%</b>.
          </p>

          <h3 style="margin:0 0 12px;">Equipamentos Instalados</h3>

          <table width="100%" cellpadding="7" cellspacing="0" style="border-collapse:collapse;font-size:12px;border:1px solid #111;background:#eaf4ff;">
            <thead>
              <tr style="background:#dbeafe;">
                <th>Data</th>
                <th>Placa</th>
                <th>Série</th>
                <th>Produto</th>
                <th>Procedimento</th>
                <th>Status</th>
                <th>Unidade</th>
                <th>Empresa</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                `<tr>
                  <td colspan="8" style="text-align:center;padding:16px;">
                    Nenhum equipamento detalhado.
                  </td>
                </tr>`
              }
            </tbody>
          </table>
        </div>

        <div style="background:#f8fafc;padding:14px 20px;font-size:12px;color:#64748b;">
          Mensagem automática • Portal de Supply Chain
        </div>
      </div>
    </div>
  `;
}

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
    if (value.recordType) where.recordType = value.recordType;

    if (value.delayed === true) {
      where.status = { [Op.ne]: 'FINALIZADO' };
      where.endPlannedAt = { [Op.lt]: dayjs().format('YYYY-MM-DD') };
    }

    if (value.saleDateFrom || value.saleDateTo) {
      where.saleDate = {};
      if (value.saleDateFrom) where.saleDate[Op.gte] = normalizeDateOnly(value.saleDateFrom);
      if (value.saleDateTo) where.saleDate[Op.lte] = normalizeDateOnly(value.saleDateTo);
    }

    if (value.q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${value.q}%` } },
        { contactName: { [Op.like]: `%${value.q}%` } },
        { contactEmail: { [Op.like]: `%${value.q}%` } },
        { af: { [Op.like]: `%${value.q}%` } },
        { '$client.name$': { [Op.like]: `%${value.q}%` } },
      ];
    }

    const rows = await InstallationProject.findAll({
      where,
      order: [
        ['saleDate', 'DESC'],
        ['id', 'DESC'],
      ],
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name'], required: false },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'supervisor', attributes: ['id', 'name'] },
        { model: User, as: 'coordinator', attributes: ['id', 'name'] },
        { model: User, as: 'technician', attributes: ['id', 'name'] },
        { model: InstallationProjectItem, as: 'items', required: false },
      ],
    });

    const enriched = await attachTechniciansToProjects(rows);
    return ok(res, enriched);
  },

async updateDailyReportSettings(req, res) {
  const schema = Joi.object({
    dailyReportEnabled: Joi.boolean().required(),
    dailyReportSendToClient: Joi.boolean().required(),
    dailyReportType: Joi.string().valid('simple', 'complete').default('simple'),

    dailyReportColorDone: Joi.string().allow('', null),
    dailyReportColorPending: Joi.string().allow('', null),
    dailyReportHeaderColor: Joi.string().allow('', null),
    dailyReportClientLogoUrl: Joi.string().allow('', null),
    dailyReportOmnilinkLogoUrl: Joi.string().allow('', null),
  }).options({ abortEarly: false, stripUnknown: true });

  const { error, value } = schema.validate(req.body || {});
  if (error) return bad(res, error.message);

  const project = await InstallationProject.findByPk(req.params.id);
  if (!project) return notFound(res, 'Projeto não encontrado');

  await project.update({
    dailyReportEnabled: value.dailyReportEnabled,
    dailyReportSendToClient: value.dailyReportSendToClient,
    dailyReportType: value.dailyReportType || 'simple',

    dailyReportColorDone: value.dailyReportColorDone || '#00c853',
    dailyReportColorPending: value.dailyReportColorPending || '#2f7dbd',
    dailyReportHeaderColor: value.dailyReportHeaderColor || '#2f7dbd',
    dailyReportClientLogoUrl: value.dailyReportClientLogoUrl || null,
    dailyReportOmnilinkLogoUrl:
      value.dailyReportOmnilinkLogoUrl || 'https://app.projetos-rc.online/logo_branca.png',

    updatedById: req.user.id,
  });

  const full = await loadProjectWithDetails(project.id);
  return ok(res, full);
},

  async sendDailyReportNow(req, res) {
    try {
      const result = await sendDailyReport(req.params.id, {
        date: req.body?.date,
      });

      return ok(res, result);
    } catch (err) {
      console.error('[sendDailyReportNow]', err);
      return bad(res, err.message || 'Erro ao enviar relatório diário');
    }
  },
  async getById(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    await recalcProjectStats(project.id);

    const full = await loadProjectWithDetails(project.id);
    return ok(res, full);
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return bad(res, error.message);

    const startPlannedAt = normalizeDateOnly(value.startPlannedAt);
    const endPlannedAtInput = normalizeDateOnly(value.endPlannedAt);
    const saleDate = normalizeDateOnly(value.saleDate);

    if (!isValidDateOnly(value.startPlannedAt)) {
      return bad(res, 'Data prevista de início inválida. Use YYYY-MM-DD');
    }

    if (!isValidDateOnly(value.endPlannedAt)) {
      return bad(res, 'Data prevista de término inválida. Use YYYY-MM-DD');
    }

    if (!isValidDateOnly(value.saleDate)) {
      return bad(res, 'Data da venda inválida. Use YYYY-MM-DD');
    }

    const normalizedEmails = normalizeEmailList(value.contactEmails || value.contactEmail);
    const isBase = (value.recordType || 'PROJECT') === 'BASE';

    if (!normalizedEmails.length && !isBase) {
      return bad(res, 'Informe pelo menos um e-mail de contato');
    }

    const finalEmails = normalizedEmails.length
      ? normalizedEmails
      : ['sem-email@base.local'];

    const normalizedTechnicianIds = normalizeIdList(
      value.technicianIds || (value.technicianId ? [value.technicianId] : [])
    );

    const { error: techErr } = await validateTechnicianIds(normalizedTechnicianIds);
    if (techErr) return bad(res, techErr);

    let coordinatorId = value.coordinatorId ?? null;

    if (value.supervisorId) {
      const result = await findCoordinatorIdFromSupervisor(value.supervisorId);
      if (result.error) return bad(res, result.error);
      coordinatorId = result.coordinatorId ?? null;
    }

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
      contactEmail: finalEmails[0],
      contactEmails: finalEmails,
      contactPhone: value.contactPhone ?? null,

      startPlannedAt,
      endPlannedAt,
      saleDate,

      trucksTotal: value.trucksTotal,
      equipmentsPerDay: value.equipmentsPerDay,
      dailyGoal: value.dailyGoal ?? null,
      weeklyGoal: value.weeklyGoal ?? null,
      notes: value.notes ?? null,

      supervisorId: value.supervisorId ?? null,
      coordinatorId,

      technicianId: normalizedTechnicianIds[0] || null,
      technicianIds: normalizedTechnicianIds.length ? normalizedTechnicianIds : [],

      recordType: value.recordType || 'PROJECT',
      importBatch: value.importBatch || null,

      requestedLocationText: value.requestedLocationText ?? null,
      requestedCity: value.requestedCity ?? null,
      requestedState: value.requestedState ? String(value.requestedState).trim().toUpperCase() : null,
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
        'saleDate',
        'trucksTotal',
        'equipmentsPerDay',
        'dailyGoal',
        'weeklyGoal',
        'supervisorId',
        'technicianIds',
        'recordType',
        'importBatch',
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
      next.requestedState = rest.requestedState
        ? String(rest.requestedState).trim().toUpperCase()
        : null;
    }

    if (rest.contactEmails !== undefined || rest.contactEmail !== undefined) {
      const normalizedEmails = normalizeEmailList(rest.contactEmails || rest.contactEmail);
      const nextRecordType = rest.recordType || project.recordType;

      if (!normalizedEmails.length && nextRecordType !== 'BASE') {
        return bad(res, 'Informe pelo menos um e-mail de contato');
      }

      const finalEmails = normalizedEmails.length
        ? normalizedEmails
        : ['sem-email@base.local'];

      next.contactEmails = finalEmails;
      next.contactEmail = finalEmails[0];
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

    if (Object.prototype.hasOwnProperty.call(rest, 'supervisorId') && rest.supervisorId) {
      const result = await findCoordinatorIdFromSupervisor(rest.supervisorId);
      if (result.error) return bad(res, result.error);
      next.coordinatorId = result.coordinatorId ?? null;
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

    if (Object.prototype.hasOwnProperty.call(rest, 'saleDate')) {
      if (!isValidDateOnly(rest.saleDate)) {
        return bad(res, 'Data da venda inválida. Use YYYY-MM-DD');
      }
      next.saleDate = normalizeDateOnly(rest.saleDate);
    }

    if (Object.prototype.hasOwnProperty.call(rest, 'recordType')) {
      next.recordType = rest.recordType;
    }

    if (Object.prototype.hasOwnProperty.call(rest, 'importBatch')) {
      next.importBatch = rest.importBatch || null;
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

    if (project.recordType === 'BASE') {
      return bad(res, 'Converta a BASE para projeto antes de iniciar');
    }

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

      function getValue(item) {
        if (item.completedInstallations && item.completedInstallations > 0) return item.completedInstallations;
        if (item.trucksDoneToday && item.trucksDoneToday > 0) return item.trucksDoneToday;
        if (item.vehicles && item.vehicles.length > 0) return item.vehicles.length;
        return 0;
      }

      const dailyCompleted = todayProgress.reduce(
        (acc, item) => acc + getValue(item),
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
async importBaseExcel(req, res) {
  try {
    console.log('IMPORT BASE -> req.file:', req.file);

    if (!req.file) return bad(res, 'Envie um arquivo Excel');

    await sequelize.authenticate();

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    console.log('IMPORT BASE -> sheets:', workbook.SheetNames);

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return bad(res, 'Planilha não encontrada');

    const sheet = workbook.Sheets[sheetName];

    const sheetData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    console.log('IMPORT BASE -> sheetData.length:', sheetData.length);
    console.log('IMPORT BASE -> primeira linha bruta:', sheetData[0]);

    if (!sheetData.length) {
      return bad(res, 'Planilha vazia');
    }

    const headers = (sheetData[0] || []).map((h) =>
      String(h || '').trim().toUpperCase()
    );

    const rawRows = sheetData
      .slice(1)
      .map((row) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      })
      .filter((row) =>
        Object.values(row).some((v) => v !== null && String(v).trim() !== '')
      );

    console.log('IMPORT BASE -> rawRows.length:', rawRows.length);
    console.log('IMPORT BASE -> firstRow:', rawRows[0]);

    if (!rawRows.length) {
      return bad(res, 'Planilha vazia');
    }

    const grouped = new Map();

    for (const raw of rawRows) {
      const row = normalizeExcelRowKeys(raw);

      const af = String(row.AF || '').trim();
      if (!af) continue;

      const clientName = String(row.CLIENTE || '').trim();
      const saleDate = parseExcelDate(row.DATA);
      const product = String(row.PRODUTO || '').trim();
      const qty = toInt(row.QUANTIDADE_PRODUTO, 0);
      const totalEquip = toInt(row.TOTAL_EQUIPAMENTOS_AF, 0);

      if (!grouped.has(af)) {
        grouped.set(af, {
          af,
          saleDate,
          clientName,
          totalEquip,
          items: [],
        });
      }

      const current = grouped.get(af);

      if (product && qty > 0) {
        current.items.push({
          equipmentName: product,
          equipmentCode: null,
          qty,
        });
      }

      if (!current.saleDate && saleDate) current.saleDate = saleDate;
      if (!current.clientName && clientName) current.clientName = clientName;
      if (!current.totalEquip && totalEquip > 0) current.totalEquip = totalEquip;
    }

    const entries = [...grouped.values()];
    console.log('IMPORT BASE -> AFs únicas:', entries.length);
    console.log('IMPORT BASE -> primeira entry:', entries[0]);

    if (!entries.length) {
      return bad(res, 'Nenhuma AF válida encontrada no Excel');
    }

    const batch = buildImportBatch();
    const touchedIds = [];
    const errors = [];
    const skipped = [];

    let importedCount = 0;
    let skippedCount = 0;

    for (const entry of entries) {
      let t;

      try {
        t = await sequelize.transaction();

        console.log('IMPORT BASE -> processando AF:', entry.af);

        // Valida se AF já existe em qualquer registro:
        // BASE ou PROJECT
        const existing = await InstallationProject.findOne({
          where: { af: entry.af },
          attributes: ['id', 'af', 'recordType', 'title'],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (existing) {
          console.log(
            'IMPORT BASE -> AF ignorada porque já existe:',
            entry.af,
            'ID:',
            existing.id,
            'TIPO:',
            existing.recordType
          );

          await t.commit();

          skipped.push({
            af: entry.af,
            id: existing.id,
            recordType: existing.recordType,
            reason:
              existing.recordType === 'PROJECT'
                ? 'AF já existe em PROJETO'
                : 'AF já existe na BASE',
          });

          skippedCount++;
          continue;
        }

        console.log('IMPORT BASE -> criando nova AF:', entry.af);

        const project = await InstallationProject.create(
          {
            status: 'A_INICIAR',
            title: entry.clientName || `Implantação ${entry.af}`,
            af: entry.af,
            clientId: null,

            saleDate: entry.saleDate || null,

            contactName: null,
            contactEmail: 'sem-email@base.local',
            contactEmails: ['sem-email@base.local'],
            contactPhone: null,

            startPlannedAt: null,
            endPlannedAt: null,
            startAt: null,
            endAt: null,

            trucksTotal: entry.totalEquip || 1,
            trucksDone: 0,
            equipmentsTotal: entry.totalEquip || 0,
            equipmentsPerDay: 1,
            daysEstimated: null,

            dailyGoal: null,
            weeklyGoal: null,

            whatsappGroupName: null,
            whatsappGroupLink: null,
            notes: null,

            supervisorId: null,
            coordinatorId: null,
            technicianId: null,
            technicianIds: [],

            recordType: 'BASE',
            importBatch: batch,

            createdById: req.user.id,
            updatedById: req.user.id,
          },
          { transaction: t }
        );

        if (entry.items.length) {
          await InstallationProjectItem.bulkCreate(
            entry.items.map((item) => ({
              projectId: project.id,
              equipmentName: item.equipmentName,
              equipmentCode: item.equipmentCode,
              qty: item.qty,
            })),
            { transaction: t }
          );
        }

        await t.commit();
        touchedIds.push(project.id);
        importedCount++;
      } catch (err) {
        console.error('IMPORT BASE -> erro na AF:', entry.af, err);

        if (t) {
          try {
            await t.rollback();
          } catch (rollbackErr) {
            console.error(
              'IMPORT BASE -> rollback falhou para AF:',
              entry.af,
              rollbackErr.message
            );
          }
        }

        errors.push({
          af: entry.af,
          error: err?.message || 'Erro ao importar AF',
        });
      }
    }

  const rows = touchedIds.length
  ? await InstallationProject.findAll({
      where: { id: { [Op.in]: touchedIds } },
      include: [
        { model: InstallationProjectItem, as: 'items', required: false },
        { model: Client, as: 'client', attributes: ['id', 'name'], required: false },
      ],
      order: [['id', 'DESC']],
    })
  : [];

      const uploadedAt = new Date().toISOString();

      return ok(res, {
        batch,
        uploadedAt,
        importedCount,
        skippedCount,
        totalProcessed: entries.length,
        successCount: importedCount,
        errorCount: errors.length,
        errors,
        skipped,
        lastImportedAf: rows?.[0]?.af || null,
        rows: rows.map((row) => ({
          id: row.id,
          af: row.af,
          title: row.title,
          saleDate: row.saleDate,
          importBatch: row.importBatch,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          items: row.items || [],
        })),
      });
  } catch (err) {
    console.error('IMPORT BASE -> erro fatal:', err);
    return bad(res, err.message || 'Falha ao importar Excel');
  }
},

  async convertBaseToProject(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    await project.update({
      recordType: 'PROJECT',
      updatedById: req.user.id,
    });

    const full = await loadProjectWithDetails(project.id);
    return ok(res, full);
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

  async uploadDailyReportLogo(req, res) {
    const project = await InstallationProject.findByPk(req.params.id);
    if (!project) return notFound(res, 'Projeto não encontrado');

    if (!req.file) return bad(res, 'Envie uma imagem');

    const baseUrl = 'https://api.projetos-rc.online';

    const logoUrl = `${baseUrl}/uploads/daily-report-logos/${req.file.filename}`;

    await project.update({
      dailyReportClientLogoUrl: logoUrl,
      updatedById: req.user.id,
    });

    return ok(res, {
      dailyReportClientLogoUrl: logoUrl,
    });
  },
async sendDailyEmail(req, res) {
  const schema = emailSendSchema.keys({
    date: Joi.string().allow('', null),
    reportType: Joi.string().valid('simple', 'complete').default('simple'),
    sendAll: Joi.boolean().default(false),

    dailyReportColorDone: Joi.string().allow('', null),
    dailyReportColorPending: Joi.string().allow('', null),
    dailyReportHeaderColor: Joi.string().allow('', null),
    dailyReportClientLogoUrl: Joi.string().allow('', null),
    dailyReportOmnilinkLogoUrl: Joi.string().allow('', null),
  });

  const { error, value } = schema.validate(req.body || {});
  if (error) return bad(res, error.message);

  try {
    const project = await InstallationProject.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client', attributes: ['id', 'name'] },
        { model: InstallationProjectItem, as: 'items', required: false },
      ],
    });

    if (!project) return notFound(res, 'Projeto não encontrado');

    const to = normalizeEmailList(
      value.emailTo || project.contactEmails || project.contactEmail
    );

    if (!to.length) return bad(res, 'Projeto sem e-mail de contato');

    const targetDate = value.date
      ? String(value.date).slice(0, 10)
      : dayjs().format('YYYY-MM-DD');

    if (!dayjs(targetDate, 'YYYY-MM-DD', true).isValid()) {
      return bad(res, 'date inválido. Use YYYY-MM-DD');
    }

    const whereProgress = {
      projectId: project.id,
    };

    if (!value.sendAll) {
      whereProgress.date = targetDate;
    }

    const progressList = await InstallationProjectProgress.findAll({
      where: whereProgress,
      order: [['date', 'ASC'], ['id', 'ASC']],
      include: [
        { model: User, as: 'author', attributes: ['id', 'name'] },
        { model: InstallationProjectProgressVehicle, as: 'vehicles' },
      ],
    });

    const p = project.toJSON ? project.toJSON() : project;

    p.dailyReportColorDone =
      value.dailyReportColorDone || p.dailyReportColorDone || '#00c853';

    p.dailyReportColorPending =
      value.dailyReportColorPending || p.dailyReportColorPending || '#2f7dbd';

    p.dailyReportHeaderColor =
      value.dailyReportHeaderColor || p.dailyReportHeaderColor || '#2f7dbd';

    p.dailyReportClientLogoUrl =
      value.dailyReportClientLogoUrl || p.dailyReportClientLogoUrl || null;

    p.dailyReportOmnilinkLogoUrl =
      value.dailyReportOmnilinkLogoUrl ||
      p.dailyReportOmnilinkLogoUrl ||
      'https://app.projetos-rc.online/logo_branca.png';

    let html;
    let attachments = [];

    if (value.reportType === 'complete') {
      const charts = await generateCharts(p, progressList, {
        colorDone: p.dailyReportColorDone,
        colorPending: p.dailyReportColorPending,
      });

      html = buildCompleteDailyEmailHtml(p, progressList, targetDate);

      attachments = [
        {
          filename: 'grafico-percentual.png',
          content: charts.pie,
          cid: 'chart-pie',
          contentType: 'image/png',
        },
        {
          filename: 'grafico-equipamentos.png',
          content: charts.bar,
          cid: 'chart-bar',
          contentType: 'image/png',
        },
      ];
    } else {
      html = dailyEmailHtml(p, progressList, targetDate);
    }


    const result = await sendMail({
      to,
      cc: value.emailCc?.length ? value.emailCc : undefined,
      subject:
        value.reportType === 'complete'
          ? `Relatório Completo • ${project.title}${project.af ? ` • ${project.af}` : ''}`
          : `Reporte Diário • ${project.title}${project.af ? ` • ${project.af}` : ''} • ${targetDate}`,
      html,
      attachments,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    });


    await project.update({
      dailyReportLastSentAt: new Date(),
    });

    return ok(res, {
      sent: true,
      to,
      targetDate,
      reportType: value.reportType,
      sendAll: value.sendAll,
      count: progressList.length,
      smtp: {
        accepted: result?.accepted || [],
        rejected: result?.rejected || [],
        response: result?.response || null,
        messageId: result?.messageId || null,
      },
    });
  } catch (err) {
    console.error('sendDailyEmail error:', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack,
    });

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