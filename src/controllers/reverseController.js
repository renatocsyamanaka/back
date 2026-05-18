const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Role,
  ReverseConfig,
  ReverseCycle,
  ReverseItem,
  ReverseResponse,
  ReverseResponseItem,
  ReverseResponseItemSerial,
  ReverseResponsePhoto,
  ReverseTransportNote,
  ReverseCollectionRequest,
  ReverseChatMessage,
} = require('../models');
const ReverseProviderSetting = require('../models/ReverseProviderSetting');
const { sendMail } = require('../services/mailer');

function ok(res, data, status = 200) { return res.status(status).json(data); }
function fail(res, message, status = 400, details) { return res.status(status).json({ message, error: message, details }); }
function toArrayEmails(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}
function parseBool(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'sim', 's', 'yes'].includes(String(value).trim().toLowerCase());
}
function isFalseFlag(value) {
  return value === false || value === 0 || value === '0' || String(value).trim().toLowerCase() === 'false';
}
function isTrueFlag(value) {
  return value === true || value === 1 || value === '1' || String(value).trim().toLowerCase() === 'true';
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}
function publicBase(req) {
  const origin = req.get?.('origin');
  const env = process.env.REVERSE_PUBLIC_BASE_URL || process.env.FRONTEND_URL || process.env.TECHNICIAN_PUBLIC_BASE_URL || process.env.BASE_URL;
  return env || origin || `${req.protocol}://${req.get('host')}`;
}
function makeToken() { return crypto.randomBytes(24).toString('hex'); }
const PROVIDER_KINDS_ALLOWED = new Set(['ATA', 'PRP', 'SPOT', 'PSO']);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function roleKindFromRoleName(roleName) {
  const role = normalizeText(roleName);
  if (role === 'ATA' || role.includes(' ATA')) return 'ATA';
  if (role === 'PRP' || role.includes(' PRP')) return 'PRP';
  if (role === 'SPOT' || role.includes(' SPOT')) return 'SPOT';
  if (role === 'PSO' || role.includes(' PSO')) return 'PSO';
  return 'OTHER';
}

function getProviderKind(user) {
  // No Auto Inventário a base de prestadores não depende apenas do role.name.
  // Em alguns cadastros o tipo vem em tipoAtendimento, serviceAreaName, vendorCode
  // ou até no nome/área. Por isso fazemos fallback para não esconder prestadores.
  const values = [
    user?.role?.name,
    user?.tipoAtendimento,
    user?.providerType,
    user?.serviceAreaName,
    user?.serviceAreaCode,
    user?.vendorCode,
    user?.name,
  ];

  for (const value of values) {
    const kind = roleKindFromRoleName(value);
    if (PROVIDER_KINDS_ALLOWED.has(kind)) return kind;
  }

  return 'OTHER';
}

function getManagerChain(user, usersById) {
  const chain = [];
  let current = user;
  const visited = new Set();
  while (current && current.managerId) {
    const id = Number(current.managerId);
    if (!id || visited.has(id)) break;
    visited.add(id);
    const manager = usersById.get(id);
    if (!manager) break;
    chain.push(manager);
    current = manager;
  }
  return chain;
}

function roleText(user) {
  return normalizeText([user?.role?.name, user?.cargoDescritivo, user?.name].filter(Boolean).join(' '));
}

function resolveSupervisor(user, usersById) {
  const chain = getManagerChain(user, usersById);
  return chain.find((u) => roleText(u).includes('SUPERVIS')) || chain[0] || null;
}

function resolveCoordinator(user, usersById) {
  const chain = getManagerChain(user, usersById);
  return chain.find((u) => roleText(u).includes('COORD')) || chain[1] || chain.find((u) => (Number(u.role?.level) || 0) >= 4) || null;
}

function countUnread(messages, sender) {
  return (messages || []).filter((m) => m.sender === sender && !m.readAt).length;
}
function optionFromUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email || null };
}
function providerSnapshot(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    vendorCode: u.vendorCode,
    serviceAreaCode: u.serviceAreaCode,
    serviceAreaName: u.serviceAreaName,
    addressStreet: u.addressStreet,
    addressNumber: u.addressNumber,
    addressComplement: u.addressComplement,
    addressDistrict: u.addressDistrict,
    addressCity: u.addressCity,
    addressState: u.addressState,
    addressZip: u.addressZip,
    tipoAtendimento: u.tipoAtendimento,
    coordinator: u.coordinator || null,
    supervisor: u.supervisor || null,
    coordinatorName: u.coordinator?.name || u.coordenadorNome || null,
    supervisorName: u.supervisor?.name || u.supervisorNome || null,
  };
}
function providerAttributes() {
  return [
    'id', 'name', 'email', 'phone', 'managerId', 'isActive', 'estoqueAvancado',
    'autoInventoryEnabled', 'vendorCode', 'serviceAreaCode', 'serviceAreaName',
    'tipoAtendimento', 'avatarUrl', 'addressStreet', 'addressNumber', 'addressComplement',
    'addressDistrict', 'addressCity', 'addressState', 'addressZip', 'addressCountry',
  ];
}

const includeResponse = [
  { model: User, as: 'provider', attributes: providerAttributes(), include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'], required: false }] },
  { model: ReverseCycle, as: 'cycle' },
  { model: ReverseResponseItem, as: 'items', include: [{ model: ReverseItem, as: 'item' }, { model: ReverseResponseItemSerial, as: 'serials' }] },
  { model: ReverseResponsePhoto, as: 'photos' },
  { model: ReverseTransportNote, as: 'transportNotes' },
  { model: ReverseCollectionRequest, as: 'collectionRequests' },
  { model: ReverseChatMessage, as: 'chatMessages' },
];

async function getConfig(req, res) {
  const [config] = await ReverseConfig.findOrCreate({
    where: { id: 1 },
    defaults: {
      sendDay: 20,
      enabled: true,
      reminderDays: 3,
      autoCreateCycle: false,
      autoSendEmails: false,
    },
  });
  return ok(res, config);
}

async function updateConfig(req, res) {
  const [config] = await ReverseConfig.findOrCreate({ where: { id: 1 }, defaults: { sendDay: 20, enabled: true } });
  const data = {};
  [
    'sendDay', 'enabled', 'emailCc', 'collectionEmails', 'publicBaseUrl', 'defaultTransportadora',
    'collectionSubject', 'collectionBody', 'reminderDays', 'autoCreateCycle', 'autoSendEmails',
  ].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  if (data.sendDay && (Number(data.sendDay) < 1 || Number(data.sendDay) > 31)) return fail(res, 'Dia de envio deve ser entre 1 e 31.');
  await config.update(data);
  return ok(res, config);
}

async function listItems(req, res) {
  const where = {};
  if (req.query.ativo !== undefined) where.ativo = String(req.query.ativo) === 'true';
  const rows = await ReverseItem.findAll({ where, order: [['ordem', 'ASC'], ['nome', 'ASC']] });
  return ok(res, rows);
}
async function createItem(req, res) {
  if (!req.body.nome) return fail(res, 'Informe o nome do item.');
  const row = await ReverseItem.create({ ...req.body, codigo: req.body.codigo || null });
  return ok(res, row, 201);
}
async function updateItem(req, res) {
  const row = await ReverseItem.findByPk(req.params.id);
  if (!row) return fail(res, 'Item não encontrado.', 404);
  await row.update(req.body);
  return ok(res, row);
}
async function deleteItem(req, res) {
  const row = await ReverseItem.findByPk(req.params.id);
  if (!row) return fail(res, 'Item não encontrado.', 404);
  await row.destroy();
  return ok(res, { message: 'Item removido com sucesso.' });
}

async function buildProviderBase() {
  // MESMO CRITÉRIO DO AUTO INVENTÁRIO PARA LISTAR A BASE DE PRESTADORES.
  // A diferença é que a ativação da Reversa fica em tabela própria:
  // reverse_provider_settings.activeReverse
  const users = await User.findAll({
    where: {},
    attributes: providerAttributes(),
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'], required: false }],
    order: [['name', 'ASC']],
  });

  const settings = await ReverseProviderSetting.findAll();
  const settingsByProviderId = new Map(settings.map((row) => [Number(row.providerId), row]));
  const usersById = new Map(users.map((user) => [user.id, user]));

  return users.map((user) => {
    const tipoPrestador = getProviderKind(user);

    const setting = settingsByProviderId.get(Number(user.id));
    const supervisor = resolveSupervisor(user, usersById) || getManagerChain(user, usersById).find((u) => (Number(u.role?.level) || 0) >= 3) || null;
    const coordinator = resolveCoordinator(user, usersById) || getManagerChain(user, usersById).find((u) => (Number(u.role?.level) || 0) >= 4) || null;

    return {
      id: user.id,
      name: user.name,
      email: user.email || null,
      phone: user.phone || null,
      isActive: !!user.isActive,
      estoqueAvancado: !!user.estoqueAvancado,
      autoInventoryEnabled: !!user.autoInventoryEnabled,

      // Campo próprio da Reversa. Não usa autoInventoryEnabled.
      activeReverse: !!setting?.activeReverse,
      reverseEnabled: !!setting?.activeReverse,
      emitsInvoice: setting?.emitsInvoice ?? null,
      defaultTransporter: setting?.defaultTransporter || null,
      reverseObservation: setting?.observation || null,

      tipoPrestador,
      role: user.role ? { id: user.role.id, name: user.role.name, level: user.role.level } : null,
      vendorCode: user.vendorCode || null,
      serviceAreaCode: user.serviceAreaCode || null,
      serviceAreaName: user.serviceAreaName || null,
      tipoAtendimento: user.tipoAtendimento || null,
      addressStreet: user.addressStreet || null,
      addressNumber: user.addressNumber || null,
      addressComplement: user.addressComplement || null,
      addressDistrict: user.addressDistrict || null,
      addressCity: user.addressCity || null,
      addressState: user.addressState || null,
      addressZip: user.addressZip || null,
      avatarUrl: user.avatarUrl || null,
      coordinator: optionFromUser(coordinator),
      coordinatorId: coordinator?.id || null,
      supervisor: optionFromUser(supervisor),
      supervisorId: supervisor?.id || null,
    };
  });
}

async function listProviders(req, res) {
  const q = String(req.query.q || '').trim().toLowerCase();
  const reverseFilter = parseBool(req.query.reverseEnabled ?? req.query.onlyReverse);
  const activeFilter = parseBool(req.query.isActive);
  const coordinatorId = req.query.coordinatorId ? Number(req.query.coordinatorId) : null;
  const supervisorId = req.query.supervisorId ? Number(req.query.supervisorId) : null;
  const tipoPrestador = req.query.tipoPrestador ? String(req.query.tipoPrestador).toUpperCase() : null;

  const baseProviders = await buildProviderBase();
  const coordinatorMap = new Map();
  const supervisorMap = new Map();
  const tipoMap = new Map();
  for (const p of baseProviders) {
    if (p.coordinator) coordinatorMap.set(p.coordinator.id, p.coordinator);
    if (p.supervisor) supervisorMap.set(p.supervisor.id, p.supervisor);
    if (p.tipoPrestador) tipoMap.set(p.tipoPrestador, p.tipoPrestador);
  }

  let providers = baseProviders;
  if (q) {
    providers = providers.filter((p) => [p.name, p.email, p.phone, p.vendorCode, p.serviceAreaCode, p.serviceAreaName, p.tipoPrestador, p.coordinator?.name, p.supervisor?.name]
      .filter(Boolean).join(' ').toLowerCase().includes(q));
  }
  if (reverseFilter !== null) providers = providers.filter((p) => p.reverseEnabled === reverseFilter);
  if (activeFilter !== null) providers = providers.filter((p) => p.isActive === activeFilter);
  if (coordinatorId) providers = providers.filter((p) => Number(p.coordinatorId) === coordinatorId);
  if (supervisorId) providers = providers.filter((p) => Number(p.supervisorId) === supervisorId);
  if (tipoPrestador) providers = providers.filter((p) => p.tipoPrestador === tipoPrestador);

  providers = providers.sort((a, b) => Number(b.reverseEnabled) - Number(a.reverseEnabled) || String(a.name || '').localeCompare(String(b.name || '')));

  return ok(res, {
    providers,
    resumo: {
      total: providers.length,
      totalBase: baseProviders.length,
      reversaAtivo: providers.filter((p) => p.reverseEnabled).length,
      reversaInativo: providers.filter((p) => !p.reverseEnabled).length,
      autoInventarioAtivo: providers.filter((p) => p.autoInventoryEnabled).length,
      semEmail: providers.filter((p) => !p.email).length,
    },
    filters: {
      coordinators: Array.from(coordinatorMap.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      supervisors: Array.from(supervisorMap.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      tiposPrestador: Array.from(tipoMap.values()).sort(),
    },
  });
}

async function toggleProvider(req, res) {
  const provider = await User.findByPk(req.params.id, {
    attributes: providerAttributes(),
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'], required: false }],
  });
  if (!provider) return fail(res, 'Prestador não encontrado.', 404);

  const tipoPrestador = getProviderKind(provider);

  const enabled = Boolean(req.body.activeReverse ?? req.body.reverseEnabled ?? req.body.enabled);

  const [setting] = await ReverseProviderSetting.findOrCreate({
    where: { providerId: provider.id },
    defaults: { providerId: provider.id, activeReverse: enabled },
  });

  await setting.update({
    activeReverse: enabled,
    emitsInvoice: req.body.emitsInvoice !== undefined ? req.body.emitsInvoice : setting.emitsInvoice,
    defaultTransporter: req.body.defaultTransporter !== undefined ? req.body.defaultTransporter : setting.defaultTransporter,
    observation: req.body.observation !== undefined ? req.body.observation : setting.observation,
  });

  return ok(res, {
    message: enabled ? 'Prestador ativado na Reversa.' : 'Prestador desativado da Reversa.',
    provider: {
      id: provider.id,
      name: provider.name,
      email: provider.email,
      activeReverse: enabled,
      reverseEnabled: enabled,
      tipoPrestador,
    },
  });
}

async function syncCycleProviders(req, res) {
  const cycle = await ReverseCycle.findByPk(req.params.id);
  if (!cycle) return fail(res, 'Ciclo não encontrado.', 404);
  const responses = await ensureResponsesForCycle(cycle, req.body.providerIds || [], { name: req.user?.name || req.user?.nome || req.user?.email, email: req.user?.email });
  return ok(res, { message: 'Prestadores da reversa sincronizados no ciclo.', total: responses.length });
}

async function createCycle(req, res) {
  let month = Number(req.body.month);
  let year = Number(req.body.year);
  if ((!month || !year) && req.body.referenceMonth) {
    const [y, m] = String(req.body.referenceMonth).split('-');
    year = Number(y);
    month = Number(m);
  }
  if (!month || !year) return fail(res, 'Informe mês e ano.');
  const defaults = {
    name: req.body.name || `Reversa ${String(month).padStart(2, '0')}/${year}`,
    referenceMonth: `${year}-${String(month).padStart(2, '0')}`,
    requestDate: req.body.requestDate || null,
    dueDate: req.body.dueDate || null,
    notes: req.body.notes || req.body.observation || null,
    createdByName: req.user?.name || req.user?.nome || req.user?.email || null,
    createdByEmail: req.user?.email || null,
  };
  const [cycle, created] = await ReverseCycle.findOrCreate({ where: { month, year }, defaults });
  if (!created) await cycle.update(Object.fromEntries(Object.entries(defaults).filter(([, v]) => v !== null && v !== undefined)));
  const responses = await ensureResponsesForCycle(cycle, req.body.providerIds || [], { name: req.user?.name || req.user?.nome || req.user?.email, email: req.user?.email });
  return ok(res, { cycle, created, responsesCreated: responses.length }, created ? 201 : 200);
}
async function listCycles(req, res) {
  const rows = await ReverseCycle.findAll({ order: [['year', 'DESC'], ['month', 'DESC']] });
  return ok(res, rows);
}
async function closeCycle(req, res) {
  const cycle = await ReverseCycle.findByPk(req.params.id);
  if (!cycle) return fail(res, 'Ciclo não encontrado.', 404);
  await cycle.update({ status: 'FECHADO' });
  return ok(res, cycle);
}
async function ensureResponsesForCycle(cycle, providerIds, requester = null) {
  // Sempre usa a base própria da Reversa. Não depende do Auto Inventário.
  const baseProviders = await buildProviderBase();
  let providers = [];

  if (Array.isArray(providerIds) && providerIds.length) {
    const idSet = new Set(providerIds.map((id) => Number(id)));
    providers = baseProviders.filter((p) => idSet.has(Number(p.id)));
  } else {
    providers = baseProviders.filter((p) => !!p.reverseEnabled);
  }

  const created = [];
  for (const provider of providers) {
    const snapshot = {
      ...provider,
      coordinator: provider.coordinator || null,
      supervisor: provider.supervisor || null,
      coordinatorName: provider.coordinator?.name || provider.coordinatorName || null,
      supervisorName: provider.supervisor?.name || provider.supervisorName || null,
      requesterName: requester?.name || cycle.createdByName || null,
      requesterEmail: requester?.email || cycle.createdByEmail || null,
    };

    const [resp] = await ReverseResponse.findOrCreate({
      where: { cycleId: cycle.id, providerId: provider.id },
      defaults: { token: makeToken(), providerSnapshot: snapshot },
    });

    // Atualiza o snapshot para refletir coordenador/supervisor e dados atuais do prestador.
    await resp.update({ providerSnapshot: snapshot });
    created.push(resp);
  }
  return created;
}

function reverseEmailHtml({ providerName, link, cycle }) {
  const month = cycle ? `${String(cycle.month).padStart(2, '0')}/${cycle.year}` : '';
  return `
  <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 0;">
      <tr><td align="center">
        <table width="680" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#1F71B8;color:#ffffff;padding:22px 28px;">
              <h2 style="margin:0;font-size:20px;">Reversa de Equipamentos</h2>
              <p style="margin:6px 0 0;font-size:13px;opacity:.95;">Portal de Operações - Omnilink ${month ? `| ${month}` : ''}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="font-size:16px;margin:0 0 16px;">Olá, <strong>${providerName || 'prestador'}</strong>.</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">Por gentileza, acesse o link abaixo e informe os itens que possui para reversa.</p>
              <p style="margin:24px 0;text-align:center;">
                <a href="${link}" style="background:#1F71B8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block;">Preencher reversa</a>
              </p>
              <p style="font-size:13px;color:#667085;margin:0 0 18px;word-break:break-all;">${link}</p>
              <div style="background:#fff7e6;border:1px solid #ffd591;border-radius:10px;padding:14px 16px;color:#8a5a00;font-size:14px;">
                É obrigatório anexar ao menos uma foto dos itens. Não precisa ser uma foto por item.
              </div>
              <p style="font-size:14px;line-height:1.6;margin:24px 0 0;">Atenciosamente,<br/><strong>Portal de Operações - Omnilink</strong></p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

async function sendCycleEmails(req, res) {
  const cycle = await ReverseCycle.findByPk(req.params.id);
  if (!cycle) return fail(res, 'Ciclo não encontrado.', 404);
  const [config] = await ReverseConfig.findOrCreate({ where: { id: 1 }, defaults: { sendDay: 20, enabled: true } });
  let responses = await ensureResponsesForCycle(cycle, req.body.providerIds, { name: req.user?.name || req.user?.nome || req.user?.email, email: req.user?.email });
  if (Array.isArray(req.body.responseIds) && req.body.responseIds.length) {
    const ids = new Set(req.body.responseIds.map((id) => Number(id)));
    responses = responses.filter((r) => ids.has(Number(r.id)));
  }
  const cc = toArrayEmails(req.body.cc || config.emailCc).join(',');
  const base = config.publicBaseUrl || publicBase(req);
  let sent = 0;
  for (const resp of responses) {
    const provider = await User.findByPk(resp.providerId);
    if (!provider?.email) continue;
    const link = `${base.replace(/\/$/, '')}/reversa/${resp.token}`;
    await sendMail({
      to: provider.email,
      cc,
      subject: `Reversa de equipamentos - ${String(cycle.month).padStart(2, '0')}/${cycle.year}`,
      html: reverseEmailHtml({ providerName: provider.name, link, cycle }),
    });
    sent += 1;
  }
  await cycle.update({ sendDate: new Date() });
  return ok(res, { message: 'E-mails enviados.', total: responses.length, sent });
}
async function sendReminderEmails(req, res) {
  const cycle = await ReverseCycle.findByPk(req.params.id);
  if (!cycle) return fail(res, 'Ciclo não encontrado.', 404);
  const [config] = await ReverseConfig.findOrCreate({ where: { id: 1 }, defaults: { sendDay: 20, enabled: true } });
  const where = { cycleId: cycle.id, status: { [Op.in]: ['PENDENTE', 'PARCIAL'] } };
  if (Array.isArray(req.body.responseIds) && req.body.responseIds.length) where.id = { [Op.in]: req.body.responseIds };
  const rows = await ReverseResponse.findAll({ where, include: [{ model: User, as: 'provider' }] });
  const base = config.publicBaseUrl || publicBase(req);
  let sent = 0;
  for (const resp of rows) {
    if (!resp.provider?.email) continue;
    const link = `${base.replace(/\/$/, '')}/reversa/${resp.token}`;
    await sendMail({
      to: resp.provider.email,
      cc: toArrayEmails(req.body.cc || config.emailCc).join(','),
      subject: 'Pendência de preenchimento - Reversa de equipamentos',
      html: reverseEmailHtml({ providerName: resp.provider.name, link, cycle }),
    });
    await resp.update({ reminderSentAt: new Date() });
    sent += 1;
  }
  return ok(res, { message: 'Cobranças enviadas.', sent });
}
function withChatCounters(row) {
  const data = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const messages = data.chatMessages || [];
  return {
    ...data,
    chatUnreadAdmin: countUnread(messages, 'PROVIDER'),
    chatUnreadProvider: countUnread(messages, 'ADMIN'),
    chatMessagesCount: messages.length,
    lastChatMessageAt: messages.length ? messages[messages.length - 1].createdAt : null,
  };
}

async function enrichResponseRows(rows) {
  const baseProviders = await buildProviderBase();
  const byId = new Map(baseProviders.map((p) => [Number(p.id), p]));

  return rows.map((row) => {
    const data = withChatCounters(row);
    const providerMeta = byId.get(Number(data.providerId));

    if (providerMeta) {
      data.providerSnapshot = {
        ...(data.providerSnapshot || {}),
        ...providerMeta,
        coordinator: providerMeta.coordinator || data.providerSnapshot?.coordinator || null,
        supervisor: providerMeta.supervisor || data.providerSnapshot?.supervisor || null,
        coordinatorName: providerMeta.coordinator?.name || data.providerSnapshot?.coordinatorName || null,
        supervisorName: providerMeta.supervisor?.name || data.providerSnapshot?.supervisorName || null,
        requesterName: data.providerSnapshot?.requesterName || data.requesterName || data.cycle?.createdByName || null,
      };

      data.coordinatorName = providerMeta.coordinator?.name || data.providerSnapshot?.coordinatorName || null;
      data.supervisorName = providerMeta.supervisor?.name || data.providerSnapshot?.supervisorName || null;
    }

    data.requesterName = data.providerSnapshot?.requesterName || data.requesterName || data.cycle?.createdByName || data.cycle?.createdByEmail || null;
    return data;
  });
}

async function listResponses(req, res) {
  const where = {};
  if (req.query.cycleId) where.cycleId = req.query.cycleId;
  if (req.query.status) where.status = req.query.status;
  const rows = await ReverseResponse.findAll({ where, include: includeResponse, order: [['updatedAt', 'DESC']] });
  return ok(res, await enrichResponseRows(rows));
}
async function getResponse(req, res) {
  const row = await ReverseResponse.findByPk(req.params.id, { include: includeResponse });
  if (!row) return fail(res, 'Resposta não encontrada.', 404);
  const [enriched] = await enrichResponseRows([row]);
  return ok(res, enriched);
}
async function updateResponseStatus(req, res) {
  const row = await ReverseResponse.findByPk(req.params.id);
  if (!row) return fail(res, 'Resposta não encontrada.', 404);
  await row.update({ status: req.body.status });
  return ok(res, row);
}
async function publicGet(req, res) {
  const response = await ReverseResponse.findOne({ where: { token: req.params.token }, include: includeResponse });
  if (!response) return fail(res, 'Link inválido ou expirado.', 404);
  if (isFalseFlag(response.publicLinkEnabled) || isFalseFlag(response.linkEnabled)) return fail(res, 'Link desativado.', 403);
  if (!response.openedAt) await response.update({ openedAt: new Date() });
  const items = await ReverseItem.findAll({ where: { ativo: true }, order: [['ordem', 'ASC'], ['nome', 'ASC']] });
  const [enriched] = await enrichResponseRows([response]);
  return ok(res, { response: enriched, items });
}

async function saveResponseItems({ response, rawItems, files, observation, status, submittedAt, requirePhoto }) {
  let items = rawItems || [];
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { throw new Error('Formato de itens inválido.'); }
  }

  // IMPORTANTE: quantidade 0 também é resposta válida quando veio do front.
  // O front envia somente itens tocados/preenchidos, então não podemos filtrar com > 0.
  const valid = (items || [])
    .filter((i) => i && i.itemId && (hasOwn(i, 'quantidade') || hasOwn(i, 'quantity')))
    .map((i) => ({
      ...i,
      quantidade: Number(hasOwn(i, 'quantidade') ? i.quantidade : i.quantity),
    }))
    .filter((i) => Number.isFinite(i.quantidade) && i.quantidade >= 0);

  if (!valid.length) throw new Error('Informe ao menos um item para salvar a reversa.');

  const existingPhotosCount = await ReverseResponsePhoto.count({ where: { responseId: response.id } });
  if (requirePhoto && !(files || []).length && !existingPhotosCount) {
    throw new Error('Envie ao menos uma foto dos itens de reversa.');
  }

  await sequelize.transaction(async (t) => {
    const existingItems = await ReverseResponseItem.findAll({ where: { responseId: response.id }, attributes: ['id'], transaction: t });
    const existingIds = existingItems.map((x) => x.id);
    if (existingIds.length) await ReverseResponseItemSerial.destroy({ where: { responseItemId: existingIds }, transaction: t });
    await ReverseResponseItem.destroy({ where: { responseId: response.id }, transaction: t });

    for (const raw of valid) {
      const item = await ReverseItem.findByPk(raw.itemId, { transaction: t });
      if (!item) throw new Error(`Item ${raw.itemId} não encontrado.`);
      const serials = Array.isArray(raw.serials) ? raw.serials.map(String).map((x) => x.trim()).filter(Boolean) : [];
      if (item.hasSerialNumber && item.serialNumberRequired && status === 'ENVIADO' && raw.quantidade > 0 && serials.length < raw.quantidade) {
        throw new Error(`Informe os seriais do item ${item.nome}.`);
      }
      const ri = await ReverseResponseItem.create({
        responseId: response.id,
        itemId: item.id,
        quantidade: raw.quantidade,
        observacao: raw.observacao || null,
      }, { transaction: t });
      for (const serial of serials) await ReverseResponseItemSerial.create({ responseItemId: ri.id, serial }, { transaction: t });
    }

    for (const f of files || []) {
      await ReverseResponsePhoto.create({ responseId: response.id, fileName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size, path: f.path, url: `/uploads/reverse/${f.filename}` }, { transaction: t });
    }

    await response.update({
      status,
      submittedAt,
      partialSavedAt: status === 'PARCIAL' ? new Date() : response.partialSavedAt || null,
      lastUpdateAt: new Date(),
      observation: observation || null,
    }, { transaction: t });
  });
}

async function publicSavePartial(req, res) {
  const response = await ReverseResponse.findOne({ where: { token: req.params.token } });
  if (!response) return fail(res, 'Link inválido ou expirado.', 404);
  if (isFalseFlag(response.publicLinkEnabled) || isFalseFlag(response.linkEnabled)) return fail(res, 'Link desativado.', 403);
  try {
    await saveResponseItems({ response, rawItems: req.body.items, files: req.files || [], observation: req.body.observation, status: 'PARCIAL', submittedAt: null, requirePhoto: false });
    return ok(res, { message: 'Preenchimento parcial salvo.' });
  } catch (error) {
    return fail(res, error.message || 'Erro ao salvar parcial.', 400);
  }
}

async function publicSubmit(req, res) {
  const response = await ReverseResponse.findOne({ where: { token: req.params.token } });
  if (!response) return fail(res, 'Link inválido ou expirado.', 404);
  if (isFalseFlag(response.publicLinkEnabled) || isFalseFlag(response.linkEnabled)) return fail(res, 'Link desativado.', 403);
  try {
    await saveResponseItems({ response, rawItems: req.body.items, files: req.files || [], observation: req.body.observation, status: 'ENVIADO', submittedAt: new Date(), requirePhoto: true });
    return ok(res, { message: 'Reversa enviada com sucesso.' });
  } catch (error) {
    return fail(res, error.message || 'Erro ao salvar reversa.', 400);
  }
}

async function createTransportNote(req, res) {
  const data = { ...req.body };
  if (req.file) { data.anexoNome = req.file.originalname; data.anexoUrl = `/uploads/reverse/${req.file.filename}`; }
  const row = await ReverseTransportNote.create(data);
  return ok(res, row, 201);
}
async function updateTransportNote(req, res) {
  const row = await ReverseTransportNote.findByPk(req.params.id);
  if (!row) return fail(res, 'Nota não encontrada.', 404);
  const data = { ...req.body };
  if (req.file) { data.anexoNome = req.file.originalname; data.anexoUrl = `/uploads/reverse/${req.file.filename}`; }
  await row.update(data);
  return ok(res, row);
}
async function listTransportNotes(req, res) {
  const rows = await ReverseTransportNote.findAll({ include: [{ model: User, as: 'provider', attributes: providerAttributes() }], order: [['createdAt', 'DESC']] });
  return ok(res, rows);
}

function collectionEmailHtml({ body, provider, request }) {
  const safeBody = String(body || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim() ? line : '&nbsp;')
    .join('<br/>');
  return `
  <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 0;">
      <tr><td align="center">
        <table width="720" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#003A5D;color:#ffffff;padding:24px 28px;">
              <h2 style="margin:0;font-size:20px;">Solicitação de Coleta - Reversa</h2>
              <p style="margin:6px 0 0;font-size:13px;opacity:.95;">Portal de Operações - Omnilink</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <div style="background:#eef6ff;border:1px solid #91caff;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
                <strong>Prestador:</strong> ${provider?.name || '-'}<br/>
                <strong>E-mail:</strong> ${provider?.email || '-'}<br/>
                <strong>Telefone:</strong> ${provider?.phone || '-'}<br/>
                <strong>Transportadora:</strong> ${request?.transportadora || '-'}<br/>
                <strong>NF / Declaração:</strong> ${request?.nfDeclaracao || '-'}<br/>
                <strong>Volumes:</strong> ${request?.volumes || 1}
              </div>
              <div style="font-size:15px;line-height:1.65;">${safeBody}</div>
              <p style="font-size:14px;line-height:1.6;margin:24px 0 0;">Atenciosamente,<br/><strong>Portal de Operações - Omnilink</strong></p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

async function createCollectionRequest(req, res) {
  const response = await ReverseResponse.findByPk(req.body.responseId, { include: [{ model: User, as: 'provider' }] });
  if (!response) return fail(res, 'Resposta não encontrada.', 404);
  const recipients = toArrayEmails(req.body.recipients);
  if (!recipients.length) return fail(res, 'Informe ao menos um destinatário.');
  const provider = response.provider;
  const subject = req.body.subject || `Solicitação de coleta - Reversa ${provider?.name || ''}`;
  const body = req.body.body || `<p>Boa tarde,</p><p>Por gentileza, solicitar coleta conforme DANFE em anexo.</p><p>NF ${req.body.nfDeclaracao || ''} de equipamento NOVO/USADO, por favor dar entrada movimentando poder de 3º.</p><p>${req.body.volumes || 1} VOLUME(S).</p><p>Prestador: ${provider?.name || ''}<br/>Telefone: ${provider?.phone || ''}</p><p>Atenciosamente,</p>`;
  const row = await ReverseCollectionRequest.create({ responseId: response.id, createdById: req.user?.id || null, recipients: recipients.join(';'), cc: toArrayEmails(req.body.cc).join(';'), subject, body, transportadora: req.body.transportadora || null, nfDeclaracao: req.body.nfDeclaracao || null, volumes: req.body.volumes || 1, observation: req.body.observation || null });
  return ok(res, row, 201);
}
async function sendCollectionRequest(req, res) {
  const row = await ReverseCollectionRequest.findByPk(req.params.id, { include: [{ model: ReverseResponse, as: 'response', include: [{ model: User, as: 'provider' }] }] });
  if (!row) return fail(res, 'Solicitação não encontrada.', 404);
  await sendMail({
    to: toArrayEmails(row.recipients).join(','),
    cc: toArrayEmails(row.cc).join(','),
    subject: row.subject,
    html: collectionEmailHtml({ body: row.body, provider: row.response?.provider, request: row }),
  });
  await row.update({ status: 'EMAIL_ENVIADO', sentAt: new Date() });
  await row.response.update({ status: 'COLETA_SOLICITADA' });
  return ok(res, { message: 'E-mail de coleta enviado.', row });
}



async function togglePublicLink(req, res) {
  const response = await ReverseResponse.findByPk(req.params.id);
  if (!response) return fail(res, 'Resposta não encontrada.', 404);
  const incoming = hasOwn(req.body, 'enabled') ? req.body.enabled : (hasOwn(req.body, 'publicLinkEnabled') ? req.body.publicLinkEnabled : req.body.linkEnabled);
  const enabled = !isFalseFlag(incoming);
  await response.update({ publicLinkEnabled: enabled });
  const updated = await ReverseResponse.findByPk(req.params.id, { include: includeResponse });
  const [enriched] = await enrichResponseRows([updated]);
  return ok(res, enriched);
}

async function toggleChatHidden(req, res) {
  const response = await ReverseResponse.findByPk(req.params.id);
  if (!response) return fail(res, 'Resposta não encontrada.', 404);
  const incoming = hasOwn(req.body, 'hidden') ? req.body.hidden : req.body.chatHidden;
  const hidden = isTrueFlag(incoming);
  await response.update({ chatHidden: hidden });
  const updated = await ReverseResponse.findByPk(req.params.id, { include: includeResponse });
  const [enriched] = await enrichResponseRows([updated]);
  return ok(res, enriched);
}

async function listChatMessages(req, res) {
  const response = await ReverseResponse.findByPk(req.params.id);
  if (!response) return fail(res, 'Resposta não encontrada.', 404);
  const rows = await ReverseChatMessage.findAll({ where: { responseId: response.id }, order: [['createdAt', 'ASC']] });
  await ReverseChatMessage.update({ readAt: new Date() }, { where: { responseId: response.id, sender: 'PROVIDER', readAt: null } });
  return ok(res, rows);
}

async function sendChatMessage(req, res) {
  const response = await ReverseResponse.findByPk(req.params.id);
  if (!response) return fail(res, 'Resposta não encontrada.', 404);
  const body = String(req.body.message || req.body.body || '').trim();
  if (!body) return fail(res, 'Informe a mensagem.');
  const row = await ReverseChatMessage.create({
    responseId: response.id,
    sender: 'ADMIN',
    body,
    sentByName: req.user?.name || req.user?.nome || req.user?.email || 'Atendente',
    sentByEmail: req.user?.email || null,
  });
  await response.update({ lastChatMessageAt: new Date() });
  return ok(res, row, 201);
}

async function publicListChatMessages(req, res) {
  const response = await ReverseResponse.findOne({ where: { token: req.params.token } });
  if (!response) return fail(res, 'Link inválido ou expirado.', 404);
  if (isTrueFlag(response.chatHidden)) return fail(res, 'Chat desativado para esta reversa.', 403);
  const rows = await ReverseChatMessage.findAll({ where: { responseId: response.id }, order: [['createdAt', 'ASC']] });
  await ReverseChatMessage.update({ readAt: new Date() }, { where: { responseId: response.id, sender: 'ADMIN', readAt: null } });
  return ok(res, rows);
}

async function publicSendChatMessage(req, res) {
  const response = await ReverseResponse.findOne({ where: { token: req.params.token } });
  if (!response) return fail(res, 'Link inválido ou expirado.', 404);
  if (isTrueFlag(response.chatHidden)) return fail(res, 'Chat desativado para esta reversa.', 403);
  const body = String(req.body.message || req.body.body || '').trim();
  if (!body) return fail(res, 'Informe a mensagem.');
  const provider = response.providerSnapshot || {};
  const row = await ReverseChatMessage.create({
    responseId: response.id,
    sender: 'PROVIDER',
    body,
    sentByName: provider.name || 'Prestador',
    sentByEmail: provider.email || null,
  });
  await response.update({ lastChatMessageAt: new Date() });
  return ok(res, row, 201);
}

module.exports = {
  getConfig, updateConfig, listItems, createItem, updateItem, deleteItem,
  listProviders, toggleProvider, syncCycleProviders, createCycle, listCycles, closeCycle,
  sendCycleEmails, sendReminderEmails, listResponses, getResponse, updateResponseStatus,
  togglePublicLink, toggleChatHidden,
  publicGet, publicSubmit, publicSavePartial, createTransportNote, updateTransportNote, listTransportNotes,
  createCollectionRequest, sendCollectionRequest,
  listChatMessages,
  sendChatMessage,
  publicListChatMessages,
  publicSendChatMessage,
};
