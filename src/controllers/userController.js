/* src/controllers/userController.js */
/* global fetch */
const Joi = require('joi');
const { User, Role, Location } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');
const { Op } = require('sequelize');

/* ======================
   ====== CONSTANTES =====
   ====================== */
const baseUrl = process.env.BASE_URL || 'https://api.projetos-rc.online';

const defaultIncludes = [
  { model: Role, as: 'role', attributes: ['id', 'name', 'level'] },
  { model: User, as: 'manager', attributes: ['id', 'name', 'avatarUrl'] },
  { model: Location, as: 'location' },
];

/* ======================
   ====== HELPERS =======
   ====================== */

function normRoleName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const WORKER_ALLOWED_ROLES = new Set([
  'tecnico',
  'pso',
  'ata',
  'prp',
  'spot',
]);

const VALID_TIPO_ATENDIMENTO = ['FX', 'VL', 'FV'];

function normalizeTipoAtendimento(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().toUpperCase();
}

function roleKindFromRoleName(roleName) {
  const r = normRoleName(roleName);
  if (r === 'pso') return 'PSO';
  if (r === 'ata') return 'ATA';
  if (r === 'spot') return 'SPOT';
  if (r === 'prp') return 'PRP';
  if (r === 'tecnico') return 'TECH';
  return 'OTHER';
}

function getTipoAtendimentoDescricao(tipoAtendimento) {
  switch (tipoAtendimento) {
    case 'FX':
      return 'Fixo';
    case 'VL':
      return 'Volante';
    case 'FV':
      return 'Fixo e Volante';
    default:
      return null;
  }
}

/* ======================
   ====== SCHEMAS =======
   ====================== */

const workerSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().allow('', null),

  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null),

  estoqueAvancado: Joi.boolean().default(false),

  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),

  tipoAtendimento: Joi.string().valid('FX', 'VL', 'FV').allow('', null),

  addressStreet: Joi.string().required(),
  addressNumber: Joi.string().allow(''),
  addressComplement: Joi.string().allow(''),
  addressDistrict: Joi.string().allow(''),
  addressCity: Joi.string().required(),
  addressState: Joi.string().required(),
  addressZip: Joi.string().allow(''),
  addressCountry: Joi.string().default('Brasil'),

  lat: Joi.number().required(),
  lng: Joi.number().required(),
});

const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  sex: Joi.string().valid('M', 'F', 'O').optional(),
  roleId: Joi.number().required(),
  managerId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),
  phone: Joi.string().allow('', null),
  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),
  tipoAtendimento: Joi.string().valid('FX', 'VL', 'FV').allow('', null),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  email: Joi.string().email().allow('', null),
  password: Joi.string().min(6),
  sex: Joi.string().valid('M', 'F', 'O'),
  roleId: Joi.number(),
  managerId: Joi.number().allow(null),
  locationId: Joi.number().allow(null),
  isActive: Joi.boolean(),

  estoqueAvancado: Joi.boolean(),

  phone: Joi.string().allow('', null),
  vendorCode: Joi.string().allow('', null),
  serviceAreaCode: Joi.string().allow('', null),
  serviceAreaName: Joi.string().allow('', null),
  tipoAtendimento: Joi.string().valid('FX', 'VL', 'FV').allow('', null),

  addressStreet: Joi.string().allow('', null),
  addressNumber: Joi.string().allow('', null),
  addressComplement: Joi.string().allow('', null),
  addressDistrict: Joi.string().allow('', null),
  addressCity: Joi.string().allow('', null),
  addressState: Joi.string().allow('', null),
  addressZip: Joi.string().allow('', null),
  addressCountry: Joi.string().allow('', null),

  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
}).min(1);

const addressSchema = Joi.object({
  addressStreet: Joi.string().required(),
  addressNumber: Joi.string().allow(''),
  addressComplement: Joi.string().allow(''),
  addressDistrict: Joi.string().allow(''),
  addressCity: Joi.string().required(),
  addressState: Joi.string().required(),
  addressZip: Joi.string().allow(''),
  addressCountry: Joi.string().default('Brasil'),
  autoGeocode: Joi.boolean().default(true),
});

/* =============================
   ===== Helpers de endereço ===
   ============================= */
function buildAddressString(v) {
  return [
    `${v.addressStreet || ''} ${v.addressNumber || ''}`.trim(),
    v.addressDistrict,
    v.addressCity,
    v.addressState,
    v.addressZip,
    v.addressCountry || 'Brasil',
  ]
    .filter(Boolean)
    .join(', ');
}

async function geocodeNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'operacoes-app/1.0 (contato@empresa.com)' } });
  if (!res.ok) throw new Error('Geocoding error');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon } = data[0];
  return { lat: Number(lat), lng: Number(lon) };
}

async function cepLookup(req, res) {
  try {
    const cepRaw = String(req.query.cep || '').replace(/\D/g, '');
    if (!cepRaw) return bad(res, 'CEP inválido');

    const r = await fetch(`https://viacep.com.br/ws/${cepRaw}/json/`);
    if (!r.ok) return bad(res, 'Falha ao buscar CEP');
    const j = await r.json();
    if (j.erro) return notFound(res, 'CEP não encontrado');

    return ok(res, {
      addressStreet: j.logradouro || '',
      addressDistrict: j.bairro || '',
      addressCity: j.localidade || '',
      addressState: j.uf || '',
      addressZip: j.cep || cepRaw,
      addressCountry: 'Brasil',
    });
  } catch (e) {
    return bad(res, 'Erro ao buscar CEP');
  }
}

/* ======================
   ===== Controllers ====
   ====================== */

async function create(req, res) {
  const body = {
    ...req.body,
    tipoAtendimento:
      req.body.tipoAtendimento !== undefined
        ? normalizeTipoAtendimento(req.body.tipoAtendimento)
        : normalizeTipoAtendimento(req.body.tipo_atendimento),
  };

  const { error, value } = userSchema.validate(body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const exists = await User.findOne({ where: { email: value.email } });
  if (exists) return bad(res, 'E-mail já cadastrado');

  const createdUser = await User.create({
    ...value,
    password_hash: value.password,
    loginEnabled: true,
  });

  const user = await User.findByPk(createdUser.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });

  const payload = user.toJSON();
  payload.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(payload.tipoAtendimento);

  return created(res, payload);
}

async function createWorker(req, res) {
  const body = {
    ...req.body,
    tipoAtendimento:
      req.body.tipoAtendimento !== undefined
        ? normalizeTipoAtendimento(req.body.tipoAtendimento)
        : normalizeTipoAtendimento(req.body.tipo_atendimento),
  };

  const { error, value } = workerSchema.validate(body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const role = await Role.findByPk(value.roleId);
  if (!role) return bad(res, 'Cargo inválido');

  const rname = normRoleName(role.name);
  if (!WORKER_ALLOWED_ROLES.has(rname)) {
    return bad(res, 'Este endpoint aceita apenas Técnico, PSO, ATA,PRP ou SPOT');
  }

  let managerId = null;
  if (value.managerId != null) {
    const mgr = await User.findByPk(value.managerId);
    if (!mgr) return bad(res, 'Gestor informado não existe');
    managerId = value.managerId;
  }

  const user = await User.create({
    name: value.name,
    roleId: value.roleId,
    managerId,
    phone: value.phone || null,

    estoqueAvancado: value.estoqueAvancado ?? false,

    vendorCode: value.vendorCode || null,
    serviceAreaCode: value.serviceAreaCode || null,
    serviceAreaName: value.serviceAreaName || null,
    tipoAtendimento: value.tipoAtendimento || null,

    loginEnabled: false,
  });

  Object.assign(user, {
    addressStreet: value.addressStreet,
    addressNumber: value.addressNumber || '',
    addressComplement: value.addressComplement || '',
    addressDistrict: value.addressDistrict || '',
    addressCity: value.addressCity,
    addressState: value.addressState,
    addressZip: value.addressZip || '',
    addressCountry: value.addressCountry || 'Brasil',
    lat: value.lat,
    lng: value.lng,
  });
  await user.save();

  const populated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });

  const payload = populated.toJSON();
  payload.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(payload.tipoAtendimento);

  return created(res, payload);
}

/* =========================
   ===== Estrutura (Org) ===
   ========================= */

const mapPerson = (u) => ({
  id: u.id,
  nome: u.name,
  cargo: u.role?.name || '—',
  avatarUrl: u.avatarUrl || null,
});

async function buildAcimaChain(userInstance) {
  const acima = [];
  let cursor = userInstance;

  while (cursor && cursor.managerId) {
    const gestor = await User.findByPk(cursor.managerId, {
      attributes: ['id', 'name', 'managerId', 'avatarUrl'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
    });
    if (!gestor) break;
    acima.push(mapPerson(gestor));
    cursor = gestor;
  }
  return acima;
}

/* ======================
   ===== CRUD / Utils ===
   ====================== */

async function list(_req, res) {
  const users = await User.findAll({
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
    order: [['name', 'ASC']],
  });

  const payload = users.map((u) => {
    const item = u.toJSON();
    item.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(item.tipoAtendimento);
    return item;
  });

  return ok(res, payload);
}

async function listAdjustable(req, res) {
  const includeSelf = String(req.query.includeSelf ?? '1') !== '0';
  const me = req.user;
  const myLevel = me?.role?.level ?? 0;

  const all = await User.findAll({
    attributes: ['id', 'name', 'email', 'managerId', 'isActive'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
    order: [['name', 'ASC']],
  });

  const active = all.filter((u) => u.isActive !== false);

  const childrenByMgr = new Map();
  for (const u of active) {
    const key = u.managerId || 0;
    if (!childrenByMgr.has(key)) childrenByMgr.set(key, []);
    childrenByMgr.get(key).push(u);
  }

  let result = [];

  if (myLevel >= 4) {
    result = active;
  } else if (myLevel >= 2) {
    const stack = [me.id];
    const ids = new Set();
    while (stack.length) {
      const id = stack.pop();
      const kids = childrenByMgr.get(id) || [];
      for (const k of kids) {
        if (!ids.has(k.id)) {
          ids.add(k.id);
          stack.push(k.id);
        }
      }
    }
    result = active.filter((u) => ids.has(u.id));
    if (includeSelf) {
      const myself = all.find((u) => u.id === me.id);
      if (myself) result.unshift(myself);
    }
  } else {
    if (includeSelf) {
      const myself = all.find((u) => u.id === me.id);
      if (myself) result = [myself];
    }
  }

  return ok(res, result.map((u) => ({ id: u.id, name: u.name })));
}

async function setManager(req, res) {
  const { id } = req.params;
  const { managerId } = req.body;

  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');

  if (managerId === user.id) return bad(res, 'Colaborador não pode ser gestor de si mesmo');

  if (managerId) {
    const mgr = await User.findByPk(managerId);
    if (!mgr) return bad(res, 'Gestor informado não existe');
  }

  user.managerId = managerId ?? null;
  await user.save();

  const populated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });

  const payload = populated.toJSON();
  payload.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(payload.tipoAtendimento);

  return ok(res, payload);
}

async function update(req, res) {
  const { id } = req.params;

  const body = {
    ...req.body,
    tipoAtendimento:
      req.body.tipoAtendimento !== undefined
        ? normalizeTipoAtendimento(req.body.tipoAtendimento)
        : req.body.tipo_atendimento !== undefined
          ? normalizeTipoAtendimento(req.body.tipo_atendimento)
          : req.body.tipoAtendimento,
  };

  const { error, value } = updateSchema.validate(body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');

  if (value.email && value.email !== user.email) {
    const clash = await User.findOne({ where: { email: value.email } });
    if (clash) return bad(res, 'E-mail já cadastrado');
  }

  if (value.managerId === user.id) {
    return bad(res, 'Colaborador não pode ser gestor de si mesmo');
  }

  if (value.password) {
    user.password_hash = value.password;
    delete value.password;
  }

  if ('lat' in value) value.lat = value.lat === '' || value.lat === undefined ? null : Number(value.lat);
  if ('lng' in value) value.lng = value.lng === '' || value.lng === undefined ? null : Number(value.lng);

  Object.assign(user, value);
  await user.save();

  const populated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });

  const payload = populated.toJSON();
  payload.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(payload.tipoAtendimento);

  return ok(res, payload);
}

async function uploadAvatar(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');
  if (!req.file) return bad(res, 'Arquivo não enviado');

  user.avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
  await user.save();

  return ok(res, { avatarUrl: user.avatarUrl });
}

async function updateAddress(req, res) {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return notFound(res, 'Usuário não encontrado');

  const { error, value } = addressSchema.validate(req.body, { stripUnknown: true });
  if (error) return bad(res, error.message);

  const addr = { ...value };
  let coords = null;

  if (addr.autoGeocode) {
    const query = buildAddressString(addr);
    try {
      coords = await geocodeNominatim(query);
    } catch (_) {}
  }

  Object.assign(user, addr);
  if (coords) {
    user.lat = coords.lat;
    user.lng = coords.lng;
  }
  await user.save();

  const populated = await User.findByPk(user.id, {
    attributes: { exclude: ['password_hash'] },
    include: defaultIncludes,
  });

  const payload = populated.toJSON();
  payload.tipoAtendimentoDescricao = getTipoAtendimentoDescricao(payload.tipoAtendimento);

  return ok(res, payload);
}

async function listMyTeam(req, res) {
  const users = await User.findAll({
    attributes: ['id', 'name', 'email', 'managerId'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
    order: [['name', 'ASC']],
  });

  const byMgr = new Map();
  for (const u of users) {
    if (!byMgr.has(u.managerId)) byMgr.set(u.managerId, []);
    byMgr.get(u.managerId).push(u);
  }

  const result = [];
  const q = [req.user.id];
  const seen = new Set(q);

  while (q.length) {
    const mgrId = q.shift();
    const children = byMgr.get(mgrId) || [];
    for (const kid of children) {
      if (!seen.has(kid.id)) {
        seen.add(kid.id);
        result.push(kid);
        q.push(kid.id);
      }
    }
  }

  return ok(res, result);
}

async function listTechnicians(req, res) {
  const activeOnly = String(req.query.activeOnly ?? '1') !== '0';
  const q = String(req.query.q || '').trim();

  const whereUser = {};
  if (activeOnly) whereUser.isActive = { [Op.ne]: false };

  if (q) {
    whereUser.name = { [Op.like]: `%${q}%` };
  }

  const roleNames = ['TECNICO', 'TÉCNICO', 'PSO', 'ATA', 'PRP', 'SPOT'];

  const rows = await User.findAll({
    where: whereUser,
    attributes: [
      'id',
      'name',
      'avatarUrl',
      'managerId',
      'isActive',
      'estoqueAvancado',
      'vendorCode',
      'serviceAreaCode',
      'serviceAreaName',
      'tipoAtendimento',
    ],
    include: [
      {
        model: Role,
        as: 'role',
        attributes: ['id', 'name', 'level'],
        where: {
          [Op.or]: [
            { name: { [Op.in]: roleNames } },
            { name: { [Op.like]: '%Tecnico%' } },
            { name: { [Op.like]: '%Técnico%' } },
            { name: { [Op.like]: '%PRP%' } },
          ],
        },
        required: true,
      },
    ],
    order: [['name', 'ASC']],
  });

  return ok(
    res,
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl || null,
      managerId: u.managerId ?? null,
      isActive: u.isActive !== false,
      estoqueAvancado: !!u.estoqueAvancado,
      vendorCode: u.vendorCode ?? null,
      serviceAreaCode: u.serviceAreaCode ?? null,
      serviceAreaName: u.serviceAreaName ?? null,
      tipoAtendimento: u.tipoAtendimento ?? null,
      tipoAtendimentoDescricao: getTipoAtendimentoDescricao(u.tipoAtendimento),
      role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
    }))
  );
}

async function mapTechs(req, res) {
  const onlyGeocoded = String(req.query.onlyGeocoded ?? '1') !== '0';
  const activeOnly = String(req.query.activeOnly ?? '1') !== '0';

  const supervisorId = req.query.supervisorId ? Number(req.query.supervisorId) : undefined;
  const coordinatorId = req.query.coordinatorId ? Number(req.query.coordinatorId) : undefined;

  const includeTech = String(req.query.includeTech ?? '1') !== '0';
  const includePSO = String(req.query.includePSO ?? '1') !== '0';
  const includeATA = String(req.query.includeATA ?? '1') !== '0';
  const includeSpot = String(req.query.includeSPOT ?? '1') !== '0';
  const includePRP = String(req.query.includePRP ?? '1') !== '0';

  const users = await User.findAll({
    attributes: [
      'id',
      'name',
      'email',
      'managerId',
      'isActive',
      'lat',
      'lng',
      'estoqueAvancado',
      'vendorCode',
      'serviceAreaCode',
      'serviceAreaName',
      'tipoAtendimento',
    ],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
    order: [['name', 'ASC']],
  });

  const byId = new Map(users.map((u) => [u.id, u]));

  let allowedDownline = null;
  if (supervisorId) {
    allowedDownline = new Set();
    const stack = [supervisorId];
    while (stack.length) {
      const mgr = stack.pop();
      for (const u of users) {
        if (u.managerId === mgr && !allowedDownline.has(u.id)) {
          allowedDownline.add(u.id);
          stack.push(u.id);
        }
      }
    }
  }

  function findUpstream(user, minLevel) {
    let cur = user;
    while (cur && cur.managerId) {
      const mgr = byId.get(cur.managerId);
      if (!mgr) break;
      if ((mgr.role?.level || 0) >= minLevel) return mgr;
      cur = mgr;
    }
    return null;
  }

  const items = [];
  for (const u of users) {
    if (activeOnly && !u.isActive) continue;
    if (onlyGeocoded && !(u.lat != null && u.lng != null)) continue;

    const kind = roleKindFromRoleName(u.role?.name);

    if (kind === 'TECH' && !includeTech) continue;
    if (kind === 'PSO' && !includePSO) continue;
    if (kind === 'ATA' && !includeATA) continue;
    if (kind === 'SPOT' && !includeSpot) continue;
    if (kind === 'PRP' && !includePRP) continue;

    const allowedKinds = new Set(['TECH', 'PSO', 'ATA', 'SPOT', 'PRP']);
    if (!allowedKinds.has(kind)) continue;

    if (allowedDownline && !allowedDownline.has(u.id)) continue;

    const supervisor = findUpstream(u, 3);
    const coordinator = findUpstream(u, 4);

    if (coordinatorId && (!coordinator || coordinator.id !== coordinatorId)) continue;

    items.push({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ? { id: u.role.id, name: u.role.name, level: u.role.level } : null,
      lat: u.lat,
      lng: u.lng,
      estoqueAvancado: !!u.estoqueAvancado,
      vendorCode: u.vendorCode ?? null,
      serviceAreaCode: u.serviceAreaCode ?? null,
      serviceAreaName: u.serviceAreaName ?? null,
      tipoAtendimento: u.tipoAtendimento ?? null,
      tipoAtendimentoDescricao: getTipoAtendimentoDescricao(u.tipoAtendimento),
      supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null,
      coordinator: coordinator ? { id: coordinator.id, name: coordinator.name } : null,
      kind,
    });
  }

  const supervisors = [];
  const supSeen = new Set();
  const coordinators = [];
  const corSeen = new Set();

  for (const it of items) {
    if (it.supervisor && !supSeen.has(it.supervisor.id)) {
      supSeen.add(it.supervisor.id);
      supervisors.push(it.supervisor);
    }
    if (it.coordinator && !corSeen.has(it.coordinator.id)) {
      corSeen.add(it.coordinator.id);
      coordinators.push(it.coordinator);
    }
  }

  return ok(res, { items, supervisors, coordinators });
}

async function getStructure(req, res) {
  try {
    const { id } = req.params;
    const deep = ['1', 'true', 'yes'].includes(String(req.query.deep || '').toLowerCase());

    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'managerId', 'isActive', 'avatarUrl'],
      include: [{ model: Role, as: 'role', attributes: ['name'] }],
    });
    if (!user) return notFound(res, 'Usuário não encontrado');

    const acima = await buildAcimaChain(user);

    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'managerId', 'isActive', 'avatarUrl'],
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'level'] }],
      order: [['name', 'ASC']],
    });

    const byMgr = new Map();
    for (const u of users) {
      const key = u.managerId ?? 0;
      if (!byMgr.has(key)) byMgr.set(key, []);
      byMgr.get(key).push(u);
    }

    const mapPersonLocal = (u) => ({
      id: u.id,
      nome: u.name,
      cargo: u.role?.name || '—',
      avatarUrl: u.avatarUrl || null,
    });

    let abaixo = [];

    if (!deep) {
      const diretos = byMgr.get(user.id) || [];
      abaixo = diretos.map(mapPersonLocal);
    } else {
      const stack = [...(byMgr.get(user.id) || [])];
      const seen = new Set();

      while (stack.length) {
        const cur = stack.shift();
        if (!cur || seen.has(cur.id)) continue;
        seen.add(cur.id);
        abaixo.push(mapPersonLocal(cur));

        const filhos = byMgr.get(cur.id) || [];
        stack.push(...filhos);
      }
    }

    return ok(res, {
      acima,
      atual: mapPersonLocal(user),
      abaixo,
    });
  } catch (err) {
    return bad(res, err.message || 'Erro ao montar estrutura');
  }
}

module.exports = {
  create,
  list,
  update,
  setManager,
  uploadAvatar,
  updateAddress,

  createWorker,
  mapTechs,
  listTechnicians,

  listAdjustable,
  listMyTeam,
  getStructure,

  cepLookup,
};